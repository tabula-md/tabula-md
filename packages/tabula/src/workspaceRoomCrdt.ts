import * as Y from "yjs";
import {
  WORKSPACE_ROOM_MAX_COMMENTS,
  WORKSPACE_ROOM_MAX_COMMENT_LENGTH,
  WORKSPACE_ROOM_MAX_REPLIES,
  WORKSPACE_ROOM_ROOT_ID,
  WORKSPACE_ROOM_SCHEMA_VERSION,
  type WorkspaceRoomComment,
  type WorkspaceRoomCommentReply,
  type WorkspaceRoomNode,
  type WorkspaceRoomNodeType,
  type WorkspaceRoomSnapshot,
  type WorkspaceRoomStructureSnapshot,
} from "./workspaceRoomModel";

export type WorkspaceRoomCrdt = {
  doc: Y.Doc;
  meta: Y.Map<unknown>;
  nodes: Y.Map<Y.Map<unknown>>;
  documents: Y.Map<Y.Text>;
  comments: Y.Map<Y.Map<unknown>>;
};

export type WorkspaceRoomStructureResult =
  | { ok: true }
  | { ok: false; message: string };

type InitialWorkspaceRoomNode = {
  id: string;
  type: WorkspaceRoomNodeType;
  parentId?: string | null;
  title: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
  markdown?: string;
};

type InitialWorkspaceRoomComment = Omit<WorkspaceRoomComment, "replies"> & {
  replies?: readonly WorkspaceRoomCommentReply[];
};

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asOptionalString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const normalizeTitle = (title: string, fallback: string) => {
  const normalized = title.trim().split("\0").join(" ").replace(/[/\\]/g, " ").replace(/\s+/g, " ");
  return normalized && normalized !== "." && normalized !== ".." ? normalized.slice(0, 120) : fallback;
};

const createNodeMap = ({
  id,
  type,
  parentId = WORKSPACE_ROOM_ROOT_ID,
  title,
  order = 0,
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
}: InitialWorkspaceRoomNode) => {
  const node = new Y.Map<unknown>();
  node.set("id", id);
  node.set("type", type);
  node.set("parentId", type === "folder" && id === WORKSPACE_ROOM_ROOT_ID ? null : parentId);
  node.set("title", normalizeTitle(title, type === "folder" ? "Folder" : "Untitled.md"));
  node.set("order", order);
  node.set("createdAt", createdAt);
  node.set("updatedAt", updatedAt);
  return node;
};

const readNode = (id: string, node: Y.Map<unknown>): WorkspaceRoomNode | null => {
  const type = node.get("type");
  if (type !== "folder" && type !== "document") {
    return null;
  }

  const parentValue = node.get("parentId");
  return {
    id,
    type,
    parentId: parentValue === null || typeof parentValue === "string" ? parentValue : WORKSPACE_ROOM_ROOT_ID,
    title: asString(node.get("title"), type === "folder" ? "Folder" : "Untitled.md"),
    order: asNumber(node.get("order")),
    createdAt: asString(node.get("createdAt"), new Date(0).toISOString()),
    updatedAt: asString(node.get("updatedAt"), new Date(0).toISOString()),
  };
};

const compareNodes = (first: WorkspaceRoomNode, second: WorkspaceRoomNode) =>
  first.order - second.order ||
  first.title.localeCompare(second.title, undefined, { numeric: true, sensitivity: "base" }) ||
  first.id.localeCompare(second.id);

export const createWorkspaceRoomCrdt = ({
  roomId,
  doc = new Y.Doc(),
  initialize = true,
}: {
  roomId: string;
  doc?: Y.Doc;
  initialize?: boolean;
}): WorkspaceRoomCrdt => {
  const meta = doc.getMap("tabula.meta");
  const nodes = doc.getMap<Y.Map<unknown>>("tabula.nodes");
  const documents = doc.getMap<Y.Text>("tabula.documents");
  const comments = doc.getMap<Y.Map<unknown>>("tabula.comments");

  if (initialize) {
    doc.transact(() => {
      if (!meta.has("schemaVersion")) {
        meta.set("schemaVersion", WORKSPACE_ROOM_SCHEMA_VERSION);
      }
      if (!meta.has("roomId")) {
        meta.set("roomId", roomId);
      }
      if (!meta.has("rootId")) {
        meta.set("rootId", WORKSPACE_ROOM_ROOT_ID);
      }
      if (!nodes.has(WORKSPACE_ROOM_ROOT_ID)) {
        nodes.set(WORKSPACE_ROOM_ROOT_ID, createNodeMap({
          id: WORKSPACE_ROOM_ROOT_ID,
          type: "folder",
          parentId: null,
          title: "Workspace",
          order: 0,
          createdAt: new Date(0).toISOString(),
        }));
      }
    }, "tabula.bootstrap");
  }

  return { doc, meta, nodes, documents, comments };
};

