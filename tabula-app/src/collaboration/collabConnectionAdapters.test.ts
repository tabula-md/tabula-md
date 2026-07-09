import { describe, expect, it, vi } from "vitest";

import { createCollabConnection } from "./liveCollaboration";
import {
  decryptEnvelopeForRoom,
  encryptBytesForRoom,
  generateRoomKey,
  importRoomKey,
} from "./collabRoom";
import {
  applyTextPatches,
  createRoomActor,
  createWorkspaceRoomCheckpoint,
  createWorkspaceRoomState,
  encodeBase64Url,
  encodeRoomEvent,
} from "@tabula-md/tabula";
import type {
  CollabRuntimeAdapters,
  CollabRuntimeClock,
  CollabTextAdapter,
  CollabTextDocumentHandle,
  CollabTextUpdateListener,
} from "./collabRuntimeAdapters";
import type { EncryptedEnvelope, EnvelopeKind } from "./roomProtocol";
import type { RoomTransportHandlers } from "./roomTransport";
import { encryptWorkspaceRoomCheckpoint } from "./roomCheckpointStore";

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

const waitForAsyncWork = async () => {
  await flushAsyncWork();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const createFakeClock = (): CollabRuntimeClock & {
  flushIntervals: () => void;
  flushTimeouts: () => void;
  getClearedTimeoutCount: () => number;
} => {
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
      timeouts.push(callback);
      return callback;
    },
    cancelIdleCallback(handle) {
      const index = timeouts.indexOf(handle as () => void);
      if (index >= 0) {
        timeouts.splice(index, 1);
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
  getText(document) {
    return asFakeDocument(document).text;
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

const decodeFakeEvent = (envelope: EncryptedEnvelope) =>
  JSON.parse(new TextDecoder().decode((envelope as FakeEnvelope).plaintext));

const createFakeAdapters = () => {
  let handlers: RoomTransportHandlers | undefined;
  const sentEnvelopes: EncryptedEnvelope[] = [];
  const volatileEnvelopes: EncryptedEnvelope[] = [];
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
    roomCheckpointStore: {
      enabled: false,
      loadEncryptedCheckpoint: vi.fn(async () => null),
      saveEncryptedCheckpoint: vi.fn(async () => {}),
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
  };
};

describe("collaboration connection adapters", () => {
  it("publishes only encrypted room-events through injected transport, crypto, text, and clock adapters", async () => {
    const { adapters, clock, getHandlers, sentEnvelopes, volatileEnvelopes } = createFakeAdapters();
    const onStatusChange = vi.fn();
    const onTextChange = vi.fn();
    const connection = createCollabConnection({
      roomId: "room-1",
      roomKey: "encoded-key",
      documentId: "readme",
      documents: [
        { id: "readme", title: "README.md", text: "readme text" },
        { id: "untitled", title: "Untitled.md", text: "untitled text" },
      ],
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
    expect(sentEnvelopes.map((envelope) => envelope.kind)).toEqual(["room-event", "room-event", "room-event"]);
    expect(volatileEnvelopes.map((envelope) => envelope.kind)).toEqual(["room-event"]);

    const sentEvents = sentEnvelopes.map(decodeFakeEvent);
    expect(sentEvents[0]).toMatchObject({
      type: "workspace.updated",
      actor: { id: "self", kind: "human", client: "tabula-md" },
      workspace: {
        mode: "workspace",
        activeDocumentId: "readme",
      },
    });
    expect(sentEvents.slice(1).map((event) => event.documentId).sort()).toEqual(["readme", "untitled"]);
    expect(sentEvents.slice(1).every((event) => event.type === "text.updated" && event.actor.id === "self")).toBe(true);

    connection.applyLocalText("readme changed");
    clock.flushTimeouts();
    await flushAsyncWork();

    const localEditEvent = decodeFakeEvent(sentEnvelopes.at(-1)!);
    expect(localEditEvent).toMatchObject({
      type: "text.updated",
      actor: { id: "self" },
      documentId: "readme",
    });
    expect(sentEnvelopes.map((envelope) => envelope.kind)).not.toContain("yjs-update");
    expect(onTextChange).not.toHaveBeenCalledWith("readme", "readme changed", expect.anything());

    connection.disconnect();
  });

  it("loads an encrypted workspace checkpoint before joining the live relay", async () => {
    const roomKey = generateRoomKey();
    const checkpoint = await createWorkspaceRoomCheckpoint({
      roomId: "room-1",
      activeDocumentId: "readme",
      nowIso: () => "2026-07-01T00:00:00.000Z",
      documents: [
        { id: "readme", title: "README.md", markdown: "# Restored readme" },
        { id: "plan", title: "Plan.md", markdown: "Restored plan" },
      ],
    });
    const encryptedCheckpoint = await encryptWorkspaceRoomCheckpoint({
      checkpoint,
      roomKey,
    });
    const { adapters } = createFakeAdapters();
    adapters.crypto = {
      importRoomKey,
      encryptEnvelope: encryptBytesForRoom,
      decryptEnvelope: decryptEnvelopeForRoom,
    };
    adapters.roomCheckpointStore = {
      enabled: true,
      loadEncryptedCheckpoint: vi.fn(async () => encryptedCheckpoint),
      saveEncryptedCheckpoint: vi.fn(async () => {}),
    };
    const onTextChange = vi.fn();
    const onRoomEvent = vi.fn();

    createCollabConnection({
      roomId: "room-1",
      roomKey,
      documentId: "live-room-1",
      documents: [{ id: "live-room-1", title: "Shared room", text: "" }],
      identity: {
        id: "self",
        name: "Taeha",
        color: "#763FC8",
        lastSeen: 1,
      },
      fileTitle: "Shared room",
      onTextChange,
      onStatusChange: vi.fn(),
      onCollaboratorsChange: vi.fn(),
      onRoomEvent,
      adapters,
    });

    for (let index = 0; index < 10 && onRoomEvent.mock.calls.length === 0; index += 1) {
      await waitForAsyncWork();
    }

    expect(adapters.roomCheckpointStore.loadEncryptedCheckpoint).toHaveBeenCalledWith("room-1");
    expect(onRoomEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "workspace.updated",
      workspace: checkpoint.workspace,
    }));
    expect(onTextChange).toHaveBeenCalledWith("readme", "# Restored readme");
    expect(onTextChange).toHaveBeenCalledWith("plan", "Restored plan");
  });

  it("applies incoming room-event text updates to the addressed document", async () => {
    const { adapters, getHandlers } = createFakeAdapters();
    const onTextChange = vi.fn();
    const connection = createCollabConnection({
      roomId: "room-1",
      roomKey: "encoded-key",
      documentId: "readme",
      documents: [
        { id: "readme", title: "README.md", text: "readme text" },
        { id: "untitled", title: "Untitled.md", text: "untitled text" },
      ],
      identity: {
        id: "self",
        name: "Taeha",
        color: "#763FC8",
        lastSeen: 1,
      },
      fileTitle: "README",
      onTextChange,
      onStatusChange: vi.fn(),
      onCollaboratorsChange: vi.fn(),
      adapters,
    });
    await flushAsyncWork();
    const writer = createRoomActor({
      id: "writer",
      kind: "agent",
      name: "Writer",
      client: "tabula-mcp",
      capabilities: ["presence", "read", "write"],
      joinedAt: "2026-07-01T00:00:00.000Z",
    });

    await getHandlers().onMessage({
      v: 1,
      roomId: "room-1",
      kind: "room-event",
      version: 99,
      iv: "iv",
      ciphertext: "ciphertext",
      createdAt: "2026-07-01T00:00:00.000Z",
      plaintext: encodeRoomEvent({
        id: "event-remote",
        roomId: "room-1",
        actorId: writer.id,
        type: "text.updated",
        createdAt: "2026-07-01T00:00:00.000Z",
        actor: writer,
        documentId: "untitled",
        update: encodeBase64Url(new TextEncoder().encode("remote")),
      }),
    } satisfies FakeEnvelope);

    expect(onTextChange).toHaveBeenCalledWith("untitled", "remote", {
      patches: [{ from: 0, to: 0, insert: "remote" }],
    });

    connection.disconnect();
  });

  it("prunes removed workspace documents before rebroadcasting current state", async () => {
    const { adapters, getHandlers, sentEnvelopes } = createFakeAdapters();
    const connection = createCollabConnection({
      roomId: "room-1",
      roomKey: "encoded-key",
      documentId: "readme",
      documents: [
        { id: "readme", title: "README.md", text: "readme text" },
        { id: "untitled", title: "Untitled.md", text: "deleted text" },
      ],
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
    sentEnvelopes.splice(0);
    const writer = createRoomActor({
      id: "writer",
      kind: "agent",
      name: "Writer",
      client: "tabula-mcp",
      capabilities: ["presence", "read", "write"],
      joinedAt: "2026-07-01T00:00:00.000Z",
    });
    const workspace = await createWorkspaceRoomState({
      roomId: "room-1",
      activeDocumentId: "readme",
      documents: [{ id: "readme", title: "README.md", markdown: "readme text" }],
      nowIso: () => "2026-07-01T00:00:00.000Z",
    });

    await getHandlers().onMessage({
      v: 1,
      roomId: "room-1",
      kind: "room-event",
      version: 99,
      iv: "iv",
      ciphertext: "ciphertext",
      createdAt: "2026-07-01T00:00:00.000Z",
      plaintext: encodeRoomEvent({
        id: "event-remote",
        roomId: "room-1",
        actorId: writer.id,
        type: "workspace.updated",
        createdAt: "2026-07-01T00:00:00.000Z",
        actor: writer,
        workspace,
      }),
    } satisfies FakeEnvelope);
    await waitForAsyncWork();
    sentEnvelopes.splice(0);

    await getHandlers().onPeerJoined({ roomId: "room-1", clientId: "new-peer" });
    for (let index = 0; index < 10 && sentEnvelopes.length === 0; index += 1) {
      await waitForAsyncWork();
    }

    const sentEvents = sentEnvelopes.map(decodeFakeEvent);
    const workspaceEvent = sentEvents.find((event) => event.type === "workspace.updated");
    expect(workspaceEvent.workspace.nodes.filter((node: { type: string }) => node.type === "document").map((node: { id: string }) => node.id)).toEqual(["readme"]);
    expect(sentEvents.filter((event) => event.type === "text.updated").map((event) => event.documentId)).toEqual(["readme"]);
    connection.disconnect();
  });

  it("throttles rapid presence selection updates into a single volatile room-event", async () => {
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
    const initialPresenceCount = volatileEnvelopes.filter((envelope) => decodeFakeEvent(envelope).type === "presence.updated").length;

    connection.setPresence({ selection: { from: 1, to: 1 } });
    connection.setPresence({ selection: { from: 2, to: 2 } });
    connection.setPresence({ selection: { from: 3, to: 3 } });

    expect(volatileEnvelopes.filter((envelope) => decodeFakeEvent(envelope).type === "presence.updated")).toHaveLength(initialPresenceCount);
    expect(clock.getClearedTimeoutCount()).toBe(0);
    clock.flushTimeouts();
    await flushAsyncWork();

    expect(volatileEnvelopes.filter((envelope) => decodeFakeEvent(envelope).type === "presence.updated")).toHaveLength(initialPresenceCount + 1);
    expect(decodeFakeEvent(volatileEnvelopes.at(-1)!)).toMatchObject({
      type: "presence.updated",
      presence: {
        selection: { from: 3, to: 3 },
      },
    });

    connection.disconnect();
  });
});
