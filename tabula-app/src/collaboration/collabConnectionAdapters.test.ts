import { describe, expect, it, vi } from "vitest";

import { createCollabConnection } from "./liveCollaboration";
import { applyTextPatches } from "@tabula-md/tabula";
import type {
  CollabRuntimeAdapters,
  CollabRuntimeClock,
  CollabTextAdapter,
  CollabTextDocumentHandle,
  CollabTextUpdateListener,
} from "./collabRuntimeAdapters";
import type { EncryptedEnvelope, EnvelopeKind } from "./roomProtocol";
import type { RoomTransportHandlers } from "./roomTransport";

type FakeTextDocument = {
  text: string;
  listeners: Set<CollabTextUpdateListener>;
};

type FakeEnvelope = EncryptedEnvelope & {
  plaintext: Uint8Array;
};

const remoteOrigin = Symbol("remote");

const asFakeDocument = (document: CollabTextDocumentHandle) => document as FakeTextDocument;

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createFakeClock = (): CollabRuntimeClock & {
  flushIdleCallbacks: () => void;
  flushIntervals: () => void;
  flushTimeouts: () => void;
  getClearedTimeoutCount: () => number;
} => {
  const idleCallbacks: Array<() => void> = [];
  const timeouts: Array<() => void> = [];
  const intervals: Array<() => void> = [];
  let clearedTimeoutCount = 0;

  return {
    setTimeout(callback) {
      timeouts.push(callback);
      return callback;
    },
    clearTimeout(handle) {
      const index = timeouts.indexOf(handle as () => void);
      if (index >= 0) {
        timeouts.splice(index, 1);
        clearedTimeoutCount += 1;
      }
    },
    setInterval(callback) {
      intervals.push(callback);
      return callback;
    },
    clearInterval(handle) {
      const index = intervals.indexOf(handle as () => void);
      if (index >= 0) {
        intervals.splice(index, 1);
      }
    },
    requestIdleCallback(callback) {
      idleCallbacks.push(callback);
      return callback;
    },
    cancelIdleCallback(handle) {
      const index = idleCallbacks.indexOf(handle as () => void);
      if (index >= 0) {
        idleCallbacks.splice(index, 1);
      }
    },
    nowIso() {
      return "2026-07-01T00:00:00.000Z";
    },
    createId() {
      return "event-1";
    },
    flushTimeouts() {
      const callbacks = timeouts.splice(0);
      callbacks.forEach((callback) => callback());
    },
    flushIdleCallbacks() {
      const callbacks = idleCallbacks.splice(0);
      callbacks.forEach((callback) => callback());
    },
    flushIntervals() {
      [...intervals].forEach((callback) => callback());
    },
    getClearedTimeoutCount() {
      return clearedTimeoutCount;
    },
  };
};

const createFakeTextAdapter = (): CollabTextAdapter => ({
  createDocument(initialText) {
    return {
      text: initialText ?? "",
      listeners: new Set<CollabTextUpdateListener>(),
    };
  },
  observeUpdates(document, listener) {
    asFakeDocument(document).listeners.add(listener);
    return () => asFakeDocument(document).listeners.delete(listener);
  },
  isRemoteOrigin(origin) {
    return origin === remoteOrigin;
  },
  encodeState(document) {
    return new TextEncoder().encode(asFakeDocument(document).text);
  },
  mergeUpdates(updates) {
    return new Uint8Array(updates.reduce((size, update) => size + update.byteLength, 0));
  },
  applyLocalText(document, nextText) {
    const fakeDocument = asFakeDocument(document);
    fakeDocument.text = nextText;
    const update = new TextEncoder().encode(nextText);
    fakeDocument.listeners.forEach((listener) => listener(update, "local"));
  },
  applyLocalTextPatches(document, patches) {
    const fakeDocument = asFakeDocument(document);
    const nextText = applyTextPatches(fakeDocument.text, patches);
    if (nextText === null) {
      return;
    }
    fakeDocument.text = nextText;
    const update = new TextEncoder().encode(nextText);
    fakeDocument.listeners.forEach((listener) => listener(update, "local"));
  },
  applyRemoteUpdate(document, update) {
    const nextText = new TextDecoder().decode(update);
    const fakeDocument = asFakeDocument(document);
    if (fakeDocument.text === nextText) {
      return null;
    }

    fakeDocument.text = nextText;
    fakeDocument.listeners.forEach((listener) => listener(update, remoteOrigin));
    return {
      text: nextText,
      change: {
        patches: [{ from: 0, to: 0, insert: nextText }],
      },
    };
  },
  destroy(document) {
    asFakeDocument(document).listeners.clear();
  },
});