export const validateWorkspaceRoomStructure = (
  room: WorkspaceRoomCrdt,
  expectedRoomId: string,
): WorkspaceRoomStructureResult => {
  if (
    room.meta.get("schemaVersion") !== WORKSPACE_ROOM_SCHEMA_VERSION ||
    room.meta.get("roomId") !== expectedRoomId ||
    room.meta.get("rootId") !== WORKSPACE_ROOM_ROOT_ID
  ) {
    return { ok: false, message: "This room uses an unsupported workspace format." };
  }

  const root = room.nodes.get(WORKSPACE_ROOM_ROOT_ID);
  if (root?.get("type") !== "folder" || root.get("parentId") !== null) {
    return { ok: false, message: "This room has an invalid workspace root." };
  }

  for (const [nodeId, node] of room.nodes) {
    const parsed = readNode(nodeId, node);
    if (!parsed) {
      return { ok: false, message: "This room contains an invalid workspace node." };
    }
    if (nodeId !== WORKSPACE_ROOM_ROOT_ID) {
      const parent = parsed.parentId ? room.nodes.get(parsed.parentId) : undefined;
      if (parent?.get("type") !== "folder") {
        return { ok: false, message: "This room contains an invalid folder relationship." };
      }
    }
    if (parsed.type === "document" && !(room.documents.get(nodeId) instanceof Y.Text)) {
      return { ok: false, message: "This room contains a document without Markdown content." };
    }
    if (parsed.type === "folder" && room.documents.has(nodeId)) {
      return { ok: false, message: "This room contains invalid folder content." };
    }
  }

  for (const documentId of room.documents.keys()) {
    if (room.nodes.get(documentId)?.get("type") !== "document") {
      return { ok: false, message: "This room contains orphaned Markdown content." };
    }
  }

  for (const comment of room.comments.values()) {
    const fileId = asString(comment.get("fileId"));
    if (room.nodes.get(fileId)?.get("type") !== "document") {
      return { ok: false, message: "This room contains an orphaned comment." };
    }
  }

  return { ok: true };
};

export const initializeWorkspaceRoomCrdt = (
  room: WorkspaceRoomCrdt,
  {
    nodes,
    comments = [],
  }: {
    nodes: readonly InitialWorkspaceRoomNode[];
    comments?: readonly InitialWorkspaceRoomComment[];
  },
) => {
  room.doc.transact(() => {
    for (const input of nodes) {
      if (!input.id || input.id === WORKSPACE_ROOM_ROOT_ID) {
        continue;
      }
      room.nodes.set(input.id, createNodeMap(input));
      if (input.type === "document") {
        const text = new Y.Text();
        if (input.markdown) {
          text.insert(0, input.markdown);
        }
        room.documents.set(input.id, text);
      }
    }
    for (const comment of comments) {
      setWorkspaceRoomComment(room, comment);
    }
  }, "tabula.initialize");
};

export const getWorkspaceRoomDocument = (room: WorkspaceRoomCrdt, documentId: string) =>
  room.documents.get(documentId) ?? null;

export const createWorkspaceRoomFolder = (
  room: WorkspaceRoomCrdt,
  input: Omit<InitialWorkspaceRoomNode, "type" | "markdown">,
) => {
  const parentId = input.parentId ?? WORKSPACE_ROOM_ROOT_ID;
  if (
    !input.id ||
    input.id === WORKSPACE_ROOM_ROOT_ID ||
    room.nodes.has(input.id) ||
    room.nodes.get(parentId)?.get("type") !== "folder"
  ) {
    return false;
  }
  room.doc.transact(() => {
    room.nodes.set(input.id, createNodeMap({ ...input, parentId, type: "folder" }));
  }, "tabula.folder.create");
  return true;
};

