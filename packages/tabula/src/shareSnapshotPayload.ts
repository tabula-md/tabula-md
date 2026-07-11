import {
  WORKSPACE_ROOM_MAX_COMMENTS,
  WORKSPACE_ROOM_MAX_COMMENT_LENGTH,
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_MAX_DOCUMENTS,
  WORKSPACE_ROOM_MAX_FOLDERS,
  WORKSPACE_ROOM_MAX_REPLIES,
  WORKSPACE_ROOM_MAX_TREE_DEPTH,
} from "./workspaceRoomModel";

export const SHARE_SNAPSHOT_SCHEMA_VERSION = 2;
const textEncoder = new TextEncoder();

export type ShareSnapshotSourceFile = {
  id: string;
  title: string;
  text: string;
  parentId?: string | null;
  order?: number;
};

export type ShareSnapshotSourceFolder = {
  id: string;
  title: string;
  parentId: string | null;
  order?: number;
};

export type ShareSnapshotFile = {
  id: string;
  title: string;
  text: string;
  parentId: string;
  order: number;
};

export type ShareSnapshotFolder = {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
};

export type ShareSnapshotCommentReply = {
  id: string;
  body: string;
  authorName?: string;
  authorColor?: string;
  createdAt: string;
};

export type ShareSnapshotComment = {
  id: string;
  body: string;
  authorName?: string;
  authorColor?: string;
  quote?: string;
  sourceQuote?: string;
  prefix?: string;
  suffix?: string;
  selectionStart?: number;
  selectionEnd?: number;
  resolved?: boolean;
  replies?: ShareSnapshotCommentReply[];
  createdAt: string;
};

export type ShareSnapshotPayload = {
  schemaVersion: typeof SHARE_SNAPSHOT_SCHEMA_VERSION;
  createdAt: string;
  rootFolderId: string;
  activeFileId: string;
  folders: ShareSnapshotFolder[];
  files: ShareSnapshotFile[];
  commentsByFileId: Record<string, ShareSnapshotComment[]>;
};

export type ShareSnapshot = ShareSnapshotPayload & {
  id: string;
  url: string;
};

export const createShareSnapshotPayload = ({
  files,
  folders,
  rootFolderId,
  activeFileId,
  commentsByFileId,
  now = () => new Date(),
}: {
  files: ShareSnapshotSourceFile[];
  folders: ShareSnapshotSourceFolder[];
  rootFolderId: string;
  activeFileId: string;
  commentsByFileId: Record<string, ShareSnapshotComment[]>;
  now?: () => Date;
}): ShareSnapshotPayload => {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const root = foldersById.get(rootFolderId);
  if (!root || root.parentId !== null) {
    throw new Error("Share link failed: invalid workspace root");
  }

  const snapshotFiles = files.map((file, index): ShareSnapshotFile => ({
    id: file.id,
    title: file.title,
    text: file.text,
    parentId: foldersById.has(file.parentId ?? "") ? file.parentId! : rootFolderId,
    order: Number.isFinite(file.order) ? file.order! : index,
  }));
  if (snapshotFiles.length === 0) {
    throw new Error("Share link failed: no documents selected");
  }

  const includedFolderIds = new Set([rootFolderId]);
  for (const file of snapshotFiles) {
    let parentId: string | null = file.parentId;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      includedFolderIds.add(parentId);
      parentId = foldersById.get(parentId)?.parentId ?? null;
    }
  }
  const snapshotFolders = folders
    .filter((folder) => includedFolderIds.has(folder.id))
    .map((folder, index): ShareSnapshotFolder => ({
      id: folder.id,
      title: folder.title,
      parentId: folder.id === rootFolderId ? null : folder.parentId,
      order: Number.isFinite(folder.order) ? folder.order! : index,
    }));
  const activeFile = snapshotFiles.find((file) => file.id === activeFileId) ?? snapshotFiles[0]!;

  return validateShareSnapshotPayload({
    schemaVersion: SHARE_SNAPSHOT_SCHEMA_VERSION,
    createdAt: now().toISOString(),
    rootFolderId,
    activeFileId: activeFile.id,
    folders: snapshotFolders,
    files: snapshotFiles,
    commentsByFileId: toShareSnapshotComments(snapshotFiles, commentsByFileId),
  });
};

