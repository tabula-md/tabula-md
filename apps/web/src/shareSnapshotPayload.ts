import type { FileComment, FileCommentReply, MarkdownFile } from "./workspaceStorage";

export const SHARE_SNAPSHOT_SCHEMA_VERSION = 1;

export type ShareSnapshotFile = {
  id: string;
  title: string;
  text: string;
};

export type ShareSnapshotPayload = {
  schemaVersion: typeof SHARE_SNAPSHOT_SCHEMA_VERSION;
  createdAt: string;
  activeFileId: string;
  files: ShareSnapshotFile[];
  commentsByFileId: Record<string, FileComment[]>;
};

export type ShareSnapshot = ShareSnapshotPayload & {
  id: string;
  url: string;
};

export const createShareSnapshotPayload = ({
  files,
  activeFileId,
  commentsByFileId,
  now = () => new Date(),
}: {
  files: MarkdownFile[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
  now?: () => Date;
}): ShareSnapshotPayload => {
  const snapshotFiles = files.map(toShareSnapshotFile);
  const activeFile = snapshotFiles.find((file) => file.id === activeFileId) ?? snapshotFiles[0];

  return {
    schemaVersion: SHARE_SNAPSHOT_SCHEMA_VERSION,
    createdAt: now().toISOString(),
    activeFileId: activeFile?.id ?? activeFileId,
    files: snapshotFiles,
    commentsByFileId: toShareSnapshotComments(snapshotFiles, commentsByFileId),
  };
};

export const createShareSnapshot = ({
  id,
  url,
  payload,
}: {
  id: string;
  url: string;
  payload: ShareSnapshotPayload;
}): ShareSnapshot => ({
  ...payload,
  id,
  url,
});

export const validateShareSnapshotPayload = (value: unknown): ShareSnapshotPayload => {
  if (!isRecord(value)) {
    throw new Error("Share link failed: invalid snapshot payload");
  }
  if (value.schemaVersion !== SHARE_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error("Share link failed: unsupported snapshot payload");
  }
  if (!Array.isArray(value.files) || !isRecord(value.commentsByFileId)) {
    throw new Error("Share link failed: invalid snapshot payload");
  }

  const files = value.files.map(validateShareSnapshotFile);
  return {
    schemaVersion: SHARE_SNAPSHOT_SCHEMA_VERSION,
    createdAt: requireNonEmptyString(value.createdAt, "createdAt"),
    activeFileId: requireNonEmptyString(value.activeFileId, "activeFileId"),
    files,
    commentsByFileId: validateCommentsByFileId(value.commentsByFileId),
  };
};

const toShareSnapshotFile = (file: MarkdownFile): ShareSnapshotFile => ({
  id: file.id,
  title: file.title,
  text: file.text,
});

const toShareSnapshotComments = (
  files: ShareSnapshotFile[],
  commentsByFileId: Record<string, FileComment[]>,
): Record<string, FileComment[]> => {
  const fileIds = new Set(files.map((file) => file.id));
  const snapshotComments: Record<string, FileComment[]> = {};

  for (const [fileId, comments] of Object.entries(commentsByFileId)) {
    if (!fileIds.has(fileId) || comments.length === 0) {
      continue;
    }
    snapshotComments[fileId] = comments.map(toShareSnapshotComment);
  }

  return snapshotComments;
};

const toShareSnapshotComment = (comment: FileComment): FileComment => ({
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

const toShareSnapshotCommentReply = (reply: FileCommentReply): FileCommentReply => ({
  id: reply.id,
  body: reply.body,
  ...(reply.authorName ? { authorName: reply.authorName } : {}),
  ...(reply.authorColor ? { authorColor: reply.authorColor } : {}),
  createdAt: reply.createdAt,
});

const validateShareSnapshotFile = (value: unknown): ShareSnapshotFile => {
  if (!isRecord(value)) {
    throw new Error("Share link failed: invalid snapshot file");
  }
  return {
    id: requireNonEmptyString(value.id, "file.id"),
    title: requireString(value.title, "file.title"),
    text: requireString(value.text, "file.text"),
  };
};

const validateCommentsByFileId = (value: Record<string, unknown>): Record<string, FileComment[]> =>
  Object.fromEntries(
    Object.entries(value).map(([fileId, comments]) => {
      if (!Array.isArray(comments)) {
        throw new Error("Share link failed: invalid snapshot comments");
      }
      return [fileId, comments.map(validateComment)] as const;
    }),
  );

const validateComment = (value: unknown): FileComment => {
  if (!isRecord(value)) {
    throw new Error("Share link failed: invalid snapshot comment");
  }
  return {
    id: requireNonEmptyString(value.id, "comment.id"),
    body: requireString(value.body, "comment.body"),
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

const validateReplies = (value: unknown): FileCommentReply[] => {
  if (!Array.isArray(value)) {
    throw new Error("Share link failed: invalid snapshot replies");
  }
  return value.map(validateReply);
};

const validateReply = (value: unknown): FileCommentReply => {
  if (!isRecord(value)) {
    throw new Error("Share link failed: invalid snapshot reply");
  }
  return {
    id: requireNonEmptyString(value.id, "reply.id"),
    body: requireString(value.body, "reply.body"),
    ...optionalString(value.authorName, "authorName"),
    ...optionalString(value.authorColor, "authorColor"),
    createdAt: requireNonEmptyString(value.createdAt, "reply.createdAt"),
  };
};

const optionalString = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return {};
  }
  return { [fieldName]: requireString(value, fieldName) };
};

const optionalNumber = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Share link failed: missing ${fieldName}`);
  }
  return { [fieldName]: value };
};

const optionalBoolean = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "boolean") {
    throw new Error(`Share link failed: missing ${fieldName}`);
  }
  return { [fieldName]: value };
};

const requireString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string") {
    throw new Error(`Share link failed: missing ${fieldName}`);
  }
  return value;
};

const requireNonEmptyString = (value: unknown, fieldName: string) => {
  const text = requireString(value, fieldName);
  if (!text) {
    throw new Error(`Share link failed: missing ${fieldName}`);
  }
  return text;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