export const createWorkspaceRoomDocument = (
  room: WorkspaceRoomCrdt,
  input: Omit<InitialWorkspaceRoomNode, "type">,
) => {
  const parentId = input.parentId ?? WORKSPACE_ROOM_ROOT_ID;
  if (
    !input.id ||
    input.id === WORKSPACE_ROOM_ROOT_ID ||
    room.nodes.has(input.id) ||
    room.nodes.get(parentId)?.get("type") !== "folder"
  ) {
    return false;
  }
  room.doc.transact(() => {
    room.nodes.set(input.id, createNodeMap({ ...input, parentId, type: "document" }));
    const text = new Y.Text();
    if (input.markdown) {
      text.insert(0, input.markdown);
    }
    room.documents.set(input.id, text);
  }, "tabula.document.create");
  return true;
};

const collectDescendantNodeIds = (room: WorkspaceRoomCrdt, nodeId: string) => {
  const ids = new Set([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    room.nodes.forEach((node, id) => {
      if (!ids.has(id) && ids.has(asString(node.get("parentId")))) {
        ids.add(id);
        changed = true;
      }
    });
  }
  return ids;
};

export const deleteWorkspaceRoomNode = (room: WorkspaceRoomCrdt, nodeId: string) => {
  if (nodeId === WORKSPACE_ROOM_ROOT_ID) {
    return;
  }
  const deletedIds = collectDescendantNodeIds(room, nodeId);
  room.doc.transact(() => {
    for (const id of deletedIds) {
      room.nodes.delete(id);
      room.documents.delete(id);
    }
    room.comments.forEach((comment, commentId) => {
      if (deletedIds.has(asString(comment.get("fileId")))) {
        room.comments.delete(commentId);
      }
    });
  }, "tabula.node.delete");
};

export const renameWorkspaceRoomNode = (
  room: WorkspaceRoomCrdt,
  nodeId: string,
  title: string,
  updatedAt = new Date().toISOString(),
) => {
  const node = room.nodes.get(nodeId);
  if (!node) {
    return false;
  }
  const type = node.get("type") === "folder" ? "folder" : "document";
  const normalizedTitle = normalizeTitle(title, type === "folder" ? "Folder" : "Untitled.md");
  if (node.get("title") === normalizedTitle) return true;
  room.doc.transact(() => {
    node.set("title", normalizedTitle);
    node.set("updatedAt", updatedAt);
  }, "tabula.node.rename");
  return true;
};

const wouldCreateCycle = (room: WorkspaceRoomCrdt, nodeId: string, parentId: string) => {
  let currentId: string | null = parentId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === nodeId || visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);
    const parentValue: unknown = room.nodes.get(currentId)?.get("parentId");
    currentId = typeof parentValue === "string" ? parentValue : null;
  }
  return false;
};

export const moveWorkspaceRoomNode = (
  room: WorkspaceRoomCrdt,
  nodeId: string,
  parentId: string,
  updatedAt = new Date().toISOString(),
) => {
  const node = room.nodes.get(nodeId);
  const parent = room.nodes.get(parentId);
  if (!node || parent?.get("type") !== "folder" || nodeId === WORKSPACE_ROOM_ROOT_ID || wouldCreateCycle(room, nodeId, parentId)) {
    return false;
  }
  if (node.get("parentId") === parentId) return true;
  room.doc.transact(() => {
    node.set("parentId", parentId);
    node.set("updatedAt", updatedAt);
  }, "tabula.node.move");
  return true;
};

export const setWorkspaceRoomNodeOrder = (
  room: WorkspaceRoomCrdt,
  nodeId: string,
  order: number,
  updatedAt = new Date().toISOString(),
) => {
  const node = room.nodes.get(nodeId);
  if (!node || !Number.isFinite(order)) return false;
  if (node.get("order") === order) return true;
  room.doc.transact(() => {
    node.set("order", order);
    node.set("updatedAt", updatedAt);
  }, "tabula.node.order");
  return true;
};

const createReplyMap = (reply: WorkspaceRoomCommentReply) => {
  const map = new Y.Map<unknown>();
  map.set("id", reply.id);
  map.set("body", reply.body.trim());
  if (reply.authorId) map.set("authorId", reply.authorId);
  if (reply.authorName) map.set("authorName", reply.authorName);
  if (reply.authorColor) map.set("authorColor", reply.authorColor);
  map.set("createdAt", reply.createdAt);
  return map;
};

