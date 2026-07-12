import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  createWorkspaceRoomCrdt,
  initializeWorkspaceRoomCrdt,
  type EncryptedEnvelope,
  type WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";
import { createDefaultCollabRuntimeAdapters } from "./collabDefaultAdapters";
import { createWorkspaceRoomRuntime } from "./liveCollaboration";
import { createNoopRoomCheckpointStore } from "./roomCheckpointStore";
import { encryptWorkspaceRoomCheckpoint, type RoomCheckpointStore } from "./roomCheckpointStore";
import type { CreateRoomTransport, RoomTransportHandlers } from "./roomTransport";

const VALID_ROOM_KEY = "A".repeat(43);

const createConnectedTransport = () => {
  let handlers: RoomTransportHandlers | null = null;
  let disconnectCount = 0;
  const sent: unknown[] = [];
  const createRoomTransport: CreateRoomTransport = (options) => {
    handlers = options.handlers;
    let connected = false;
    return {
      get connected() { return connected; },
      connect() {
        connected = true;
        options.handlers.onConnect();
        options.handlers.onJoined({ roomId: options.roomId, clientId: options.clientId, peerCount: 1 });
      },
      disconnect() { connected = false; disconnectCount += 1; },
      sendEnvelope(envelope) { sent.push(envelope); },
      sendVolatileEnvelope(envelope) { sent.push(envelope); },
    };
  };
  return { createRoomTransport, getHandlers: () => handlers, getDisconnectCount: () => disconnectCount, sent };
};

const waitForTasks = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const createMemoryRoomCheckpointStore = () => {
  const checkpoints = new Map<string, {
    generation: number;
    encryptedCheckpoint: Uint8Array;
    expiresAt: number;
  }>();
  const store: RoomCheckpointStore = {
    enabled: true,
    async loadEncryptedCheckpoint(roomId) {
      const checkpoint = checkpoints.get(roomId);
      return checkpoint
        ? {
            status: "ready" as const,
            ...checkpoint,
            encryptedCheckpoint: checkpoint.encryptedCheckpoint.slice(),
          }
        : null;
    },
    async saveEncryptedCheckpoint(roomId, request) {
      const currentGeneration = checkpoints.get(roomId)?.generation ?? 0;
      if (currentGeneration !== request.expectedGeneration) {
        return { ok: false, reason: "conflict" as const, generation: currentGeneration };
      }
      const generation = currentGeneration + 1;
      checkpoints.set(roomId, {
        generation,
        encryptedCheckpoint: request.encryptedCheckpoint.slice(),
        expiresAt: request.expiresAt,
      });
      return { ok: true, generation };
    },
  };
  return {
    store,
    getGeneration: (roomId: string) => checkpoints.get(roomId)?.generation ?? 0,
  };
};

const createMemoryRoomRelay = () => {
  const endpoints = new Map<string, {
    roomId: string;
    handlers: RoomTransportHandlers;
    isConnected: () => boolean;
    connect: () => void;
    disconnect: () => void;
  }>();
  let sentBytes = 0;
  let sentCount = 0;

  const connectedEndpoints = (roomId: string) =>
    [...endpoints.entries()].filter(([, endpoint]) => endpoint.roomId === roomId && endpoint.isConnected());

  const publishPeers = (roomId: string) => {
    const peers = connectedEndpoints(roomId).map(([clientId]) => clientId);
    for (const [, endpoint] of connectedEndpoints(roomId)) {
      endpoint.handlers.onPeers({ roomId, peers });
    }
  };

  const forward = (senderId: string, envelope: EncryptedEnvelope) => {
    sentCount += 1;
    sentBytes += new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
    queueMicrotask(() => {
      const sender = endpoints.get(senderId);
      if (!sender?.isConnected()) return;
      for (const [clientId, endpoint] of connectedEndpoints(sender.roomId)) {
        if (clientId !== senderId) endpoint.handlers.onMessage(envelope);
      }
    });
  };

  const createRoomTransport: CreateRoomTransport = ({ roomId, clientId, handlers }) => {
    let connected = false;
    const connect = () => {
      if (connected) return;
        const existingPeers = connectedEndpoints(roomId);
        connected = true;
        handlers.onConnect();
        handlers.onJoined({ roomId, clientId, peerCount: existingPeers.length + 1 });
        for (const [, endpoint] of existingPeers) {
          endpoint.handlers.onPeerJoined({ roomId, clientId });
        }
        publishPeers(roomId);
    };
    const disconnect = () => {
      if (!connected) return;
      connected = false;
      handlers.onDisconnect();
      publishPeers(roomId);
    };
    endpoints.set(clientId, { roomId, handlers, isConnected: () => connected, connect, disconnect });
    return {
      get connected() { return connected; },
      connect,
      disconnect,
      sendEnvelope(envelope) { forward(clientId, envelope); },
      sendVolatileEnvelope(envelope) { forward(clientId, envelope); },
    };
  };

  return {
    createRoomTransport,
    getSentCount: () => sentCount,
    getSentBytes: () => sentBytes,
    resetSentBytes: () => { sentBytes = 0; sentCount = 0; },
    setOnline(clientId: string, online: boolean) {
      const endpoint = endpoints.get(clientId);
      if (online) endpoint?.connect();
      else endpoint?.disconnect();
    },
  };
};

const last = <Value,>(values: readonly Value[]) => values.at(-1);