export const createShareSnapshot = ({
  id,
  url,
  payload,
}: {
  id: string;
  url: string;
  payload: ShareSnapshotPayload;
}): ShareSnapshot => ({ ...payload, id, url });

export const validateShareSnapshotPayload = (value: unknown): ShareSnapshotPayload => {
  if (!isRecord(value) || value.schemaVersion !== SHARE_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error("Share link failed: unsupported snapshot payload");
  }
  if (!Array.isArray(value.files) || !Array.isArray(value.folders) || !isRecord(value.commentsByFileId)) {
    throw new Error("Share link failed: invalid snapshot payload");
  }

  const rootFolderId = requireNonEmptyString(value.rootFolderId, "rootFolderId");
  const folders = value.folders.map(validateShareSnapshotFolder);
  const files = value.files.map(validateShareSnapshotFile);
  if (files.length > WORKSPACE_ROOM_MAX_DOCUMENTS || folders.length - 1 > WORKSPACE_ROOM_MAX_FOLDERS) {
    throw new Error("Share link failed: workspace is too large");
  }
  const folderIds = new Set<string>();
  for (const folder of folders) {
    if (folderIds.has(folder.id)) throw new Error("Share link failed: duplicate folder id");
    folderIds.add(folder.id);
  }
  const root = folders.find((folder) => folder.id === rootFolderId);
  if (!root || root.parentId !== null) throw new Error("Share link failed: invalid workspace root");
  const foldersById = new Map(folders.map((item) => [item.id, item]));
  for (const folder of folders) {
    if (folder.id !== rootFolderId && (!folder.parentId || !folderIds.has(folder.parentId))) {
      throw new Error("Share link failed: invalid folder parent");
    }
    assertFolderHasNoCycle(folder.id, rootFolderId, foldersById);
  }

  const fileIds = new Set<string>();
  for (const file of files) {
    if (fileIds.has(file.id) || folderIds.has(file.id)) throw new Error("Share link failed: duplicate file id");
    if (!folderIds.has(file.parentId)) throw new Error("Share link failed: invalid file parent");
    fileIds.add(file.id);
  }
  if (files.length === 0 || !fileIds.has(requireNonEmptyString(value.activeFileId, "activeFileId"))) {
    throw new Error("Share link failed: invalid active file");
  }
  for (const fileId of Object.keys(value.commentsByFileId)) {
    if (!fileIds.has(fileId)) throw new Error("Share link failed: comments reference an unknown file");
  }
  const commentsByFileId = validateCommentsByFileId(value.commentsByFileId);
  const comments = Object.values(commentsByFileId).flat();
  if (comments.length > WORKSPACE_ROOM_MAX_COMMENTS) {
    throw new Error("Share link failed: too many comments");
  }
  const contentBytes = files.reduce((total, file) => total + textEncoder.encode(file.text).byteLength, 0) +
    comments.reduce((total, comment) => total + textEncoder.encode(comment.body).byteLength +
      (comment.replies ?? []).reduce((replyTotal, reply) => replyTotal + textEncoder.encode(reply.body).byteLength, 0), 0);
  if (contentBytes > WORKSPACE_ROOM_MAX_CONTENT_BYTES) {
    throw new Error("Share link failed: workspace content exceeds 10 MiB");
  }

  return {
    schemaVersion: SHARE_SNAPSHOT_SCHEMA_VERSION,
    createdAt: requireNonEmptyString(value.createdAt, "createdAt"),
    rootFolderId,
    activeFileId: value.activeFileId as string,
    folders,
    files,
    commentsByFileId,
  };
};

