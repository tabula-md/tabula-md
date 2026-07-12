import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  createWorkspaceRoomCrdt,
  initializeWorkspaceRoomCrdt,
  setWorkspaceRoomComment,
} from "@tabula-md/tabula";
import { createRoomMetrics } from "./RoomMetrics";

describe("RoomMetrics", () => {
  it("tracks document deltas and removals without rematerializing unrelated documents", () => {
    const room = createWorkspaceRoomCrdt({ roomId: "metrics" });
    initializeWorkspaceRoomCrdt(room, {
      nodes: [
        { id: "a", type: "document", title: "A.md", markdown: "alpha" },
        { id: "b", type: "document", title: "B.md", markdown: "beta" },
      ],
    });
    const metrics = createRoomMetrics(room);
    const changes: ReturnType<typeof metrics.applyDocumentEvents>[] = [];
    const observer = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
      changes.push(metrics.applyDocumentEvents(events));
    };
    room.documents.observeDeep(observer);

    room.documents.get("a")?.insert(5, "!");
    expect(changes.at(-1)?.changedDocumentIds).toEqual(["a"]);
    expect(metrics.getDocumentByteLength("a")).toBe(6);
    expect(metrics.getDocumentByteLength("b")).toBe(4);

    room.documents.delete("b");
    expect(changes.at(-1)?.removedDocumentIds).toEqual(["b"]);
    expect(metrics.getDocumentByteLength("b")).toBeUndefined();

    room.documents.unobserveDeep(observer);
    metrics.dispose();
    room.doc.destroy();
  });

  it("includes comments in the bounded room content budget", () => {
    const room = createWorkspaceRoomCrdt({ roomId: "comment-metrics" });
    initializeWorkspaceRoomCrdt(room, {
      nodes: [{ id: "doc", type: "document", title: "README.md", markdown: "text" }],
    });
    const metrics = createRoomMetrics(room);
    expect(metrics.canApplyTextByteDelta(1)).toBe(true);

    setWorkspaceRoomComment(room, {
      id: "comment",
      fileId: "doc",
      body: "comment body",
      createdAt: "2026-07-12T00:00:00.000Z",
      resolved: false,
      replies: [],
    });
    metrics.refreshComments();
    expect(metrics.getSnapshot()).toMatchObject({ commentsWithinLimits: true });

    metrics.dispose();
    room.doc.destroy();
  });
});
