export const WORKSPACE_ROOM_SCHEMA_VERSION = 2;
export const WORKSPACE_ROOM_ROOT_ID = "workspace-root";
export const WORKSPACE_ROOM_MAX_CONTENT_BYTES = 10 * 1024 * 1024;
export const WORKSPACE_ROOM_MAX_DOCUMENTS = 500;
export const WORKSPACE_ROOM_MAX_FOLDERS = 500;
export const WORKSPACE_ROOM_MAX_TREE_DEPTH = 32;
export const WORKSPACE_ROOM_MAX_COMMENTS = 5_000;
export const WORKSPACE_ROOM_MAX_REPLIES = 100;
export const WORKSPACE_ROOM_MAX_COMMENT_LENGTH = 10_000;

export type WorkspaceRoomNodeType = "folder" | "document";

export type WorkspaceRoomNode = {
  id: string;
  type: WorkspaceRoomNodeType;
  parentId: string | null;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRoomDocumentSnapshot = WorkspaceRoomNode & {
  type: "document";
  markdown: string;
};

export type WorkspaceRoomFolderSnapshot = WorkspaceRoomNode & {
  type: "folder";
};

export type WorkspaceRoomCommentReply = {
  id: string;
  body: string;
  authorId?: string;
  authorName?: string;
  authorColor?: string;
  createdAt: string;
};

export type WorkspaceRoomComment = {
  id: string;
  fileId: string;
  body: string;
  authorId?: string;
  authorName?: string;
  authorColor?: string;
  quote?: string;
  sourceQuote?: string;
  selectionStart?: number;
  selectionEnd?: number;
  resolved: boolean;
  createdAt: string;
  replies: WorkspaceRoomCommentReply[];
};

export type WorkspaceRoomSnapshot = {
  roomId: string;
  schemaVersion: typeof WORKSPACE_ROOM_SCHEMA_VERSION;
  rootId: string;
  nodes: WorkspaceRoomNode[];
  documents: Record<string, string>;
  commentsByFileId: Record<string, WorkspaceRoomComment[]>;
};

export type WorkspaceRoomStructureSnapshot = Pick<
  WorkspaceRoomSnapshot,
  "roomId" | "schemaVersion" | "rootId" | "nodes"
>;

export type WorkspaceRoomLimitViolation =
  | "content-bytes"
  | "documents"
  | "folders"
  | "tree-depth"
  | "comments"
  | "comment-length"
  | "replies";

export type WorkspaceRoomLimitResult =
  | { ok: true }
  | { ok: false; violation: WorkspaceRoomLimitViolation; message: string };

const textEncoder = new TextEncoder();

const getNodeDepth = (node: WorkspaceRoomNode, nodesById: Map<string, WorkspaceRoomNode>) => {
  let depth = 0;
  let parentId = node.parentId;
  const visited = new Set<string>([node.id]);
  while (parentId) {
    if (visited.has(parentId)) return Number.POSITIVE_INFINITY;
    visited.add(parentId);
    depth += 1;
    parentId = nodesById.get(parentId)?.parentId ?? null;
  }
  return depth;
};

export const validateWorkspaceRoomLimits = (
  snapshot: WorkspaceRoomSnapshot,
): WorkspaceRoomLimitResult => {
  const structureLimits = validateWorkspaceRoomStructureLimits(snapshot);
  if (!structureLimits.ok) return structureLimits;
  const comments = Object.values(snapshot.commentsByFileId).flat();
  if (comments.length > WORKSPACE_ROOM_MAX_COMMENTS) {
    return {
      ok: false,
      violation: "comments",
      message: `A live workspace can include up to ${WORKSPACE_ROOM_MAX_COMMENTS} comments.`,
    };
  }
  if (comments.some((comment) => comment.body.length > WORKSPACE_ROOM_MAX_COMMENT_LENGTH)) {
    return {
      ok: false,
      violation: "comment-length",
      message: `Comments can contain up to ${WORKSPACE_ROOM_MAX_COMMENT_LENGTH} characters.`,
    };
  }
  if (comments.some((comment) => comment.replies.length > WORKSPACE_ROOM_MAX_REPLIES)) {
    return {
      ok: false,
      violation: "replies",
      message: `A comment can include up to ${WORKSPACE_ROOM_MAX_REPLIES} replies.`,
    };
  }
  const contentBytes =
    Object.values(snapshot.documents).reduce(
      (total, text) => total + textEncoder.encode(text).byteLength,
      0,
    ) +
    comments.reduce(
      (total, comment) =>
        total +
        textEncoder.encode(comment.body).byteLength +
        comment.replies.reduce(
          (replyTotal, reply) => replyTotal + textEncoder.encode(reply.body).byteLength,
          0,
        ),
      0,
    );
  if (contentBytes > WORKSPACE_ROOM_MAX_CONTENT_BYTES) {
    return {
      ok: false,
      violation: "content-bytes",
      message: "A live workspace can contain up to 10 MiB of Markdown and comments.",
    };
  }
  return { ok: true };
};

export const validateWorkspaceRoomStructureLimits = (
  snapshot: Pick<WorkspaceRoomStructureSnapshot, "rootId" | "nodes">,
): WorkspaceRoomLimitResult => {
  const documents = snapshot.nodes.filter((node) => node.type === "document");
  const folders = snapshot.nodes.filter(
    (node) => node.type === "folder" && node.id !== snapshot.rootId,
  );
  if (documents.length > WORKSPACE_ROOM_MAX_DOCUMENTS) {
    return {
      ok: false,
      violation: "documents",
      message: `A live workspace can include up to ${WORKSPACE_ROOM_MAX_DOCUMENTS} documents.`,
    };
  }
  if (folders.length > WORKSPACE_ROOM_MAX_FOLDERS) {
    return {
      ok: false,
      violation: "folders",
      message: `A live workspace can include up to ${WORKSPACE_ROOM_MAX_FOLDERS} folders.`,
    };
  }
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  if (
    snapshot.nodes.some(
      (node) => getNodeDepth(node, nodesById) > WORKSPACE_ROOM_MAX_TREE_DEPTH,
    )
  ) {
    return {
      ok: false,
      violation: "tree-depth",
      message: `Folder nesting can be up to ${WORKSPACE_ROOM_MAX_TREE_DEPTH} levels deep.`,
    };
  }
  return { ok: true };
};