const assertFolderHasNoCycle = (
  folderId: string,
  rootFolderId: string,
  foldersById: Map<string, ShareSnapshotFolder>,
) => {
  const visited = new Set<string>();
  let currentId: string | null = folderId;
  let depth = 0;
  while (currentId && currentId !== rootFolderId) {
    if (visited.has(currentId)) throw new Error("Share link failed: cyclic folder tree");
    visited.add(currentId);
    currentId = foldersById.get(currentId)?.parentId ?? null;
    depth += 1;
    if (depth > WORKSPACE_ROOM_MAX_TREE_DEPTH) throw new Error("Share link failed: folder tree is too deep");
  }
  if (currentId !== rootFolderId) throw new Error("Share link failed: detached folder tree");
};

const toShareSnapshotComments = (
  files: ShareSnapshotFile[],
  commentsByFileId: Record<string, ShareSnapshotComment[]>,
): Record<string, ShareSnapshotComment[]> => {
  const fileIds = new Set(files.map((file) => file.id));
  return Object.fromEntries(
    Object.entries(commentsByFileId)
      .filter(([fileId, comments]) => fileIds.has(fileId) && comments.length > 0)
      .map(([fileId, comments]) => [fileId, comments.map(toShareSnapshotComment)]),
  );
};

const toShareSnapshotComment = (comment: ShareSnapshotComment): ShareSnapshotComment => ({
  id: comment.id,
  body: comment.body,
  ...(comment.authorName ? { authorName: comment.authorName } : {}),
  ...(comment.authorColor ? { authorColor: comment.authorColor } : {}),
  ...(comment.quote ? { quote: comment.quote } : {}),
  ...(comment.sourceQuote ? { sourceQuote: comment.sourceQuote } : {}),
  ...(comment.prefix ? { prefix: comment.prefix } : {}),
  ...(comment.suffix ? { suffix: comment.suffix } : {}),
  ...(typeof comment.selectionStart === "number" ? { selectionStart: comment.selectionStart } : {}),
  ...(typeof comment.selectionEnd === "number" ? { selectionEnd: comment.selectionEnd } : {}),
  ...(typeof comment.resolved === "boolean" ? { resolved: comment.resolved } : {}),
  ...(comment.replies ? { replies: comment.replies.map(toShareSnapshotCommentReply) } : {}),
  createdAt: comment.createdAt,
});

const toShareSnapshotCommentReply = (reply: ShareSnapshotCommentReply): ShareSnapshotCommentReply => ({
  id: reply.id,
  body: reply.body,
  ...(reply.authorName ? { authorName: reply.authorName } : {}),
  ...(reply.authorColor ? { authorColor: reply.authorColor } : {}),
  createdAt: reply.createdAt,
});

const validateShareSnapshotFolder = (value: unknown): ShareSnapshotFolder => {
  if (!isRecord(value)) throw new Error("Share link failed: invalid snapshot folder");
  return {
    id: requireIdentifier(value.id, "folder.id"),
    title: requireTitle(value.title, "folder.title"),
    parentId: value.parentId === null ? null : requireIdentifier(value.parentId, "folder.parentId"),
    order: requireFiniteNumber(value.order, "folder.order"),
  };
};

const validateShareSnapshotFile = (value: unknown): ShareSnapshotFile => {
  if (!isRecord(value)) throw new Error("Share link failed: invalid snapshot file");
  return {
    id: requireIdentifier(value.id, "file.id"),
    title: requireTitle(value.title, "file.title"),
    text: requireString(value.text, "file.text"),
    parentId: requireNonEmptyString(value.parentId, "file.parentId"),
    order: requireFiniteNumber(value.order, "file.order"),
  };
};

