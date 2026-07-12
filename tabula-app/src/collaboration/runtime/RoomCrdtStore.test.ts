import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  createWorkspaceRoomCrdt,
  getWorkspaceRoomDocument,
  initializeWorkspaceRoomCrdt,
  WORKSPACE_ROOM_ROOT_ID,
} from "@tabula-md/tabula";
import { createRoomMetrics } from "./RoomMetrics";
import { createRoomCrdtStore } from "./RoomCrdtStore";

const createStore = () => {
  const room = createWorkspaceRoomCrdt({ roomId: "room" });
  initializeWorkspaceRoomCrdt(room, {
    nodes: [
      { id: "docs", type: "folder", title: "Docs", parentId: WORKSPACE_ROOM_ROOT_ID },
      { id: "readme", type: "document", title: "README.md", parentId: "docs", markdown: "Hello" },
    ],
  });
  const metrics = createRoomMetrics(room);
  const store = createRoomCrdtStore({
    canApplyTextByteDelta: metrics.canApplyTextByteDelta,
    getDocumentByteLength: metrics.getDocumentByteLength,
    room,
  });
  return { metrics, room, store };
};

describe("RoomCrdtStore", () => {
  it("owns room structure commands without materializing document bodies", () => {
    const { metrics, room, store } = createStore();
    const readme = getWorkspaceRoomDocument(room, "readme") as Y.Text & { toString(): string };
    const toString = vi.spyOn(readme, "toString");

    expect(store.createFolder({ id: "archive", title: "Archive" })).toBe(true);
    expect(store.createDocument({
      id: "notes",
      title: "Notes.md",
      parentId: "archive",
      markdown: "Notes",
    })).toBe(true);
    expect(store.renameNode("notes", "Ideas.md")).toBe(true);
    expect(store.moveNode("notes", "docs")).toBe(true);
    expect(store.setNodeOrder("notes", 4)).toBe(true);
    expect(store.deleteNode("archive")).toBe(true);
    expect(store.deleteNode(WORKSPACE_ROOM_ROOT_ID)).toBe(false);
    expect(toString).not.toHaveBeenCalled();

    const snapshot = store.materializeWorkspace();
    expect(snapshot.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "notes", title: "Ideas.md", parentId: "docs", order: 4 }),
    ]));
    expect(snapshot.nodes.some((node) => node.id === "archive")).toBe(false);
    metrics.dispose();
    room.doc.destroy();
  });

  it("applies valid text patches and rejects invalid or oversized edits", () => {
    const { metrics, room, store } = createStore();

    expect(store.applyDocumentText("readme", "Hello world", [
      { from: 5, to: 5, insert: " world" },
    ])).toBe(true);
    expect(store.materializeDocument("readme")).toBe("Hello world");
    expect(store.applyDocumentText("readme", null, [
      { from: 50, to: 50, insert: "invalid" },
    ])).toBe(false);

    const limitedStore = createRoomCrdtStore({
      canApplyTextByteDelta: (delta) => delta <= 0,
      getDocumentByteLength: metrics.getDocumentByteLength,
      room,
    });
    expect(limitedStore.replaceDocumentText("readme", "Hello world!")).toBe(false);
    expect(limitedStore.createDocument({ id: "blocked", title: "Blocked.md", markdown: "x" })).toBe(false);
    expect(store.materializeDocument("readme")).toBe("Hello world");
    metrics.dispose();
    room.doc.destroy();
  });

  it("updates comments through one CRDT command boundary", () => {
    const { metrics, room, store } = createStore();
    const createdAt = "2026-07-13T00:00:00.000Z";

    expect(store.upsertComment({
      id: "comment",
      fileId: "readme",
      body: "Review this",
      createdAt,
      resolved: false,
      replies: [],
      selectionStart: 0,
      selectionEnd: 5,
    })).toBe(true);
    expect(store.addCommentReply("comment", {
      id: "reply",
      body: "Done",
      createdAt,
    })).toBe(true);
    store.setCommentResolved("comment", true);
    expect(store.materializeWorkspace().commentsByFileId.readme[0]).toMatchObject({
      id: "comment",
      resolved: true,
      replies: [expect.objectContaining({ id: "reply", body: "Done" })],
    });

    store.deleteComment("comment");
    expect(store.materializeWorkspace().commentsByFileId.readme).toBeUndefined();
    metrics.dispose();
    room.doc.destroy();
  });
});
