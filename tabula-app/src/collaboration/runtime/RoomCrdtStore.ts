import * as Y from "yjs";
import {
  addWorkspaceRoomCommentReply,
  applyTextPatches as applyTextPatchesToString,
  createWorkspaceRoomDocument,
  createWorkspaceRoomFolder,
  deleteWorkspaceRoomComment,
  deleteWorkspaceRoomNode,
  getWorkspaceRoomDocument,
  getWorkspaceRoomSnapshot,
  moveWorkspaceRoomNode,
  renameWorkspaceRoomNode,
  setWorkspaceRoomComment,
  setWorkspaceRoomCommentResolved,
  setWorkspaceRoomNodeOrder,
  WORKSPACE_ROOM_MAX_DOCUMENTS,
  WORKSPACE_ROOM_MAX_FOLDERS,
  WORKSPACE_ROOM_ROOT_ID,
  type TextPatch,
  type WorkspaceRoomComment,
  type WorkspaceRoomCommentReply,
  type WorkspaceRoomCrdt,
} from "@tabula-md/tabula";
const utf8Encoder = new TextEncoder();

export type WorkspaceRoomDocumentCommand = {
  id: string;
  title: string;
  markdown?: string;
  parentId?: string | null;
  order?: number;
};

export type WorkspaceRoomFolderCommand = {
  id: string;
  title: string;
  parentId?: string | null;
  order?: number;
};

const applyTextPatches = (text: Y.Text, patches: readonly TextPatch[]) => {
  for (const patch of [...patches].sort((first, second) => second.from - first.from)) {
    const from = Math.max(0, Math.min(patch.from, text.length));
    const to = Math.max(from, Math.min(patch.to, text.length));
    if (to > from) text.delete(from, to - from);
    if (patch.insert) text.insert(from, patch.insert);
  }
};

export const createRoomCrdtStore = ({
  canApplyTextByteDelta,
  getDocumentByteLength,
  room,
}: {
  canApplyTextByteDelta: (byteDelta: number) => boolean;
  getDocumentByteLength: (documentId: string) => number | undefined;
  room: WorkspaceRoomCrdt;
}) => {
  const canCreateNode = (type: "document" | "folder") => {
    let count = 0;
    room.nodes.forEach((node, nodeId) => {
      if (nodeId !== WORKSPACE_ROOM_ROOT_ID && node.get("type") === type) count += 1;
    });
    return type === "document"
      ? count < WORKSPACE_ROOM_MAX_DOCUMENTS
      : count < WORKSPACE_ROOM_MAX_FOLDERS;
  };

  const replaceDocumentText = (documentId: string, nextText: string) => {
    const text = getWorkspaceRoomDocument(room, documentId);
    if (!text) return false;
    const currentText = text.toString();
    if (currentText === nextText) return true;
    const byteDelta = utf8Encoder.encode(nextText).byteLength -
      (getDocumentByteLength(documentId) ?? utf8Encoder.encode(currentText).byteLength);
    if (!canApplyTextByteDelta(byteDelta)) return false;
    room.doc.transact(() => {
      if (text.length) text.delete(0, text.length);
      if (nextText) text.insert(0, nextText);
    }, "tabula.text.replace");
    return true;
  };

  const applyDocumentText = (
    documentId: string,
    nextText: string | null,
    patches: readonly TextPatch[],
  ) => {
    const text = getWorkspaceRoomDocument(room, documentId);
    if (!text) return false;
    const currentText = text.toString();
    const patchedText = patches.length
      ? applyTextPatchesToString(currentText, patches)
      : nextText;
    if (patchedText === null) return false;
    const resolvedText = nextText ?? patchedText;
    const byteDelta = utf8Encoder.encode(resolvedText).byteLength -
      (getDocumentByteLength(documentId) ?? utf8Encoder.encode(currentText).byteLength);
    if (!canApplyTextByteDelta(byteDelta)) return false;
    room.doc.transact(() => {
      if (patches.length && patchedText === resolvedText) applyTextPatches(text, patches);
      else if (currentText !== resolvedText) {
        if (text.length) text.delete(0, text.length);
        if (resolvedText) text.insert(0, resolvedText);
      }
    }, "tabula.text.local");
    return true;
  };

  return {
    createDocument(input: WorkspaceRoomDocumentCommand) {
      const markdown = input.markdown ?? "";
      if (
        !canCreateNode("document") ||
        !canApplyTextByteDelta(utf8Encoder.encode(markdown).byteLength)
      ) return false;
      return createWorkspaceRoomDocument(room, { ...input, markdown });
    },
    createFolder(input: WorkspaceRoomFolderCommand) {
      return canCreateNode("folder") && createWorkspaceRoomFolder(room, input);
    },
    renameNode: (nodeId: string, title: string) => renameWorkspaceRoomNode(room, nodeId, title),
    moveNode: (nodeId: string, parentId: string) => moveWorkspaceRoomNode(room, nodeId, parentId),
    setNodeOrder: (nodeId: string, order: number) => setWorkspaceRoomNodeOrder(room, nodeId, order),
    deleteNode(nodeId: string) {
      if (!room.nodes.has(nodeId) || nodeId === WORKSPACE_ROOM_ROOT_ID) return false;
      deleteWorkspaceRoomNode(room, nodeId);
      return true;
    },
    replaceDocumentText,
    applyDocumentText,
    materializeDocument: (documentId: string) => room.documents.get(documentId)?.toString() ?? null,
    materializeWorkspace: () => getWorkspaceRoomSnapshot(room),
    upsertComment(comment: WorkspaceRoomComment) {
      const current = room.comments.get(comment.id);
      const currentBody = typeof current?.get("body") === "string" ? current.get("body") as string : "";
      const currentReplies = current?.get("replies");
      let currentReplyBytes = 0;
      if (currentReplies instanceof Y.Map) {
        currentReplies.forEach((reply) => {
          if (reply instanceof Y.Map && typeof reply.get("body") === "string") {
            currentReplyBytes += utf8Encoder.encode(reply.get("body") as string).byteLength;
          }
        });
      }
      const nextBytes = utf8Encoder.encode(comment.body.trim()).byteLength + comment.replies.reduce(
        (total, reply) => total + utf8Encoder.encode(reply.body).byteLength,
        0,
      );
      const byteDelta = nextBytes - utf8Encoder.encode(currentBody).byteLength - currentReplyBytes;
      if (!canApplyTextByteDelta(byteDelta)) return false;
      let applied = false;
      room.doc.transact(() => {
        applied = setWorkspaceRoomComment(room, comment);
      }, "tabula.comment.upsert");
      return applied;
    },
    deleteComment(commentId: string) {
      room.doc.transact(() => deleteWorkspaceRoomComment(room, commentId), "tabula.comment.delete");
    },
    setCommentResolved(commentId: string, resolved: boolean) {
      room.doc.transact(
        () => setWorkspaceRoomCommentResolved(room, commentId, resolved),
        "tabula.comment.resolve",
      );
    },
    addCommentReply(commentId: string, reply: WorkspaceRoomCommentReply) {
      if (!canApplyTextByteDelta(utf8Encoder.encode(reply.body.trim()).byteLength)) return false;
      let applied = false;
      room.doc.transact(() => {
        applied = addWorkspaceRoomCommentReply(room, commentId, reply);
      }, "tabula.comment.reply");
      return applied;
    },
  };
};

export type RoomCrdtStore = ReturnType<typeof createRoomCrdtStore>;
