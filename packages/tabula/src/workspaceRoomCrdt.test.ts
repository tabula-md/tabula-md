import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  addWorkspaceRoomCommentReply,
  createWorkspaceRoomCrdt,
  createWorkspaceRoomDocument,
  createWorkspaceRoomFolder,
  deleteWorkspaceRoomNode,
  getWorkspaceRoomDocument,
  getWorkspaceRoomDocumentComments,
  getWorkspaceRoomSnapshot,
  getWorkspaceRoomStructureSnapshot,
  initializeWorkspaceRoomCrdt,
  moveWorkspaceRoomNode,
  renameWorkspaceRoomNode,
  setWorkspaceRoomComment,
  setWorkspaceRoomCommentResolved,
} from "./workspaceRoomCrdt";
import {
  validateWorkspaceRoomLimits,
  WORKSPACE_ROOM_ROOT_ID,
} from "./workspaceRoomModel";

const createInitialRoom = (roomId = "room-1") => {
  const room = createWorkspaceRoomCrdt({ roomId });
  initializeWorkspaceRoomCrdt(room, {
    nodes: [
      { id: "docs", type: "folder", title: "Docs", parentId: WORKSPACE_ROOM_ROOT_ID },
      { id: "readme", type: "document", title: "README.md", parentId: "docs", markdown: "# Hello" },
    ],
  });
  return room;
};

