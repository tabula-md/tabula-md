import { describe, expect, it, vi } from "vitest";

import { createCollabConnection } from "./liveCollaboration";
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

const createFakeClock = (): CollabRuntimeClock & { flushTimeouts: () => void } => {
  const timeouts: Array<() => void> = [];

  return {
    setTimeout(callback) {
      timeouts.push(callback);
      return callback;
    },
    clearTimeout(handle) {
      const index = timeouts.indexOf(handle as () => void);
      if (index >= 0) {
        timeouts.splice(index, 1);
      }
    },
    setInterval(callback) {
      return callback;
    },
    clearInterval: vi.fn(),
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

    await Promise.resolve();
    await Promise.resolve();
    await getHandlers().onJoined({ roomId: "room-1", clientId: "self", peerCount: 1 });

    expect(onStatusChange).toHaveBeenCalledWith("connecting");
    expect(onStatusChange).toHaveBeenCalledWith("connected");
    expect(sentEnvelopes.map((envelope) => envelope.kind)).toContain("yjs-update");
    expect(volatileEnvelopes.map((envelope) => envelope.kind)).toContain("presence");
    expect(savedRecoveryStates).toHaveLength(1);

    connection.applyLocalText("hello\nworld", [{ from: 5, to: 5, insert: "\nworld" }]);
    clock.flushTimeouts();
    await Promise.resolve();

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
});
