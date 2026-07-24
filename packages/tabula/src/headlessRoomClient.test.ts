import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "./data/base64Url";
import {
  createHeadlessRoomClient,
  createHeadlessRoomSyncAdapters,
} from "./roomClient";
import { createRoomActor } from "./roomCollaboration";
import type { EncryptedEnvelope } from "./roomProtocol";
import type {
  LoadedWorkspaceRoomCheckpoint,
  SaveWorkspaceRoomCheckpointRequest,
  WorkspaceRoomCheckpointStore,
} from "./workspaceRoomCheckpoint";
import type { WorkspaceRoomSnapshot } from "./workspaceRoomModel";
import type {
  WorkspaceRoomSyncClock,
  WorkspaceRoomTransport,
  WorkspaceRoomTransportHandlers,
} from "./workspaceRoomSync";

class FakeRoomRelay {
  constructor(private readonly dropEnvelopes = false) {}

  private readonly peers = new Map<string, {
    roomId: string;
    handlers: WorkspaceRoomTransportHandlers;
    isConnected: () => boolean;
  }>();

  private connectedPeers(roomId: string) {
    return [...this.peers.entries()].filter(([, peer]) => peer.roomId === roomId && peer.isConnected());
  }

  createTransport = ({
    roomId,
    clientId,
    handlers,
  }: {
    baseUrl: string;
    roomId: string;
    clientId: string;
    handlers: WorkspaceRoomTransportHandlers;
  }): WorkspaceRoomTransport => {
    let connected = false;
    const transport = {
      get connected() {
        return connected;
      },
      connect: () => {
        if (connected) return;
        const existing = this.connectedPeers(roomId);
        connected = true;
        handlers.onConnect();
        handlers.onJoined({ roomId, clientId, peerCount: existing.length });
        existing.forEach(([, peer]) => peer.handlers.onPeerJoined({ roomId, clientId }));
        this.publishPeers(roomId);
      },
      sendEnvelope: (envelope: EncryptedEnvelope) => {
        if (this.dropEnvelopes) return;
        queueMicrotask(() => {
          this.connectedPeers(roomId).forEach(([peerId, peer]) => {
            if (peerId !== clientId) {
              peer.handlers.onMessage(envelope);
            }
          });
        });
      },
      sendVolatileEnvelope: (envelope: EncryptedEnvelope) => {
        if (this.dropEnvelopes) return;
        queueMicrotask(() => {
          this.connectedPeers(roomId).forEach(([peerId, peer]) => {
            if (peerId !== clientId) {
              peer.handlers.onMessage(envelope);
            }
          });
        });
      },
      disconnect: () => {
        if (!connected) return;
        connected = false;
        this.peers.delete(clientId);
        handlers.onDisconnect();
        this.publishPeers(roomId);
      },
    };
    this.peers.set(clientId, { roomId, handlers, isConnected: () => connected });
    return transport;
  };

  private publishPeers(roomId: string) {
    const connected = this.connectedPeers(roomId);
    const peerIds = connected.map(([peerId]) => peerId);
    connected.forEach(([, peer]) => peer.handlers.onPeers({ roomId, peers: peerIds }));
  }
}

class MemoryCheckpointStore implements WorkspaceRoomCheckpointStore {
  readonly enabled = true;
  saveCount = 0;
  value: LoadedWorkspaceRoomCheckpoint | null = null;

  async loadEncryptedCheckpoint() {
    return this.value;
  }

  async saveEncryptedCheckpoint(_roomId: string, request: SaveWorkspaceRoomCheckpointRequest) {
    this.saveCount += 1;
    const currentGeneration = this.value?.generation ?? 0;
    if (request.expectedGeneration !== currentGeneration) {
      return { ok: false as const, reason: "conflict" as const, generation: currentGeneration };
    }
    this.value = {
      status: "ready",
      generation: currentGeneration + 1,
      encryptedCheckpoint: request.encryptedCheckpoint,
      expiresAt: request.expiresAt,
    };
    return { ok: true as const, generation: currentGeneration + 1 };
  }
}