describe("workspace room CRDT", () => {
  it("stores folders, document text, and comments in one Y.Doc", () => {
    const room = createInitialRoom();
    setWorkspaceRoomComment(room, {
      id: "comment-1",
      fileId: "readme",
      body: "Check this",
      createdAt: "2026-07-10T00:00:00.000Z",
      resolved: false,
      selectionStart: 0,
      selectionEnd: 7,
    });
    addWorkspaceRoomCommentReply(room, "comment-1", {
      id: "reply-1",
      body: "Done",
      createdAt: "2026-07-10T00:00:01.000Z",
    });
    setWorkspaceRoomCommentResolved(room, "comment-1", true);

    const snapshot = getWorkspaceRoomSnapshot(room);
    expect(snapshot.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "docs", type: "folder" }),
      expect.objectContaining({ id: "readme", type: "document", parentId: "docs" }),
    ]));
    expect(snapshot.documents.readme).toBe("# Hello");
    expect(snapshot.commentsByFileId.readme[0]).toMatchObject({
      id: "comment-1",
      resolved: true,
      selectionStart: 0,
      selectionEnd: 7,
      replies: [expect.objectContaining({ id: "reply-1", body: "Done" })],
    });
    expect(validateWorkspaceRoomLimits(snapshot)).toEqual({ ok: true });
  });

  it("keeps a live comment attached to the exact selected range", () => {
    const room = createInitialRoom();
    setWorkspaceRoomComment(room, {
      id: "comment-1",
      fileId: "readme",
      body: "Check this",
      createdAt: "2026-07-10T00:00:00.000Z",
      resolved: false,
      selectionStart: 2,
      selectionEnd: 7,
    });

    const document = getWorkspaceRoomDocument(room, "readme");
    document?.insert(2, "Before ");
    document?.insert(14, " after");

    const snapshot = getWorkspaceRoomSnapshot(room);
    const comment = snapshot.commentsByFileId.readme[0];
    expect(comment).toMatchObject({ selectionStart: 9, selectionEnd: 14 });
    expect(snapshot.documents.readme.slice(comment.selectionStart, comment.selectionEnd)).toBe("Hello");
  });

  it("resolves comments for one requested document without projecting other documents", () => {
    const room = createInitialRoom();
    createWorkspaceRoomDocument(room, {
      id: "notes",
      title: "Notes.md",
      parentId: "docs",
      markdown: "Notes",
    });
    setWorkspaceRoomComment(room, {
      id: "readme-comment",
      fileId: "readme",
      body: "README",
      createdAt: "2026-07-10T00:00:01.000Z",
      resolved: false,
      selectionStart: 0,
      selectionEnd: 1,
    });
    setWorkspaceRoomComment(room, {
      id: "notes-comment",
      fileId: "notes",
      body: "Notes",
      createdAt: "2026-07-10T00:00:00.000Z",
      resolved: false,
      selectionStart: 0,
      selectionEnd: 1,
    });

    expect(getWorkspaceRoomDocumentComments(room, "readme")).toEqual([
      expect.objectContaining({ id: "readme-comment", fileId: "readme" }),
    ]);
    expect(getWorkspaceRoomDocumentComments(room, "missing")).toEqual([]);
  });

  it("converges concurrent structure and text changes without resurrecting deleted nodes", () => {
    const first = createInitialRoom();
    const second = createWorkspaceRoomCrdt({ roomId: "room-1" });
    Y.applyUpdate(second.doc, Y.encodeStateAsUpdate(first.doc));

    getWorkspaceRoomDocument(first, "readme")?.insert(7, " world");
    createWorkspaceRoomFolder(second, { id: "archive", title: "Archive", parentId: WORKSPACE_ROOM_ROOT_ID });
    createWorkspaceRoomDocument(second, { id: "notes", title: "Notes.md", parentId: "archive", markdown: "Notes" });
    moveWorkspaceRoomNode(second, "readme", "archive");

    const firstUpdate = Y.encodeStateAsUpdate(first.doc, Y.encodeStateVector(second.doc));
    const secondUpdate = Y.encodeStateAsUpdate(second.doc, Y.encodeStateVector(first.doc));
    Y.applyUpdate(first.doc, secondUpdate);
    Y.applyUpdate(second.doc, firstUpdate);
    deleteWorkspaceRoomNode(first, "notes");
    Y.applyUpdate(second.doc, Y.encodeStateAsUpdate(first.doc, Y.encodeStateVector(second.doc)));

    expect(getWorkspaceRoomSnapshot(second)).toEqual(getWorkspaceRoomSnapshot(first));
    expect(getWorkspaceRoomSnapshot(second).nodes.some((node) => node.id === "notes")).toBe(false);
    expect(getWorkspaceRoomSnapshot(second).documents.readme).toBe("# Hello world");
  });

  it("keeps active document outside shared state and rejects cyclic folder moves", () => {
    const room = createInitialRoom();
    createWorkspaceRoomFolder(room, { id: "nested", title: "Nested", parentId: "docs" });
    expect(moveWorkspaceRoomNode(room, "docs", "nested")).toBe(false);
    renameWorkspaceRoomNode(room, "readme", "Guide.md");
    const snapshot = getWorkspaceRoomSnapshot(room);
    expect(snapshot).not.toHaveProperty("activeDocumentId");
    expect(snapshot.nodes.find((node) => node.id === "readme")?.title).toBe("Guide.md");
  });

  it("projects workspace structure without materializing document bodies", () => {
    const room = createInitialRoom();
    const text = getWorkspaceRoomDocument(room, "readme") as Y.Text & { toString(): string };
    const toString = vi.spyOn(text, "toString");

    const structure = getWorkspaceRoomStructureSnapshot(room);

    expect(structure.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "docs", type: "folder" }),
      expect.objectContaining({ id: "readme", type: "document" }),
    ]));
    expect(structure).not.toHaveProperty("documents");
    expect(structure).not.toHaveProperty("commentsByFileId");
    expect(toString).not.toHaveBeenCalled();
    toString.mockRestore();
  });

  it("rejects orphaned nodes and invalid comment content at the shared contract boundary", () => {
    const room = createInitialRoom();
    expect(createWorkspaceRoomDocument(room, {
      id: "orphan",
      title: "Orphan.md",
      parentId: "missing",
      markdown: "text",
    })).toBe(false);
    expect(createWorkspaceRoomFolder(room, {
      id: "docs",
      title: "Duplicate id",
      parentId: WORKSPACE_ROOM_ROOT_ID,
    })).toBe(false);
    expect(setWorkspaceRoomComment(room, {
      id: "orphan-comment",
      fileId: "missing",
      body: "Comment",
      createdAt: "2026-07-10T00:00:00.000Z",
      resolved: false,
    })).toBe(false);
    expect(setWorkspaceRoomComment(room, {
      id: "empty-comment",
      fileId: "readme",
      body: "   ",
      createdAt: "2026-07-10T00:00:00.000Z",
      resolved: false,
    })).toBe(false);
  });
});