const validateCommentsByFileId = (value: Record<string, unknown>): Record<string, ShareSnapshotComment[]> =>
  Object.fromEntries(Object.entries(value).map(([fileId, comments]) => {
    if (!Array.isArray(comments)) throw new Error("Share link failed: invalid snapshot comments");
    return [fileId, comments.map(validateComment)] as const;
  }));

const validateComment = (value: unknown): ShareSnapshotComment => {
  if (!isRecord(value)) throw new Error("Share link failed: invalid snapshot comment");
  return {
    id: requireIdentifier(value.id, "comment.id"),
    body: requireBoundedString(value.body, "comment.body", WORKSPACE_ROOM_MAX_COMMENT_LENGTH),
    ...optionalString(value.authorName, "authorName"),
    ...optionalString(value.authorColor, "authorColor"),
    ...optionalString(value.quote, "quote"),
    ...optionalString(value.sourceQuote, "sourceQuote"),
    ...optionalString(value.prefix, "prefix"),
    ...optionalString(value.suffix, "suffix"),
    ...optionalNumber(value.selectionStart, "selectionStart"),
    ...optionalNumber(value.selectionEnd, "selectionEnd"),
    ...optionalBoolean(value.resolved, "resolved"),
    ...(value.replies === undefined ? {} : { replies: validateReplies(value.replies) }),
    createdAt: requireNonEmptyString(value.createdAt, "comment.createdAt"),
  };
};

const validateReplies = (value: unknown): ShareSnapshotCommentReply[] => {
  if (!Array.isArray(value)) throw new Error("Share link failed: invalid snapshot replies");
  if (value.length > WORKSPACE_ROOM_MAX_REPLIES) throw new Error("Share link failed: too many comment replies");
  return value.map((reply) => {
    if (!isRecord(reply)) throw new Error("Share link failed: invalid snapshot reply");
    return {
      id: requireIdentifier(reply.id, "reply.id"),
      body: requireBoundedString(reply.body, "reply.body", WORKSPACE_ROOM_MAX_COMMENT_LENGTH),
      ...optionalString(reply.authorName, "authorName"),
      ...optionalString(reply.authorColor, "authorColor"),
      createdAt: requireNonEmptyString(reply.createdAt, "reply.createdAt"),
    };
  });
};

const optionalString = (value: unknown, fieldName: string) =>
  value === undefined ? {} : { [fieldName]: requireString(value, fieldName) };

const optionalNumber = (value: unknown, fieldName: string) =>
  value === undefined ? {} : { [fieldName]: requireFiniteNumber(value, fieldName) };

const optionalBoolean = (value: unknown, fieldName: string) => {
  if (value === undefined) return {};
  if (typeof value !== "boolean") throw new Error(`Share link failed: missing ${fieldName}`);
  return { [fieldName]: value };
};

const requireFiniteNumber = (value: unknown, fieldName: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Share link failed: missing ${fieldName}`);
  }
  return value;
};

const requireString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string") throw new Error(`Share link failed: missing ${fieldName}`);
  return value;
};

const requireNonEmptyString = (value: unknown, fieldName: string) => {
  const text = requireString(value, fieldName);
  if (!text) throw new Error(`Share link failed: missing ${fieldName}`);
  return text;
};

const requireBoundedString = (value: unknown, fieldName: string, maxLength: number) => {
  const text = requireString(value, fieldName);
  if (text.length > maxLength) throw new Error(`Share link failed: ${fieldName} is too long`);
  return text;
};

const requireIdentifier = (value: unknown, fieldName: string) => {
  const text = requireNonEmptyString(value, fieldName);
  if (text.length > 200 || text.includes("\0")) throw new Error(`Share link failed: invalid ${fieldName}`);
  return text;
};

const requireTitle = (value: unknown, fieldName: string) => {
  const text = requireBoundedString(value, fieldName, 120).trim();
  if (!text || text === "." || text === ".." || text.includes("\0") || /[/\\]/.test(text)) {
    throw new Error(`Share link failed: invalid ${fieldName}`);
  }
  return text;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