const createFakeAdapters = () => {
  let handlers: RoomTransportHandlers | undefined;
  const sentEnvelopes: EncryptedEnvelope[] = [];
  const volatileEnvelopes: EncryptedEnvelope[] = [];
  const savedRecoveryStates: Uint8Array[] = [];
  const clock = createFakeClock();
  const text = createFakeTextAdapter();

  const adapters: CollabRuntimeAdapters = {
    clock,
    text,
    createRoomTransport: (options) => {
      handlers = options.handlers;
      return {
        connected: true,
        connect: vi.fn(() => handlers?.onConnect()),
        sendEnvelope: vi.fn((envelope) => sentEnvelopes.push(envelope)),
        sendVolatileEnvelope: vi.fn((envelope) => volatileEnvelopes.push(envelope)),
        disconnect: vi.fn(),
      };
    },
    resolveRoomBaseUrl: () => "https://rooms.test",
    crypto: {
      importRoomKey: vi.fn(async () => ({}) as CryptoKey),
      encryptEnvelope: vi.fn(
        async (_roomKey, roomId: string, kind: EnvelopeKind, version: number, plaintext: Uint8Array) =>
          ({
            v: 1,
            roomId,
            kind,
            version,
            iv: "iv",
            ciphertext: "ciphertext",
            createdAt: "2026-07-01T00:00:00.000Z",
            plaintext,
          }) satisfies FakeEnvelope,
      ),
      decryptEnvelope: vi.fn(async (_roomKey, envelope) => (envelope as FakeEnvelope).plaintext),
    },
    roomRecoveryStore: {
      load: vi.fn(async () => null),
      save: vi.fn(async ({ state }) => {
        savedRecoveryStates.push(state);
        return { version: savedRecoveryStates.length };
      }),
    },
  };

  return {
    adapters,
    clock,
    getHandlers: () => {
      if (!handlers) {
        throw new Error("Transport handlers were not created.");
      }
      return handlers;
    },
    sentEnvelopes,
    volatileEnvelopes,
    savedRecoveryStates,
  };
};