const createRelativeAnchor = (text: Y.Text | undefined, index: number | undefined, assoc: number) =>
  text && typeof index === "number"
    ? Y.encodeRelativePosition(
        Y.createRelativePositionFromTypeIndex(
          text,
          Math.max(0, Math.min(index, text.length)),
          assoc,
        ),
      )
    : undefined;

export const setWorkspaceRoomComment = (
  room: WorkspaceRoomCrdt,
  comment: InitialWorkspaceRoomComment,
) => {
  const text = room.documents.get(comment.fileId);
  const body = comment.body.trim();
  const repliesInput = comment.replies ?? [];
  if (
    !text ||
    room.nodes.get(comment.fileId)?.get("type") !== "document" ||
    !comment.id ||
    !body ||
    body.length > WORKSPACE_ROOM_MAX_COMMENT_LENGTH ||
    (!room.comments.has(comment.id) && room.comments.size >= WORKSPACE_ROOM_MAX_COMMENTS) ||
    repliesInput.length > WORKSPACE_ROOM_MAX_REPLIES ||
    repliesInput.some((reply) => !reply.id || !reply.body.trim() || reply.body.length > WORKSPACE_ROOM_MAX_COMMENT_LENGTH)
  ) {
    return false;
  }
  const map = new Y.Map<unknown>();
  map.set("id", comment.id);
  map.set("fileId", comment.fileId);
  map.set("body", body);
  if (comment.authorId) map.set("authorId", comment.authorId);
  if (comment.authorName) map.set("authorName", comment.authorName);
  if (comment.authorColor) map.set("authorColor", comment.authorColor);
  if (comment.quote) map.set("quote", comment.quote.slice(0, WORKSPACE_ROOM_MAX_COMMENT_LENGTH));
  if (comment.sourceQuote) map.set("sourceQuote", comment.sourceQuote.slice(0, WORKSPACE_ROOM_MAX_COMMENT_LENGTH));
  const anchorStart = createRelativeAnchor(text, comment.selectionStart, 0);
  const anchorEnd = createRelativeAnchor(text, comment.selectionEnd, -1);
  if (anchorStart) map.set("anchorStart", anchorStart);
  if (anchorEnd) map.set("anchorEnd", anchorEnd);
  map.set("resolved", comment.resolved);
  map.set("createdAt", comment.createdAt);
  const replies = new Y.Map<Y.Map<unknown>>();
  for (const reply of repliesInput) {
    replies.set(reply.id, createReplyMap(reply));
  }
  map.set("replies", replies);
  room.comments.set(comment.id, map);
  return true;
};

export const deleteWorkspaceRoomComment = (room: WorkspaceRoomCrdt, commentId: string) => {
  room.comments.delete(commentId);
};

export const setWorkspaceRoomCommentResolved = (
  room: WorkspaceRoomCrdt,
  commentId: string,
  resolved: boolean,
) => {
  room.comments.get(commentId)?.set("resolved", resolved);
};

export const addWorkspaceRoomCommentReply = (
  room: WorkspaceRoomCrdt,
  commentId: string,
  reply: WorkspaceRoomCommentReply,
) => {
  const comment = room.comments.get(commentId);
  const replies = comment?.get("replies");
  if (
    !(replies instanceof Y.Map) ||
    replies.size >= WORKSPACE_ROOM_MAX_REPLIES ||
    !reply.id ||
    !reply.body.trim() ||
    reply.body.length > WORKSPACE_ROOM_MAX_COMMENT_LENGTH
  ) {
    return false;
  }
  replies.set(reply.id, createReplyMap(reply));
  return true;
};

const readRelativeAnchor = (room: WorkspaceRoomCrdt, value: unknown) => {
  if (!(value instanceof Uint8Array)) {
    return undefined;
  }
  try {
    const absolute = Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(value), room.doc);
    return absolute?.index;
  } catch {
    return undefined;
  }
};

