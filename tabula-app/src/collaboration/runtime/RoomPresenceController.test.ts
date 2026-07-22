import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  createRoomActor,
  createWorkspaceRoomCrdt,
  initializeWorkspaceRoomCrdt,
  WORKSPACE_ROOM_ROOT_ID,
} from "@tabula-md/tabula";
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { createRoomPresenceController } from "./RoomPresenceController";

const resources: Array<{ destroy(): void }> = [];

afterEach(() => {
  while (resources.length > 0) resources.pop()?.destroy();
});

const createRoom = () => {
  const room = createWorkspaceRoomCrdt({ roomId: "room-1" });
  initializeWorkspaceRoomCrdt(room, {
    nodes: [{
      id: "doc-1",
      type: "document",
      parentId: WORKSPACE_ROOM_ROOT_ID,
      title: "README.md",
      markdown: "hello world",
    }],
  });
  const awareness = new Awareness(room.doc);
  resources.push(awareness, room.doc);
  const controller = createRoomPresenceController({
    room,
    roomId: "room-1",
    awareness,
    identity: {
      id: "human-1",
      name: "Curious Human",
      color: "#2563eb",
      kind: "human",
      client: "tabula-md",
      lastSeen: 1,
    },
    activeDocumentId: "doc-1",
    fileTitle: "README.md",
    now: () => 100,
    nowIso: () => "2026-07-12T00:00:00.000Z",
  });
  return { awareness, controller, room };
};

const createRemotePeer = (source: ReturnType<typeof createWorkspaceRoomCrdt>) => {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(source.doc));
  const room = createWorkspaceRoomCrdt({ roomId: "room-1", doc, initialize: false });
  const awareness = new Awareness(doc);
  resources.push(awareness, doc);
  return { awareness, room };
};

describe("RoomPresenceController", () => {
  it("projects agent presence through the same cursor and viewport contract", () => {
    const { awareness, controller, room } = createRoom();
    const remote = createRemotePeer(room);
    const remoteAwareness = remote.awareness;
    const text = remote.room.documents.get("doc-1")!;
    remoteAwareness.setLocalState({
      actor: createRoomActor({
        id: "agent-1",
        kind: "agent",
        name: "Curious Agent",
        color: "#dc2626",
        client: "tabula-mcp",
        capabilities: ["presence", "read", "write"],
        joinedAt: "2026-07-12T00:00:01.000Z",
      }),
      activeDocumentId: "doc-1",
      fileTitle: "README.md",
      cursor: {
        anchor: Y.createRelativePositionFromTypeIndex(text, 2),
        head: Y.createRelativePositionFromTypeIndex(text, 5),
      },
      viewport: {
        anchor: Y.createRelativePositionFromTypeIndex(text, 7),
        offset: 24,
      },
      followingActorId: "human-1",
      presenceState: "idle",
      lastSeen: 90,
    });
    applyAwarenessUpdate(
      awareness,
      encodeAwarenessUpdate(remoteAwareness, [remoteAwareness.clientID]),
      "test",
    );

    expect(controller.getCollaborators()).toEqual([expect.objectContaining({
      id: "agent-1",
      kind: "agent",
      activeDocumentId: "doc-1",
      selection: { documentId: "doc-1", from: 2, to: 5 },
      viewport: { documentId: "doc-1", position: 7, offset: 24 },
      followingActorId: "human-1",
      presenceState: "idle",
    })]);
  });

  it("defaults legacy peers to active and publishes state transitions once", () => {
    const { awareness, controller, room } = createRoom();
    const remoteAwareness = createRemotePeer(room).awareness;
    remoteAwareness.setLocalState({
      actor: createRoomActor({ id: "human-2", kind: "human", name: "Legacy Human" }),
    });
    applyAwarenessUpdate(
      awareness,
      encodeAwarenessUpdate(remoteAwareness, [remoteAwareness.clientID]),
      "test",
    );
    expect(controller.getCollaborators()[0]?.presenceState).toBe("active");

    controller.publishLocalState();
    awareness.setLocalStateField("cursor", { anchor: "test" });
    awareness.setLocalStateField("viewport", { anchor: "test" });
    const listener = vi.fn();
    awareness.on("update", listener);
    controller.setPresenceState("away");
    controller.setPresenceState("away");

    expect(awareness.getLocalState()).toEqual(expect.objectContaining({
      presenceState: "away",
      cursor: null,
      viewport: null,
    }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("publishes local document state and clears cursor presence outside the editor", () => {
    const { awareness, controller } = createRoom();
    controller.publishLocalState();
    expect(awareness.getLocalState()).toEqual(expect.objectContaining({
      activeDocumentId: "doc-1",
      fileTitle: "README.md",
      lastSeen: 100,
    }));

    awareness.setLocalStateField("cursor", { anchor: "test" });
    controller.setEditorPresenceEnabled(false);
    expect(awareness.getLocalState()?.cursor).toBeNull();

    controller.setActiveDocument(null);
    expect(awareness.getLocalState()).not.toHaveProperty("activeDocumentId");
    expect(awareness.getLocalState()).not.toHaveProperty("fileTitle");
  });

  it("removes awareness state for actors no longer reported by the relay", () => {
    const { awareness, controller, room } = createRoom();
    const remoteAwareness = createRemotePeer(room).awareness;
    remoteAwareness.setLocalState({
      actor: createRoomActor({ id: "human-2", kind: "human", name: "Sharp Human" }),
    });
    applyAwarenessUpdate(
      awareness,
      encodeAwarenessUpdate(remoteAwareness, [remoteAwareness.clientID]),
      "test",
    );
    expect(controller.getCollaborators()).toHaveLength(1);

    controller.refreshPeers([]);
    expect(controller.getCollaborators()).toHaveLength(0);
  });

  it("keeps the original joined time when identity preferences change", () => {
    const { controller } = createRoom();
    controller.setIdentity({
      id: "human-1",
      name: "Sharp Human",
      color: "#16a34a",
      kind: "human",
      client: "tabula-md",
      lastSeen: 2,
    });
    expect(controller.getIdentity()).toEqual(expect.objectContaining({
      name: "Sharp Human",
      joinedAt: "2026-07-12T00:00:00.000Z",
    }));
  });

  it("does not republish awareness for identity fields outside the actor contract", () => {
    const { awareness, controller } = createRoom();
    controller.publishLocalState();
    const listener = vi.fn();
    awareness.on("update", listener);

    controller.setIdentity({
      id: "human-1",
      name: "Curious Human",
      color: "#2563eb",
      kind: "human",
      client: "tabula-md",
      lastSeen: 999,
      selection: { documentId: "doc-1", from: 1, to: 4 },
    });
    expect(listener).not.toHaveBeenCalled();

    controller.setIdentity({
      id: "human-1",
      name: "Sharp Human",
      color: "#2563eb",
      kind: "human",
      client: "tabula-md",
      lastSeen: 999,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("deduplicates unchanged viewport and active-document presence", () => {
    const { awareness, controller } = createRoom();
    controller.publishLocalState();
    const listener = vi.fn();
    awareness.on("update", listener);

    controller.setActiveDocument({ documentId: "doc-1", fileTitle: "README.md" });
    expect(listener).not.toHaveBeenCalled();

    const viewport = { documentId: "doc-1", position: 4, offset: 16 };
    controller.setViewport(viewport);
    controller.setViewport(viewport);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.setViewport(null);
    controller.setViewport(null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