describe("collaboration connection adapters", () => {
  it("runs the collaboration connection through injected transport, crypto, text, clock, and fetch adapters", async () => {
    const { adapters, clock, getHandlers, sentEnvelopes, volatileEnvelopes, savedRecoveryStates } = createFakeAdapters();
    const onStatusChange = vi.fn();
    const onTextChange = vi.fn();
    const connection = createCollabConnection({
      roomId: "room-1",
      roomKey: "encoded-key",
      initialText: "hello",
      identity: {
        id: "self",
        name: "Taeha",
        color: "#763FC8",
        lastSeen: 1,
      },
      fileTitle: "README",
      onTextChange,
      onStatusChange,
      onCollaboratorsChange: vi.fn(),
      adapters,
    });

    await flushAsyncWork();
    await getHandlers().onJoined({ roomId: "room-1", clientId: "self", peerCount: 1 });

    expect(onStatusChange).toHaveBeenCalledWith("connecting");
    expect(onStatusChange).toHaveBeenCalledWith("connected");
    expect(sentEnvelopes.map((envelope) => envelope.kind)).toContain("yjs-update");
    expect(volatileEnvelopes.map((envelope) => envelope.kind)).toContain("presence");
    expect(savedRecoveryStates).toHaveLength(1);

    connection.applyLocalText("hello\nworld", [{ from: 5, to: 5, insert: "\nworld" }]);
    expect(savedRecoveryStates).toHaveLength(1);
    clock.flushTimeouts();
    clock.flushIdleCallbacks();
    await flushAsyncWork();

    expect(savedRecoveryStates).toHaveLength(2);
    expect(onTextChange).not.toHaveBeenCalledWith("hello\nworld", expect.anything());

    await getHandlers().onMessage({
      v: 1,
      roomId: "room-1",
      kind: "yjs-update",
      version: 99,
      iv: "iv",
      ciphertext: "ciphertext",
      createdAt: "2026-07-01T00:00:00.000Z",
      plaintext: new TextEncoder().encode("remote"),
    } satisfies FakeEnvelope);

    expect(onTextChange).toHaveBeenCalledWith("remote", {
      patches: [{ from: 0, to: 0, insert: "remote" }],
    });

    connection.disconnect();
  });

  it("throttles rapid presence selection updates into a single volatile envelope", async () => {
    const { adapters, clock, getHandlers, volatileEnvelopes } = createFakeAdapters();
    const connection = createCollabConnection({
      roomId: "room-1",
      roomKey: "encoded-key",
      initialText: "hello",
      identity: {
        id: "self",
        name: "Taeha",
        color: "#763FC8",
        lastSeen: 1,
      },
      fileTitle: "README",
      onTextChange: vi.fn(),
      onStatusChange: vi.fn(),
      onCollaboratorsChange: vi.fn(),
      adapters,
    });

    await flushAsyncWork();
    await getHandlers().onJoined({ roomId: "room-1", clientId: "self", peerCount: 1 });
    const initialPresenceCount = volatileEnvelopes.filter((envelope) => envelope.kind === "presence").length;

    connection.setPresence({ selection: { from: 1, to: 1 } });
    connection.setPresence({ selection: { from: 2, to: 2 } });
    connection.setPresence({ selection: { from: 3, to: 3 } });

    expect(volatileEnvelopes.filter((envelope) => envelope.kind === "presence")).toHaveLength(initialPresenceCount);
    expect(clock.getClearedTimeoutCount()).toBe(0);
    clock.flushTimeouts();
    await flushAsyncWork();

    expect(volatileEnvelopes.filter((envelope) => envelope.kind === "presence")).toHaveLength(initialPresenceCount + 1);

    connection.disconnect();
  });

  it("sends bounded full-state repair syncs after local updates", async () => {
    const { adapters, clock, getHandlers, sentEnvelopes } = createFakeAdapters();
    const connection = createCollabConnection({
      roomId: "room-1",
      roomKey: "encoded-key",
      initialText: "hello",
      identity: {
        id: "self",
        name: "Taeha",
        color: "#763FC8",
        lastSeen: 1,
      },
      fileTitle: "README",
      onTextChange: vi.fn(),
      onStatusChange: vi.fn(),
      onCollaboratorsChange: vi.fn(),
      adapters,
    });

    await flushAsyncWork();
    await getHandlers().onJoined({ roomId: "room-1", clientId: "self", peerCount: 1 });
    const initialStateInitCount = sentEnvelopes.filter((envelope) => envelope.kind === "state-init").length;

    connection.applyLocalText("hello\nworld", [{ from: 5, to: 5, insert: "\nworld" }]);
    clock.flushTimeouts();
    clock.flushIdleCallbacks();
    await flushAsyncWork();

    clock.flushIntervals();
    await flushAsyncWork();
    clock.flushIntervals();
    await flushAsyncWork();
    clock.flushIntervals();
    await flushAsyncWork();

    expect(sentEnvelopes.filter((envelope) => envelope.kind === "state-init")).toHaveLength(
      initialStateInitCount + 2,
    );

    connection.disconnect();
  });
});