const readReplies = (value: unknown): WorkspaceRoomCommentReply[] => {
  if (!(value instanceof Y.Map)) {
    return [];
  }
  const replies: WorkspaceRoomCommentReply[] = [];
  value.forEach((reply, id) => {
    if (!(reply instanceof Y.Map)) return;
    const body = asString(reply.get("body")).trim();
    if (!body) return;
    replies.push({
      id,
      body,
      authorId: asOptionalString(reply.get("authorId")),
      authorName: asOptionalString(reply.get("authorName")),
      authorColor: asOptionalString(reply.get("authorColor")),
      createdAt: asString(reply.get("createdAt"), new Date(0).toISOString()),
    });
  });
  return replies.sort((first, second) => first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id));
};

const readComment = (
  room: WorkspaceRoomCrdt,
  id: string,
  comment: Y.Map<unknown>,
): WorkspaceRoomComment | null => {
  const fileId = asString(comment.get("fileId"));
  const body = asString(comment.get("body")).trim();
  if (!fileId || !body) return null;
  return {
    id,
    fileId,
    body,
    authorId: asOptionalString(comment.get("authorId")),
    authorName: asOptionalString(comment.get("authorName")),
    authorColor: asOptionalString(comment.get("authorColor")),
    quote: asOptionalString(comment.get("quote")),
    sourceQuote: asOptionalString(comment.get("sourceQuote")),
    selectionStart: readRelativeAnchor(room, comment.get("anchorStart")),
    selectionEnd: readRelativeAnchor(room, comment.get("anchorEnd")),
    resolved: comment.get("resolved") === true,
    createdAt: asString(comment.get("createdAt"), new Date(0).toISOString()),
    replies: readReplies(comment.get("replies")),
  };
};

const sortComments = (comments: WorkspaceRoomComment[]) =>
  comments.sort((first, second) =>
    first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id));

export const getWorkspaceRoomDocumentComments = (
  room: WorkspaceRoomCrdt,
  documentId: string,
): WorkspaceRoomComment[] => {
  if (
    room.nodes.get(documentId)?.get("type") !== "document" ||
    !room.documents.has(documentId)
  ) {
    return [];
  }
  const comments: WorkspaceRoomComment[] = [];
  room.comments.forEach((comment, id) => {
    if (comment.get("fileId") !== documentId) return;
    const parsed = readComment(room, id, comment);
    if (parsed) comments.push(parsed);
  });
  return sortComments(comments);
};

export const getWorkspaceRoomSnapshot = (room: WorkspaceRoomCrdt): WorkspaceRoomSnapshot => {
  const structure = getWorkspaceRoomStructureSnapshot(room);
  const documents: Record<string, string> = {};
  for (const node of structure.nodes) {
    if (node.type === "document") {
      documents[node.id] = room.documents.get(node.id)?.toString() ?? "";
    }
  }

  return {
    ...structure,
    documents,
    commentsByFileId: getWorkspaceRoomComments(room),
  };
};

export const getWorkspaceRoomStructureSnapshot = (
  room: WorkspaceRoomCrdt,
): WorkspaceRoomStructureSnapshot => {
  const nodes: WorkspaceRoomNode[] = [];
  room.nodes.forEach((node, id) => {
    const parsed = readNode(id, node);
    if (parsed) nodes.push(parsed);
  });
  nodes.sort(compareNodes);
  return {
    roomId: asString(room.meta.get("roomId")),
    schemaVersion: WORKSPACE_ROOM_SCHEMA_VERSION,
    rootId: asString(room.meta.get("rootId"), WORKSPACE_ROOM_ROOT_ID),
    nodes,
  };
};

export const getWorkspaceRoomComments = (
  room: WorkspaceRoomCrdt,
): Record<string, WorkspaceRoomComment[]> => {
  const documentIds = new Set<string>();
  room.nodes.forEach((node, id) => {
    if (node.get("type") === "document" && room.documents.has(id)) documentIds.add(id);
  });
  const commentsByFileId: Record<string, WorkspaceRoomComment[]> = {};
  room.comments.forEach((comment, id) => {
    const nextComment = readComment(room, id, comment);
    if (!nextComment || !documentIds.has(nextComment.fileId)) return;
    const { fileId } = nextComment;
    (commentsByFileId[fileId] ??= []).push(nextComment);
  });
  for (const comments of Object.values(commentsByFileId)) {
    sortComments(comments);
  }
  return commentsByFileId;
};