class ManualClock implements WorkspaceRoomSyncClock {
  private now = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { callback: () => void; dueAt: number }>();

  clearTimeout(handle: unknown) {
    this.timers.delete(handle as number);
  }

  setTimeout(callback: () => void, delayMs: number) {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { callback, dueAt: this.now + delayMs });
    return id;
  }

  createId() {
    const id = `manual-${this.nextId}`;
    this.nextId += 1;
    return id;
  }

  advanceBy(durationMs: number) {
    const target = this.now + durationMs;
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt || left[0] - right[0])[0];
      if (!next) break;
      const [id, timer] = next;
      this.timers.delete(id);
      this.now = timer.dueAt;
      timer.callback();
    }
    this.now = target;
  }
}

const roomId = "headless-room";
const roomKey = encodeBase64Url(new Uint8Array(32).fill(7));
const roomUrl = `https://tabula.md/#room=${roomId},${roomKey}`;
const timestamp = "2026-07-18T00:00:00.000Z";

const initialWorkspace = (): WorkspaceRoomSnapshot => ({
  roomId,
  schemaVersion: 2,
  rootId: "workspace-root",
  nodes: [
    {
      id: "workspace-root",
      type: "folder",
      parentId: null,
      title: "Workspace",
      order: 0,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
    {
      id: "brief",
      type: "document",
      parentId: "workspace-root",
      title: "brief.md",
      order: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  documents: { brief: "# Brief\n" },
  commentsByFileId: {},
});

const createClient = ({
  relay,
  actorId,
  initial,
  checkpointStore,
  clock,
}: {
  relay: FakeRoomRelay;
  actorId: string;
  initial?: WorkspaceRoomSnapshot;
  checkpointStore?: WorkspaceRoomCheckpointStore;
  clock?: WorkspaceRoomSyncClock;
}) => createHeadlessRoomClient({
  roomUrl,
  roomServerUrl: "https://room.test",
  actor: createRoomActor({
    id: actorId,
    kind: "agent",
    client: "tabula-cli",
    name: actorId,
  }),
  adapters: createHeadlessRoomSyncAdapters({ createRoomTransport: relay.createTransport, clock }),
  checkpointStore,
  initialWorkspace: initial,
});

const waitFor = async (condition: () => boolean, timeoutMs = 2_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for headless Room state.");
};

describe("headless Room client", () => {
  it("synchronizes workspace operations, comments, and presence between clients", async () => {
    const relay = new FakeRoomRelay();
    const first = await createClient({ relay, actorId: "first-agent", initial: initialWorkspace() });
    const second = await createClient({ relay, actorId: "second-agent" });

    try {
      await first.connect();
      await second.connect({ waitForStateMs: 500, waitForPresenceMs: 500 });
      expect(second.getState().lastError).toBeUndefined();
      await waitFor(() => second.getState().hydrationStatus === "ready");
      expect(second.getState()).toMatchObject({
        presenceStatus: "ready",
        connectedPeerCount: 1,
      });
      expect(second.getWorkspaceSnapshot().documents.brief).toBe("# Brief\n");
      const staleBrief = await first.readDocument("brief");
      await waitFor(() => first.getState().collaborators.length === 1);
      expect(first.getState().collaborators[0]?.actor.id).toBe("second-agent");

      first.setPresence({
        activeDocumentId: "brief",
        fileTitle: "brief.md",
        presenceState: "idle",
        selection: { documentId: "brief", from: 2, to: 7 },
      });
      await waitFor(() => {
        const collaborator = second.getState().collaborators[0];
        return collaborator?.selection?.from === 2 && collaborator.presenceState === "idle";
      });
      expect(second.getState().collaborators[0]?.presenceState).toBe("idle");

      const brief = await second.readDocument("brief");
      await second.writeDocument({
        documentId: "brief",
        markdown: "New # Brief\n\nEdited by the second agent.\n",
        expectedRevision: brief.revision,
        preferredPatches: [
          { from: 0, to: 0, insert: "New " },
          { from: brief.markdown.length, to: brief.markdown.length, insert: "\nEdited by the second agent.\n" },
        ],
      });
      await waitFor(() => first.getWorkspaceSnapshot().documents.brief?.includes("second agent") === true);
      await waitFor(() => second.getState().collaborators[0]?.selection?.from === 6);
      expect(second.getState().collaborators[0]?.selection).toEqual({
        documentId: "brief",
        from: 6,
        to: 11,
      });
      await expect(first.writeDocument({
        documentId: "brief",
        markdown: "# Stale overwrite\n",
        expectedRevision: staleBrief.revision,
      })).rejects.toThrow("changed before the operation");

      const { folderId } = await second.createFolder({ folderId: "research", title: "Research" });
      await second.moveNode({ nodeId: "brief", parentId: folderId });
      await second.renameNode({ nodeId: "brief", title: "review.md" });
      await waitFor(() => first.getWorkspaceSnapshot().nodes.some(
        (node) => node.id === "brief" && node.parentId === "research" && node.title === "review.md",
      ));
      expect(first.getWorkspaceSnapshot().nodes.find((node) => node.id === "brief")?.updatedBy).toMatchObject({
        id: "second-agent",
        kind: "agent",
        client: "tabula-cli",
      });
      expect(first.getWorkspaceSnapshot().nodes.find((node) => node.id === "research")?.createdBy).toMatchObject({
        id: "second-agent",
        kind: "agent",
        client: "tabula-cli",
      });

      await second.upsertComment({
        id: "comment-1",
        fileId: "brief",
        body: "Please verify this section.",
        resolved: false,
        createdAt: timestamp,
        replies: [],
      });
      await waitFor(() => first.getWorkspaceSnapshot().commentsByFileId.brief?.length === 1);
      await first.setCommentResolved("comment-1", true);
      await waitFor(() => second.getWorkspaceSnapshot().commentsByFileId.brief?.[0]?.resolved === true);

      const current = await first.readDocument("brief");
      await first.deleteNode({ nodeId: "brief", expected: { revision: current.revision } });
      await waitFor(() => !second.getWorkspaceSnapshot().nodes.some((node) => node.id === "brief"));
      await second.disconnect();
      await waitFor(() => first.getState().connectedPeerCount === 0);
      expect(first.getState()).toMatchObject({
        presenceStatus: "ready",
        connectedPeerCount: 0,
        collaborators: [],
      });
    } finally {
      await Promise.all([first.disconnect(), second.disconnect()]);
    }
  });

  it("reports degraded presence instead of claiming zero collaborators before awareness converges", async () => {
    const checkpointStore = new MemoryCheckpointStore();
    const relay = new FakeRoomRelay(true);
    const first = await createClient({
      relay,
      actorId: "presence-writer",
      initial: initialWorkspace(),
      checkpointStore,
    });
    const second = await createClient({
      relay,
      actorId: "presence-reader",
      checkpointStore,
    });

    try {
      await first.connect();
      await first.flushCheckpoint();
      const state = await second.connect({ waitForStateMs: 0, waitForPresenceMs: 10 });
      expect(state).toMatchObject({
        hydrationStatus: "ready",
        presenceStatus: "degraded",
        connectedPeerCount: 1,
        collaborators: [],
      });
    } finally {
      await Promise.all([first.disconnect(), second.disconnect()]);
    }
  });

  it("applies multi-node changes atomically", async () => {
    const client = await createClient({
      relay: new FakeRoomRelay(),
      actorId: "batch-agent",
      initial: initialWorkspace(),
    });

    try {
      await client.connect();
      await expect(client.applyChanges([
        { type: "folder.create", folderId: "research", title: "Research" },
        {
          type: "document.create",
          documentId: "notes",
          parentId: "research",
          title: "notes.md",
          markdown: "# Notes\n",
        },
        { type: "node.update", nodeId: "missing", title: "missing.md" },
      ])).rejects.toThrow("Workspace node was not found: missing");

      expect(client.getWorkspaceSnapshot().nodes.some((node) => node.id === "research")).toBe(false);
      expect(client.getWorkspaceSnapshot().nodes.some((node) => node.id === "notes")).toBe(false);

      const results = await client.applyChanges([
        { type: "folder.create", folderId: "research", title: "Research" },
        {
          type: "document.create",
          documentId: "notes",
          parentId: "research",
          title: "notes.md",
          markdown: "# Notes\n",
        },
        {
          type: "document.create",
          documentId: "sources",
          parentId: "research",
          title: "sources.md",
          markdown: "# Sources\n",
        },
      ]);

      expect(results).toEqual([
        { type: "folder.create", folderId: "research" },
        { type: "document.create", documentId: "notes" },
        { type: "document.create", documentId: "sources" },
      ]);
      expect(client.getWorkspaceSnapshot().documents).toMatchObject({
        notes: "# Notes\n",
        sources: "# Sources\n",
      });
    } finally {
      await client.disconnect();
    }
  });

  it("restores a validated encrypted checkpoint without a live peer", async () => {
    const checkpointStore = new MemoryCheckpointStore();
    const relay = new FakeRoomRelay();
    const writer = await createClient({
      relay,
      actorId: "checkpoint-writer",
      initial: initialWorkspace(),
      checkpointStore,
    });

    await writer.connect();
    await writer.flushCheckpoint();
    expect(checkpointStore.value?.status).toBe("ready");
    expect(new TextDecoder().decode(
      checkpointStore.value?.status === "ready" ? checkpointStore.value.encryptedCheckpoint : new Uint8Array(),
    )).not.toContain("# Brief");
    await writer.disconnect();

    const restored = await createClient({
      relay: new FakeRoomRelay(),
      actorId: "checkpoint-reader",
      checkpointStore,
    });
    try {
      const state = await restored.connect({ waitForStateMs: 0 });
      expect(state.hydrationStatus).toBe("ready");
      expect(state.checkpointStatus).toBe("loaded");
      expect(restored.getWorkspaceSnapshot().documents.brief).toBe("# Brief\n");
    } finally {
      await restored.disconnect();
    }
  });

  it("allows only the lowest actor id to persist a room checkpoint", async () => {
    const checkpointStore = new MemoryCheckpointStore();
    const relay = new FakeRoomRelay();
    const follower = await createClient({
      relay,
      actorId: "z-follower",
      initial: initialWorkspace(),
      checkpointStore,
    });
    const leader = await createClient({
      relay,
      actorId: "a-leader",
      checkpointStore,
    });

    try {
      await follower.connect();
      await leader.connect({ waitForStateMs: 500, waitForPresenceMs: 500 });
      await waitFor(() =>
        follower.getState().collaborators.length === 1 &&
        leader.getState().collaborators.length === 1);
      checkpointStore.saveCount = 0;

      await Promise.all([follower.flushCheckpoint(), leader.flushCheckpoint()]);

      expect(checkpointStore.saveCount).toBe(1);
    } finally {
      await Promise.all([follower.disconnect(), leader.disconnect()]);
    }
  });

  it("persists continuous headless edits within twenty seconds", async () => {
    const checkpointStore = new MemoryCheckpointStore();
    const relay = new FakeRoomRelay();
    const clock = new ManualClock();
    const client = await createClient({
      relay,
      actorId: "checkpoint-leader",
      initial: initialWorkspace(),
      checkpointStore,
      clock,
    });

    try {
      await client.connect();
      checkpointStore.saveCount = 0;
      for (let index = 0; index < 5; index += 1) {
        const current = await client.readDocument("brief");
        await client.writeDocument({
          documentId: "brief",
          markdown: `${current.markdown}edit-${index}\n`,
          expectedRevision: current.revision,
        });
        if (index < 4) clock.advanceBy(4_000);
      }
      expect(checkpointStore.saveCount).toBe(0);

      clock.advanceBy(4_000);
      await waitFor(() => checkpointStore.saveCount === 1);
    } finally {
      await client.disconnect();
    }
  });
});