describe("workspace room runtime", () => {
  it("does not create a transport after disconnecting during key import", async () => {
    let resolveKey!: (key: CryptoKey) => void;
    const importRoomKey = vi.fn(() => new Promise<CryptoKey>((resolve) => { resolveKey = resolve; }));
    const createRoomTransport = vi.fn();
    const defaults = createDefaultCollabRuntimeAdapters();
    const connection = createWorkspaceRoomRuntime({
      roomId: "room-1",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-1",
      emitInitialWorkspaceState: true,
      documents: [{ id: "doc-1", title: "README.md", text: "# Hello" }],
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "README.md",
      adapters: {
        ...defaults,
        crypto: { ...defaults.crypto, importRoomKey },
        createRoomTransport,
        roomCheckpointStore: createNoopRoomCheckpointStore(),
        resolveRoomBaseUrl: () => "http://room.test",
      },
    });
    connection.disconnect();
    resolveKey({} as CryptoKey);
    await waitForTasks();
    expect(createRoomTransport).not.toHaveBeenCalled();
  });

  it("releases transport and heartbeat resources across repeated lifecycle cycles", async () => {
    const transport = createConnectedTransport();
    const defaults = createDefaultCollabRuntimeAdapters();
    const activeIntervals = new Set<symbol>();
    const activeTimeouts = new Set<symbol>();
    const clock = {
      ...defaults.clock,
      setTimeout: vi.fn(() => {
        const handle = Symbol("timeout");
        activeTimeouts.add(handle);
        return handle;
      }),
      clearTimeout: vi.fn((handle: unknown) => activeTimeouts.delete(handle as symbol)),
      setInterval: vi.fn(() => {
        const handle = Symbol("interval");
        activeIntervals.add(handle);
        return handle;
      }),
      clearInterval: vi.fn((handle: unknown) => activeIntervals.delete(handle as symbol)),
    };

    for (let index = 0; index < 5; index += 1) {
      const connection = createWorkspaceRoomRuntime({
        roomId: `room-cycle-${index}`,
        roomKey: VALID_ROOM_KEY,
        documentId: "doc",
        emitInitialWorkspaceState: true,
        documents: [{ id: "doc", title: "README.md", text: "text" }],
        identity: { id: `human-${index}`, name: "Curious Human", color: "#2563eb", lastSeen: 0 },
        fileTitle: "README.md",
        adapters: {
          ...defaults,
          clock,
          createRoomTransport: transport.createRoomTransport,
          roomCheckpointStore: createNoopRoomCheckpointStore(),
          resolveRoomBaseUrl: () => "http://room.test",
        },
      });
      await vi.waitFor(() => expect(connection.getSnapshot().status).toBe("connected"));
      connection.subscribeDocument("doc", vi.fn());
      connection.applyLocalTextPatches([{ from: 4, to: 4, insert: "!" }]);
      expect(activeTimeouts.size).toBeGreaterThan(0);
      connection.disconnect();
      connection.disconnect();
      expect(activeTimeouts.size).toBe(0);
      expect(activeIntervals.size).toBe(0);
    }

    expect(transport.getDisconnectCount()).toBe(5);
    expect(clock.setInterval).toHaveBeenCalledTimes(5);
    expect(clock.clearInterval).toHaveBeenCalledTimes(5);
    expect(clock.clearTimeout).toHaveBeenCalled();
  });

  it("exposes one Y.Doc-backed editor binding per document and emits encrypted incremental packets", async () => {
    const transport = createConnectedTransport();
    const defaults = createDefaultCollabRuntimeAdapters();
    const connection = createWorkspaceRoomRuntime({
      roomId: "room-1",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-1",
      emitInitialWorkspaceState: true,
      documents: [
        { id: "doc-1", title: "README.md", text: "# Hello" },
        { id: "doc-2", title: "Notes.md", text: "Notes" },
      ],
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "README.md",
      adapters: {
        ...defaults,
        createRoomTransport: transport.createRoomTransport,
        roomCheckpointStore: createNoopRoomCheckpointStore(),
        resolveRoomBaseUrl: () => "http://room.test",
      },
    });
    await waitForTasks();
    const firstBinding = connection.getEditorBinding();
    expect(firstBinding?.yText.toString()).toBe("# Hello");
    connection.applyLocalTextPatches([{ from: 7, to: 7, insert: " world" }]);
    connection.setActiveDocument({ documentId: "doc-2", fileTitle: "Notes.md" });
    expect(connection.getEditorBinding()?.yText.toString()).toBe("Notes");
    connection.setActiveDocument(null);
    expect(connection.getEditorBinding()).toBeNull();
    expect(connection.getSnapshot().editorBinding).toBeNull();
    connection.setActiveDocument({ documentId: "doc-2", fileTitle: "Notes.md" });
    await vi.waitFor(() => expect(transport.sent.length).toBeGreaterThan(0));
    expect(connection.getSnapshot().editorBinding?.yText.toString()).toBe("Notes");
    connection.disconnect();
  });

  it("keeps the local active document when a remote workspace transaction arrives", async () => {
    const transport = createConnectedTransport();
    const defaults = createDefaultCollabRuntimeAdapters();
    const connection = createWorkspaceRoomRuntime({
      roomId: "room-1",
      roomKey: VALID_ROOM_KEY,
      documentId: "local-doc",
      emitInitialWorkspaceState: true,
      documents: [
        { id: "local-doc", title: "Local.md", text: "Local" },
        { id: "remote-doc", title: "Remote.md", text: "Remote" },
      ],
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "Local.md",
      adapters: {
        ...defaults,
        createRoomTransport: transport.createRoomTransport,
        roomCheckpointStore: createNoopRoomCheckpointStore(),
        resolveRoomBaseUrl: () => "http://room.test",
      },
    });
    await waitForTasks();
    connection.renameNode("local-doc", "Local renamed.md");
    expect(connection.getEditorBinding()?.yText.toString()).toBe("Local");
    connection.disconnect();
  });

  it("keeps background text in Yjs until that document becomes active", async () => {
    const relay = createMemoryRoomRelay();
    const checkpoints = createMemoryRoomCheckpointStore();
    const defaults = createDefaultCollabRuntimeAdapters();
    const adapters = {
      ...defaults,
      createRoomTransport: relay.createRoomTransport,
      roomCheckpointStore: checkpoints.store,
      resolveRoomBaseUrl: () => "http://memory-room.test",
    };
    const hostTextProjection = vi.fn();
    const host = createWorkspaceRoomRuntime({
      roomId: "room-active-projection",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-a",
      emitInitialWorkspaceState: true,
      documents: [
        { id: "doc-a", title: "A.md", text: "Alpha" },
        { id: "doc-b", title: "B.md", text: "Beta" },
      ],
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "A.md",
      adapters,
    });
    await vi.waitFor(() => expect(checkpoints.getGeneration("room-active-projection")).toBeGreaterThan(0));
    const peer = createWorkspaceRoomRuntime({
      roomId: "room-active-projection",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-b",
      emitInitialWorkspaceState: false,
      identity: { id: "human-2", name: "Sharp Human", color: "#7c3aed", lastSeen: 0 },
      fileTitle: "B.md",
      adapters,
    });
    await vi.waitFor(() => expect(peer.getEditorBinding()?.yText.toString()).toBe("Beta"));
    const unsubscribeHostDocument = host.subscribeDocument("doc-a", hostTextProjection);
    hostTextProjection.mockClear();

    peer.applyLocalTextPatches([{ from: 4, to: 4, insert: " remote" }]);
    await vi.waitFor(() => expect(host.materializeWorkspace().documents["doc-b"]).toBe("Beta remote"));
    await waitForTasks();

    expect(hostTextProjection).not.toHaveBeenCalled();
    unsubscribeHostDocument();
    host.setActiveDocument({ documentId: "doc-b", fileTitle: "B.md" });
    const unsubscribeRemoteDocument = host.subscribeDocument("doc-b", hostTextProjection);
    expect(host.getDocumentTextSnapshot("doc-b")).toBe("Beta remote");
    unsubscribeRemoteDocument();
    host.disconnect();
    peer.disconnect();
  });

  it("keeps undo managers only for the eight most recently active documents", async () => {
    const transport = createConnectedTransport();
    const defaults = createDefaultCollabRuntimeAdapters();
    const documents = Array.from({ length: 12 }, (_, index) => ({
      id: `doc-${index}`,
      title: `Document ${index}.md`,
      text: `Document ${index}`,
    }));
    const runtime = createWorkspaceRoomRuntime({
      roomId: "room-bounded-undo-managers",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-0",
      emitInitialWorkspaceState: true,
      documents,
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "Document 0.md",
      adapters: {
        ...defaults,
        createRoomTransport: transport.createRoomTransport,
        roomCheckpointStore: createNoopRoomCheckpointStore(),
        resolveRoomBaseUrl: () => "http://memory-room.test",
      },
    });
    await vi.waitFor(() => expect(runtime.getSnapshot().status).toBe("connected"));
    expect(runtime.getResourceCounts()).toEqual({
      activeLeases: 1,
      documentHandles: 1,
      documentObservers: 1,
      documentProjectionListeners: 0,
      documentProjectionSnapshots: 0,
      undoManagers: 1,
    });

    for (const document of documents.slice(1)) {
      runtime.setActiveDocument({ documentId: document.id, fileTitle: document.title });
    }

    expect(runtime.getResourceCounts()).toEqual({
      activeLeases: 1,
      documentHandles: 8,
      documentObservers: 1,
      documentProjectionListeners: 0,
      documentProjectionSnapshots: 0,
      undoManagers: 8,
    });
    runtime.disconnect();
  });

  it("converges human and agent edits, workspace changes, comments, and presence through one room document", async () => {
    const relay = createMemoryRoomRelay();
    const checkpoints = createMemoryRoomCheckpointStore();
    const defaults = createDefaultCollabRuntimeAdapters();
    const hostSnapshots: WorkspaceRoomStructureSnapshot[] = [];
    const agentSnapshots: WorkspaceRoomStructureSnapshot[] = [];
    const hostComments: Array<Record<string, unknown[]>> = [];
    const agentComments: Array<Record<string, unknown[]>> = [];
    const adapters = {
      ...defaults,
      createRoomTransport: relay.createRoomTransport,
      roomCheckpointStore: checkpoints.store,
      resolveRoomBaseUrl: () => "http://memory-room.test",
    };
    const host = createWorkspaceRoomRuntime({
      roomId: "room-convergence",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-a",
      emitInitialWorkspaceState: true,
      documents: [
        { id: "doc-a", title: "A.md", text: "Alpha" },
        { id: "doc-b", title: "B.md", text: "Beta" },
      ],
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "A.md",
      onWorkspaceStructureChange: (snapshot) => hostSnapshots.push(snapshot),
      onCommentsChange: (comments) => hostComments.push(comments),
      adapters,
    });
    await vi.waitFor(() => expect(host.getSnapshot().status).toBe("connected"));
    await vi.waitFor(() => expect(checkpoints.getGeneration("room-convergence")).toBeGreaterThan(0));

    const agent = createWorkspaceRoomRuntime({
      roomId: "room-convergence",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-b",
      emitInitialWorkspaceState: false,
      identity: {
        id: "agent-1",
        name: "Curious Agent",
        color: "#7c3aed",
        lastSeen: 0,
        kind: "agent",
        client: "tabula-mcp",
        capabilities: ["presence", "read", "write"],
      },
      fileTitle: "B.md",
      onWorkspaceStructureChange: (snapshot) => agentSnapshots.push(snapshot),
      onCommentsChange: (comments) => agentComments.push(comments),
      adapters,
    });

    await vi.waitFor(() => {
      expect(last(agentSnapshots)?.nodes.map(({ id }) => id)).toEqual(expect.arrayContaining([
        "workspace-root", "doc-a", "doc-b",
      ]));
      expect(agent.materializeDocument("doc-a")).toBe("Alpha");
      expect(agent.materializeDocument("doc-b")).toBe("Beta");
      expect(host.getSnapshot().collaborators[0]).toMatchObject({ id: "agent-1", kind: "agent" });
      expect(agent.getSnapshot().collaborators[0]).toMatchObject({ id: "human-1", kind: "human" });
    });

    host.applyLocalTextPatches([{ from: 5, to: 5, insert: " human" }]);
    agent.applyLocalTextPatches([{ from: 4, to: 4, insert: " agent" }]);
    await vi.waitFor(() => {
      expect(host.getEditorBinding()?.yText.toString()).toBe("Alpha human");
      expect(agent.getEditorBinding()?.yText.toString()).toBe("Beta agent");
    });
    host.setActiveDocument({ documentId: "doc-b", fileTitle: "B.md" });
    agent.setActiveDocument({ documentId: "doc-a", fileTitle: "A.md" });
    await vi.waitFor(() => {
      expect(host.getEditorBinding()?.yText.toString()).toBe("Beta agent");
      expect(agent.getEditorBinding()?.yText.toString()).toBe("Alpha human");
    });

    agent.createFolder({ id: "folder-1", title: "Notes", parentId: "workspace-root", order: 1 });
    agent.renameNode("doc-a", "A renamed.md");
    agent.moveNode("doc-b", "folder-1");
    agent.setNodeOrder("doc-b", 2);
    agent.createDocument({
      id: "doc-c",
      title: "C.md",
      markdown: "Created by agent",
      parentId: "folder-1",
      order: 3,
    });
    await vi.waitFor(() => {
      expect(last(hostSnapshots)?.nodes.map(({ id }) => id)).toHaveLength(5);
      expect(last(hostSnapshots)?.nodes.map(({ id }) => id)).toEqual(expect.arrayContaining([
        "workspace-root", "folder-1", "doc-a", "doc-b", "doc-c",
      ]));
      expect(host.materializeDocument("doc-c")).toBe("Created by agent");
    });

    host.upsertComment({
      id: "comment-1",
      fileId: "doc-a",
      body: "Shared comment",
      authorId: "human-1",
      authorName: "Curious Human",
      createdAt: "2026-07-10T00:00:00.000Z",
      resolved: false,
      replies: [],
    });
    await vi.waitFor(() => expect(last(agentComments)?.["doc-a"]).toHaveLength(1));
    agent.addCommentReply("comment-1", {
      id: "reply-1",
      body: "Agent reply",
      authorId: "agent-1",
      authorName: "Curious Agent",
      createdAt: "2026-07-10T00:00:01.000Z",
    });
    await vi.waitFor(() => {
      const hostReply = (last(hostComments)?.["doc-a"]?.[0] as { replies?: unknown[] } | undefined)?.replies;
      const agentReply = (last(agentComments)?.["doc-a"]?.[0] as { replies?: unknown[] } | undefined)?.replies;
      expect(hostReply).toHaveLength(1);
      expect(agentReply).toHaveLength(1);
    });

    relay.resetSentBytes();
    host.setActiveDocument({ documentId: "doc-a", fileTitle: "A renamed.md" });
    for (let index = 0; index < 100; index += 1) {
      const position = host.getEditorBinding()?.yText.length ?? 0;
      host.applyLocalTextPatches([{ from: position, to: position, insert: "x" }]);
    }
    await vi.waitFor(() => expect(agent.getEditorBinding()?.yText.toString()).toContain("x".repeat(100)));
    expect(relay.getSentBytes()).toBeLessThan(100 * 1024);
    expect(relay.getSentCount()).toBeLessThan(10);

    host.disconnect();
    agent.disconnect();
  });

  it("bounds per-document undo history", async () => {
    const transport = createConnectedTransport();
    const defaults = createDefaultCollabRuntimeAdapters();
    const runtime = createWorkspaceRoomRuntime({
      roomId: "room-bounded-undo",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-a",
      emitInitialWorkspaceState: true,
      documents: [{ id: "doc-a", title: "A.md", text: "" }],
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "A.md",
      adapters: {
        ...defaults,
        createRoomTransport: transport.createRoomTransport,
        roomCheckpointStore: createNoopRoomCheckpointStore(),
        resolveRoomBaseUrl: () => "http://memory-room.test",
      },
    });
    await vi.waitFor(() => expect(runtime.getSnapshot().status).toBe("connected"));
    const documentProjectionListener = vi.fn();
    runtime.subscribeDocument("doc-a", documentProjectionListener);

    const undoManager = runtime.getEditorBinding()!.undoManager;
    for (let index = 0; index < 150; index += 1) {
      const position = runtime.getEditorBinding()!.yText.length;
      runtime.applyLocalTextPatches([{ from: position, to: position, insert: "x" }]);
      undoManager.stopCapturing();
    }

    expect(undoManager.undoStack.length).toBeLessThanOrEqual(100);
    await vi.waitFor(() => expect(documentProjectionListener).toHaveBeenCalled());
    expect(runtime.getDocumentTextSnapshot("doc-a")).toBe("x".repeat(150));
    runtime.disconnect();
  });

  it("coalesces repeated peer announcements while encryption is in flight", async () => {
    const transport = createConnectedTransport();
    const defaults = createDefaultCollabRuntimeAdapters();
    let encryptionGate: Promise<void> | null = null;
    let releaseEncryption: (() => void) | undefined;
    const encryptEnvelope = vi.fn(async (
      ...args: Parameters<typeof defaults.crypto.encryptEnvelope>
    ) => {
      if (encryptionGate) await encryptionGate;
      return defaults.crypto.encryptEnvelope(...args);
    });
    const runtime = createWorkspaceRoomRuntime({
      roomId: "room-bounded-sync",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-a",
      emitInitialWorkspaceState: true,
      documents: [{ id: "doc-a", title: "A.md", text: "" }],
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "A.md",
      adapters: {
        ...defaults,
        crypto: { ...defaults.crypto, encryptEnvelope },
        createRoomTransport: transport.createRoomTransport,
        roomCheckpointStore: createNoopRoomCheckpointStore(),
        resolveRoomBaseUrl: () => "http://memory-room.test",
      },
    });
    await vi.waitFor(() => expect(runtime.getSnapshot().status).toBe("connected"));
    await waitForTasks();
    encryptEnvelope.mockClear();

    encryptionGate = new Promise<void>((resolve) => { releaseEncryption = resolve; });
    for (let index = 0; index < 100; index += 1) {
      transport.getHandlers()?.onPeerJoined({ roomId: "room-bounded-sync", clientId: `peer-${index}` });
    }
    await vi.waitFor(() => expect(encryptEnvelope).toHaveBeenCalledTimes(1));
    encryptionGate = null;
    releaseEncryption?.();
    await vi.waitFor(() => expect(encryptEnvelope).toHaveBeenCalledTimes(4));

    expect(encryptEnvelope).toHaveBeenCalledTimes(4);
    runtime.disconnect();
  });

  it("rejects oversized encrypted envelopes before decrypting or buffering them", async () => {
    const transport = createConnectedTransport();
    const defaults = createDefaultCollabRuntimeAdapters();
    const decryptEnvelope = vi.fn(defaults.crypto.decryptEnvelope);
    const runtime = createWorkspaceRoomRuntime({
      roomId: "room-bounded-inbox",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-a",
      emitInitialWorkspaceState: true,
      documents: [{ id: "doc-a", title: "A.md", text: "" }],
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "A.md",
      adapters: {
        ...defaults,
        crypto: { ...defaults.crypto, decryptEnvelope },
        createRoomTransport: transport.createRoomTransport,
        roomCheckpointStore: createNoopRoomCheckpointStore(),
        resolveRoomBaseUrl: () => "http://memory-room.test",
      },
    });
    await vi.waitFor(() => expect(runtime.getSnapshot().status).toBe("connected"));

    transport.getHandlers()?.onMessage({
      v: 1,
      roomId: "room-bounded-inbox",
      kind: "room-event",
      version: 1,
      iv: "A".repeat(16),
      ciphertext: "A".repeat(512 * 1024),
      createdAt: "2026-07-11T00:00:00.000Z",
    });
    await waitForTasks();

    expect(decryptEnvelope).not.toHaveBeenCalled();
    runtime.disconnect();
  });

  it("bounds encrypted messages waiting for decryption", async () => {
    const transport = createConnectedTransport();
    const defaults = createDefaultCollabRuntimeAdapters();
    let releaseFirstDecrypt: (() => void) | undefined;
    const firstDecryptGate = new Promise<void>((resolve) => { releaseFirstDecrypt = resolve; });
    let firstDecrypt = true;
    const decryptEnvelope = vi.fn(async () => {
      if (firstDecrypt) {
        firstDecrypt = false;
        await firstDecryptGate;
      }
      throw new Error("invalid ciphertext");
    });
    const runtime = createWorkspaceRoomRuntime({
      roomId: "room-bounded-decryption",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-a",
      emitInitialWorkspaceState: true,
      documents: [{ id: "doc-a", title: "A.md", text: "" }],
      identity: { id: "human-1", name: "Curious Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "A.md",
      adapters: {
        ...defaults,
        crypto: { ...defaults.crypto, decryptEnvelope },
        createRoomTransport: transport.createRoomTransport,
        roomCheckpointStore: createNoopRoomCheckpointStore(),
        resolveRoomBaseUrl: () => "http://memory-room.test",
      },
    });
    await vi.waitFor(() => expect(runtime.getSnapshot().status).toBe("connected"));

    for (let index = 0; index < 100; index += 1) {
      transport.getHandlers()?.onMessage({
        v: 1,
        roomId: "room-bounded-decryption",
        kind: "room-event",
        version: index + 1,
        iv: "A".repeat(16),
        ciphertext: "A".repeat(32),
        createdAt: "2026-07-11T00:00:00.000Z",
      });
    }
    await vi.waitFor(() => expect(decryptEnvelope).toHaveBeenCalledTimes(1));
    releaseFirstDecrypt?.();
    await vi.waitFor(() => expect(decryptEnvelope).toHaveBeenCalledTimes(65));

    expect(decryptEnvelope).toHaveBeenCalledTimes(65);
    runtime.disconnect();
  });

  it("does not resurrect a deleted document when a stale peer reconnects", async () => {
    const relay = createMemoryRoomRelay();
    const checkpoints = createMemoryRoomCheckpointStore();
    const defaults = createDefaultCollabRuntimeAdapters();
    const adapters = {
      ...defaults,
      createRoomTransport: relay.createRoomTransport,
      roomCheckpointStore: checkpoints.store,
      resolveRoomBaseUrl: () => "http://memory-room.test",
    };
    const hostSnapshots: WorkspaceRoomStructureSnapshot[] = [];
    const peerSnapshots: WorkspaceRoomStructureSnapshot[] = [];
    const host = createWorkspaceRoomRuntime({
      roomId: "room-stale-peer",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-a",
      emitInitialWorkspaceState: true,
      documents: [
        { id: "doc-a", title: "Delete me.md", text: "old" },
        { id: "doc-b", title: "Keep me.md", text: "current" },
      ],
      identity: { id: "host", name: "Steady Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "Delete me.md",
      onWorkspaceStructureChange: (snapshot) => hostSnapshots.push(snapshot),
      adapters,
    });
    await vi.waitFor(() => expect(checkpoints.getGeneration("room-stale-peer")).toBeGreaterThan(0));
    const peer = createWorkspaceRoomRuntime({
      roomId: "room-stale-peer",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-a",
      emitInitialWorkspaceState: false,
      identity: { id: "peer", name: "Calm Human", color: "#0f766e", lastSeen: 0 },
      fileTitle: "Delete me.md",
      onWorkspaceStructureChange: (snapshot) => peerSnapshots.push(snapshot),
      adapters,
    });
    await vi.waitFor(() => {
      expect(last(peerSnapshots)?.nodes.some(({ id }) => id === "doc-a")).toBe(true);
      expect(peer.materializeDocument("doc-a")).toBe("old");
    });

    relay.setOnline("peer", false);
    peer.applyLocalTextPatches([{ from: 3, to: 3, insert: " stale edit" }]);
    host.renameNode("doc-b", "Kept and renamed.md");
    host.deleteNode("doc-a");
    await vi.waitFor(() => {
      expect(last(hostSnapshots)?.nodes.some(({ id }) => id === "doc-a")).toBe(false);
      expect(host.materializeDocument("doc-b")).toBe("current");
    });

    relay.setOnline("peer", true);
    await vi.waitFor(() => {
      expect(last(peerSnapshots)?.nodes.some(({ id }) => id === "doc-a")).toBe(false);
      expect(last(hostSnapshots)?.nodes.some(({ id }) => id === "doc-a")).toBe(false);
      expect(peer.materializeDocument("doc-b")).toBe("current");
    });

    host.disconnect();
    peer.disconnect();
  });

  it("delivers edits made while offline after reconnecting", async () => {
    const relay = createMemoryRoomRelay();
    const checkpoints = createMemoryRoomCheckpointStore();
    const defaults = createDefaultCollabRuntimeAdapters();
    const adapters = {
      ...defaults,
      createRoomTransport: relay.createRoomTransport,
      roomCheckpointStore: checkpoints.store,
      resolveRoomBaseUrl: () => "http://memory-room.test",
    };
    const host = createWorkspaceRoomRuntime({
      roomId: "room-offline-edit",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc",
      emitInitialWorkspaceState: true,
      documents: [{ id: "doc", title: "README.md", text: "Online" }],
      identity: { id: "host", name: "Steady Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "README.md",
      adapters,
    });
    await vi.waitFor(() => expect(checkpoints.getGeneration("room-offline-edit")).toBeGreaterThan(0));
    const peer = createWorkspaceRoomRuntime({
      roomId: "room-offline-edit",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc",
      emitInitialWorkspaceState: false,
      identity: { id: "peer", name: "Calm Human", color: "#0f766e", lastSeen: 0 },
      fileTitle: "README.md",
      adapters,
    });
    await vi.waitFor(() => expect(peer.getEditorBinding()?.yText.toString()).toBe("Online"));

    relay.setOnline("host", false);
    expect(host.applyLocalTextPatches([{ from: 6, to: 6, insert: " offline" }])).toBe(true);
    await waitForTasks();
    expect(host.getEditorBinding()?.yText.toString()).toBe("Online offline");
    expect(peer.getEditorBinding()?.yText.toString()).toBe("Online");

    relay.setOnline("host", true);
    await vi.waitFor(() => {
      expect(host.getSnapshot().status).toBe("connected");
      expect(peer.getEditorBinding()?.yText.toString()).toBe("Online offline");
    });

    host.disconnect();
    peer.disconnect();
  });

  it("disambiguates duplicate awareness names and attributes remote workspace changes", async () => {
    const relay = createMemoryRoomRelay();
    const checkpoints = createMemoryRoomCheckpointStore();
    const defaults = createDefaultCollabRuntimeAdapters();
    const adapters = {
      ...defaults,
      createRoomTransport: relay.createRoomTransport,
      roomCheckpointStore: checkpoints.store,
      resolveRoomBaseUrl: () => "http://memory-room.test",
    };
    const hostOrigins: Array<{ actorId: string; actorName?: string } | undefined> = [];
    const host = createWorkspaceRoomRuntime({
      roomId: "room-duplicate-names",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc",
      emitInitialWorkspaceState: true,
      documents: [{ id: "doc", title: "README.md", text: "text" }],
      identity: { id: "z-host", name: "Nimble Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "README.md",
      onWorkspaceStructureChange: (_snapshot, origin) => hostOrigins.push(origin),
      adapters,
    });
    await vi.waitFor(() => expect(checkpoints.getGeneration("room-duplicate-names")).toBeGreaterThan(0));
    const peer = createWorkspaceRoomRuntime({
      roomId: "room-duplicate-names",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc",
      emitInitialWorkspaceState: false,
      identity: { id: "a-peer", name: "Nimble Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "README.md",
      adapters,
    });

    await vi.waitFor(() => expect(host.getSnapshot().collaborators).toHaveLength(1));
    await vi.waitFor(() => {
      const states = [...(host.getEditorBinding()?.awareness.getStates().values() ?? [])];
      const presentations = Object.fromEntries(states.map((state) => [state.actor?.id, state.user]));
      expect(presentations).toMatchObject({
        "a-peer": { name: "Nimble Human", color: "#2563eb" },
        "z-host": { name: "Nimble Human 2", color: "#0f766e" },
      });
    });

    peer.renameNode("doc", "Renamed.md");
    await vi.waitFor(() => expect(hostOrigins).toContainEqual({
      actorId: "a-peer",
      actorName: "Nimble Human",
    }));

    host.disconnect();
    peer.disconnect();
  });

  it("converges to a valid room with no documents", async () => {
    const relay = createMemoryRoomRelay();
    const checkpoints = createMemoryRoomCheckpointStore();
    const defaults = createDefaultCollabRuntimeAdapters();
    const adapters = {
      ...defaults,
      createRoomTransport: relay.createRoomTransport,
      roomCheckpointStore: checkpoints.store,
      resolveRoomBaseUrl: () => "http://memory-room.test",
    };
    const peerSnapshots: WorkspaceRoomStructureSnapshot[] = [];
    const host = createWorkspaceRoomRuntime({
      roomId: "room-empty",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc-a",
      emitInitialWorkspaceState: true,
      documents: [{ id: "doc-a", title: "A.md", text: "Alpha" }],
      identity: { id: "host", name: "Steady Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "A.md",
      adapters,
    });
    await vi.waitFor(() => expect(checkpoints.getGeneration("room-empty")).toBeGreaterThan(0));
    const peer = createWorkspaceRoomRuntime({
      roomId: "room-empty",
      roomKey: VALID_ROOM_KEY,
      documentId: "room-bootstrap",
      emitInitialWorkspaceState: false,
      identity: { id: "peer", name: "Calm Human", color: "#0f766e", lastSeen: 0 },
      onWorkspaceStructureChange: (nextSnapshot) => peerSnapshots.push(nextSnapshot),
      adapters,
    });

    await vi.waitFor(() => {
      expect(last(peerSnapshots)?.nodes.some(({ id }) => id === "doc-a")).toBe(true);
      expect(peer.materializeDocument("doc-a")).toBe("Alpha");
    });
    host.deleteNode("doc-a");
    await vi.waitFor(() => {
      expect(last(peerSnapshots)?.nodes.map(({ id }) => id)).toEqual(["workspace-root"]);
      expect(peer.materializeDocument("doc-a")).toBeNull();
    });

    peer.createDocument({
      id: "doc-b",
      title: "B.md",
      markdown: "Beta",
      parentId: "workspace-root",
    });
    await vi.waitFor(() => {
      expect(last(peerSnapshots)?.nodes.some(({ id }) => id === "doc-b")).toBe(true);
      expect(peer.materializeDocument("doc-b")).toBe("Beta");
    });

    host.disconnect();
    peer.disconnect();
  });

  it("merges the latest encrypted checkpoint and retries once after a CAS conflict", async () => {
    const remoteRoom = createWorkspaceRoomCrdt({ roomId: "room-cas" });
    initializeWorkspaceRoomCrdt(remoteRoom, {
      nodes: [{ id: "remote-doc", type: "document", title: "Remote.md", markdown: "remote" }],
    });
    const encryptedRemote = await encryptWorkspaceRoomCheckpoint({
      roomId: "room-cas",
      roomKey: VALID_ROOM_KEY,
      update: Y.encodeStateAsUpdate(remoteRoom.doc),
    });
    const loadEncryptedCheckpoint = vi.fn<RoomCheckpointStore["loadEncryptedCheckpoint"]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        status: "ready",
        generation: 1,
        encryptedCheckpoint: encryptedRemote,
        expiresAt: Date.now() + 10_000,
      });
    const saveEncryptedCheckpoint = vi.fn<RoomCheckpointStore["saveEncryptedCheckpoint"]>()
      .mockResolvedValueOnce({ ok: false, reason: "conflict", generation: 1 })
      .mockResolvedValueOnce({ ok: true, generation: 2 });
    const checkpointStore: RoomCheckpointStore = {
      enabled: true,
      loadEncryptedCheckpoint,
      saveEncryptedCheckpoint,
    };
    const relay = createMemoryRoomRelay();
    const defaults = createDefaultCollabRuntimeAdapters();
    const snapshots: WorkspaceRoomStructureSnapshot[] = [];
    const connection = createWorkspaceRoomRuntime({
      roomId: "room-cas",
      roomKey: VALID_ROOM_KEY,
      documentId: "local-doc",
      emitInitialWorkspaceState: true,
      documents: [{ id: "local-doc", title: "Local.md", text: "local" }],
      identity: { id: "leader", name: "Steady Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "Local.md",
      onWorkspaceStructureChange: (snapshot) => snapshots.push(snapshot),
      adapters: {
        ...defaults,
        createRoomTransport: relay.createRoomTransport,
        roomCheckpointStore: checkpointStore,
        resolveRoomBaseUrl: () => "http://memory-room.test",
      },
    });

    await vi.waitFor(() => expect(saveEncryptedCheckpoint).toHaveBeenCalledTimes(2));
    expect(saveEncryptedCheckpoint.mock.calls[0][1].expectedGeneration).toBe(0);
    expect(saveEncryptedCheckpoint.mock.calls[1][1].expectedGeneration).toBe(1);
    await vi.waitFor(() => {
      expect(last(snapshots)?.nodes.map(({ id }) => id)).toEqual(expect.arrayContaining([
        "workspace-root", "local-doc", "remote-doc",
      ]));
      expect(connection.materializeDocument("local-doc")).toBe("local");
      expect(connection.materializeDocument("remote-doc")).toBe("remote");
    });

    connection.disconnect();
    remoteRoom.doc.destroy();
  });

  it("converges explicit workspace commands through Yjs updates", async () => {
    const relay = createMemoryRoomRelay();
    const checkpoints = createMemoryRoomCheckpointStore();
    const defaults = createDefaultCollabRuntimeAdapters();
    const adapters = {
      ...defaults,
      createRoomTransport: relay.createRoomTransport,
      roomCheckpointStore: checkpoints.store,
      resolveRoomBaseUrl: () => "http://memory-room.test",
    };
    const host = createWorkspaceRoomRuntime({
      roomId: "room-commands",
      roomKey: VALID_ROOM_KEY,
      documentId: "readme",
      emitInitialWorkspaceState: true,
      documents: [{ id: "readme", title: "README.md", text: "Read me" }],
      identity: { id: "host", name: "Steady Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "README.md",
      adapters,
    });
    await vi.waitFor(() => expect(checkpoints.getGeneration("room-commands")).toBeGreaterThan(0));
    const peer = createWorkspaceRoomRuntime({
      roomId: "room-commands",
      roomKey: VALID_ROOM_KEY,
      documentId: "readme",
      emitInitialWorkspaceState: false,
      identity: { id: "peer", name: "Curious Human", color: "#7c3aed", lastSeen: 0 },
      fileTitle: "README.md",
      adapters,
    });
    await vi.waitFor(() => expect(peer.materializeDocument("readme")).toBe("Read me"));

    expect(host.createFolder({ id: "docs", title: "Docs" })).toBe(true);
    expect(host.createDocument({
      id: "guide",
      title: "Guide.md",
      parentId: "docs",
      markdown: "Guide",
    })).toBe(true);
    expect(host.renameNode("guide", "Start.md")).toBe(true);
    expect(host.setNodeOrder("guide", 4)).toBe(true);

    await vi.waitFor(() => {
      expect(peer.getStructureSnapshot().nodes.find((node) => node.id === "guide")).toMatchObject({
        title: "Start.md",
        parentId: "docs",
        order: 4,
      });
      expect(peer.materializeDocument("guide")).toBe("Guide");
    });

    expect(host.deleteNode("docs")).toBe(true);
    await vi.waitFor(() => {
      expect(peer.getStructureSnapshot().nodes.some((node) => node.id === "docs")).toBe(false);
      expect(peer.getStructureSnapshot().nodes.some((node) => node.id === "guide")).toBe(false);
    });

    host.disconnect();
    peer.disconnect();
  });

  it("ignores direct updates from an actor that did not advertise write capability", async () => {
    const relay = createMemoryRoomRelay();
    const checkpoints = createMemoryRoomCheckpointStore();
    const defaults = createDefaultCollabRuntimeAdapters();
    const adapters = {
      ...defaults,
      createRoomTransport: relay.createRoomTransport,
      roomCheckpointStore: checkpoints.store,
      resolveRoomBaseUrl: () => "http://memory-room.test",
    };
    const host = createWorkspaceRoomRuntime({
      roomId: "room-read-only",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc",
      emitInitialWorkspaceState: true,
      documents: [{ id: "doc", title: "README.md", text: "original" }],
      identity: { id: "host", name: "Steady Human", color: "#2563eb", lastSeen: 0 },
      fileTitle: "README.md",
      adapters,
    });
    await vi.waitFor(() => expect(checkpoints.getGeneration("room-read-only")).toBeGreaterThan(0));
    const reader = createWorkspaceRoomRuntime({
      roomId: "room-read-only",
      roomKey: VALID_ROOM_KEY,
      documentId: "doc",
      emitInitialWorkspaceState: false,
      identity: {
        id: "reader",
        name: "Quiet Agent",
        color: "#7c3aed",
        lastSeen: 0,
        kind: "agent",
        client: "tabula-mcp",
        capabilities: ["presence", "read"],
      },
      fileTitle: "README.md",
      adapters,
    });
    await vi.waitFor(() => expect(reader.getEditorBinding()?.yText.toString()).toBe("original"));

    reader.applyLocalText("forged");
    await waitForTasks();
    expect(host.getEditorBinding()?.yText.toString()).toBe("original");

    host.disconnect();
    reader.disconnect();
  });
});
