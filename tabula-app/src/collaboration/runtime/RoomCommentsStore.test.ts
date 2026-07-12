import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceRoomCrdt,
  initializeWorkspaceRoomCrdt,
  setWorkspaceRoomComment,
} from "@tabula-md/tabula";
import { createRoomCommentsStore } from "./RoomCommentsStore";

describe("RoomCommentsStore", () => {
  it("projects only subscribed document comments with stable snapshots", () => {
    const room = createWorkspaceRoomCrdt({ roomId: "room-comments" });
    initializeWorkspaceRoomCrdt(room, {
      nodes: [
        { id: "doc-a", type: "document", title: "A.md", markdown: "Alpha" },
        { id: "doc-b", type: "document", title: "B.md", markdown: "Beta" },
      ],
    });
    const store = createRoomCommentsStore(room);
    const listener = vi.fn();
    const unsubscribe = store.subscribe("doc-a", listener);
    const initial = store.getSnapshot("doc-a");

    expect(initial).toEqual([]);
    expect(store.getResourceCounts()).toEqual({
      commentDocuments: 1,
      commentSnapshots: 1,
      commentSubscriptions: 1,
    });

    setWorkspaceRoomComment(room, {
      id: "comment-a",
      fileId: "doc-a",
      body: "Review A",
      createdAt: "2026-07-12T00:00:00.000Z",
      resolved: false,
      replies: [],
    });
    setWorkspaceRoomComment(room, {
      id: "comment-b",
      fileId: "doc-b",
      body: "Review B",
      createdAt: "2026-07-12T00:00:01.000Z",
      resolved: false,
      replies: [],
    });

    expect(store.refresh()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot("doc-a")).toHaveLength(1);
    const projected = store.getSnapshot("doc-a");
    expect(store.refresh()).toBe(false);
    expect(store.getSnapshot("doc-a")).toBe(projected);

    unsubscribe();
    expect(store.getResourceCounts()).toEqual({
      commentDocuments: 0,
      commentSnapshots: 0,
      commentSubscriptions: 0,
    });
    store.dispose();
    room.doc.destroy();
  });
});
