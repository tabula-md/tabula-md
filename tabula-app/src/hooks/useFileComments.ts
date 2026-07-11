import { useEffect, useMemo, useState } from "react";
import {
  WORKSPACE_ROOM_MAX_COMMENTS,
  WORKSPACE_ROOM_MAX_COMMENT_LENGTH,
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_MAX_REPLIES,
} from "@tabula-md/tabula";
import type { Collaborator } from "../collaboration";
import type { FileComment, FileCommentReply, WorkspaceFile } from "../workspaceStorage";

export type CommentSelectionAnchor = {
  start: number;
  end: number;
  sourceQuote: string;
  prefix: string;
  suffix: string;
};

type AddFileCommentOptions = {
  fileId: string;
  body: string;
  quote?: string;
  anchor?: CommentSelectionAnchor | null;
};

type UseFileCommentsOptions = {
  initialCommentsByFileId: Record<string, FileComment[]>;
  activeFileId: string;
  files: WorkspaceFile[];
  identity: Collaborator;
  createId: () => string;
  onCommentCreated?: (fileId: string, comment: FileComment) => void;
  onCommentDeleted?: (fileId: string, commentId: string) => void;
  onCommentResolved?: (fileId: string, commentId: string, resolved: boolean) => void;
  onCommentReplyCreated?: (fileId: string, commentId: string, reply: FileCommentReply) => void;
};

const getFileComments = (commentsByFileId: Record<string, FileComment[]>, fileId: string) =>
  commentsByFileId[fileId] ?? [];

const utf8Encoder = new TextEncoder();

const getLiveRoomContentBytes = ({
  commentsByFileId,
  files,
  roomId,
}: {
  commentsByFileId: Record<string, FileComment[]>;
  files: WorkspaceFile[];
  roomId: string;
}) => files.filter((file) => file.roomId === roomId).reduce(
  (total, file) => total + utf8Encoder.encode(file.text).byteLength +
    getFileComments(commentsByFileId, file.id).reduce(
      (commentTotal, comment) => commentTotal + utf8Encoder.encode(comment.body).byteLength +
        (comment.replies ?? []).reduce((replyTotal, reply) => replyTotal + utf8Encoder.encode(reply.body).byteLength, 0),
      0,
    ),
  0,
);

export function useFileComments({
  initialCommentsByFileId,
  activeFileId,
  files,
  identity,
  createId,
  onCommentCreated,
  onCommentDeleted,
  onCommentResolved,
  onCommentReplyCreated,
}: UseFileCommentsOptions) {
  const [commentsByFileId, setCommentsByFileId] =
    useState<Record<string, FileComment[]>>(() => initialCommentsByFileId);
  const [commentDraft, setCommentDraft] = useState("");
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [replyDraftByCommentId, setReplyDraftByCommentId] = useState<Record<string, string>>({});
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);

  const activeFileComments = useMemo(
    () => (activeFileId ? getFileComments(commentsByFileId, activeFileId) : []),
    [activeFileId, commentsByFileId],
  );
  const activeOpenComments = useMemo(
    () => activeFileComments.filter((comment) => !comment.resolved),
    [activeFileComments],
  );
  const fileIds = useMemo(() => new Set(files.map((file) => file.id)), [files]);

  const resetCommentInteraction = () => {
    setCommentDraft("");
    setFocusedCommentId(null);
    setActiveReplyCommentId(null);
    setReplyDraftByCommentId({});
  };

  useEffect(() => {
    resetCommentInteraction();
  }, [activeFileId]);

  const replaceCommentsByFileId = (
    nextCommentsByFileId: Record<string, FileComment[]>,
    options: { preserveInteraction?: boolean } = {},
  ) => {
    setCommentsByFileId(nextCommentsByFileId);
    if (!options.preserveInteraction) {
      resetCommentInteraction();
      return;
    }

    const commentIds = new Set(
      Object.values(nextCommentsByFileId).flat().map((comment) => comment.id),
    );
    setFocusedCommentId((commentId) =>
      commentId && commentIds.has(commentId) ? commentId : null,
    );
    setActiveReplyCommentId((commentId) =>
      commentId && commentIds.has(commentId) ? commentId : null,
    );
    setReplyDraftByCommentId((currentDrafts) =>
      Object.fromEntries(
        Object.entries(currentDrafts).filter(([commentId]) => commentIds.has(commentId)),
      ),
    );
  };

  const addFileComment = ({ fileId, body, quote, anchor }: AddFileCommentOptions) => {
    if (!fileIds.has(fileId)) {
      return null;
    }

    const trimmedDraft = body.trim();
    const targetFile = files.find((file) => file.id === fileId);
    const commentCount = Object.values(commentsByFileId).reduce(
      (total, comments) => total + comments.length,
      0,
    );
    if (
      !trimmedDraft ||
      commentCount >= WORKSPACE_ROOM_MAX_COMMENTS ||
      (targetFile?.roomId && getLiveRoomContentBytes({ commentsByFileId, files, roomId: targetFile.roomId }) +
        utf8Encoder.encode(trimmedDraft).byteLength > WORKSPACE_ROOM_MAX_CONTENT_BYTES)
    ) {
      return null;
    }

    const nextComment: FileComment = {
      id: createId(),
      body: trimmedDraft.slice(0, WORKSPACE_ROOM_MAX_COMMENT_LENGTH),
      authorName: identity.name,
      authorColor: identity.color,
      quote,
      sourceQuote: anchor?.sourceQuote,
      prefix: anchor?.prefix,
      suffix: anchor?.suffix,
      selectionStart: anchor?.start,
      selectionEnd: anchor?.end,
      resolved: false,
      replies: [],
      createdAt: new Date().toISOString(),
    };

    setCommentsByFileId((currentComments) => ({
      ...currentComments,
      [fileId]: [nextComment, ...getFileComments(currentComments, fileId)],
    }));
    setFocusedCommentId(nextComment.id);
    setCommentDraft("");
    onCommentCreated?.(fileId, nextComment);
    return nextComment;
  };

  const deleteFileComment = (fileId: string, commentId: string) => {
    if (!fileIds.has(fileId)) {
      return;
    }

    setCommentsByFileId((currentComments) => ({
      ...currentComments,
      [fileId]: getFileComments(currentComments, fileId).filter((comment) => comment.id !== commentId),
    }));
    setFocusedCommentId((currentCommentId) => (currentCommentId === commentId ? null : currentCommentId));
    onCommentDeleted?.(fileId, commentId);
  };

  const toggleFileCommentResolved = (fileId: string, commentId: string) => {
    if (!fileIds.has(fileId)) {
      return;
    }

    const nextResolved = !getFileComments(commentsByFileId, fileId).find((comment) => comment.id === commentId)?.resolved;
    setCommentsByFileId((currentComments) => ({
      ...currentComments,
      [fileId]: getFileComments(currentComments, fileId).map((comment) =>
        comment.id === commentId ? { ...comment, resolved: nextResolved } : comment,
      ),
    }));
    setFocusedCommentId((currentCommentId) => (currentCommentId === commentId ? null : currentCommentId));
    onCommentResolved?.(fileId, commentId, nextResolved);
  };

  const startCommentReply = (commentId: string) => {
    setActiveReplyCommentId(commentId);
    setReplyDraftByCommentId((currentDrafts) => ({
      ...currentDrafts,
      [commentId]: currentDrafts[commentId] ?? "",
    }));
  };

  const cancelCommentReply = () => {
    setActiveReplyCommentId(null);
  };

  const updateCommentReplyDraft = (commentId: string, draft: string) => {
    setReplyDraftByCommentId((currentDrafts) => ({
      ...currentDrafts,
      [commentId]: draft.slice(0, WORKSPACE_ROOM_MAX_COMMENT_LENGTH),
    }));
  };

  const addFileCommentReply = (fileId: string, commentId: string) => {
    if (!fileIds.has(fileId)) {
      return null;
    }

    const trimmedDraft = (replyDraftByCommentId[commentId] ?? "").trim();
    const comment = getFileComments(commentsByFileId, fileId).find(
      (candidate) => candidate.id === commentId,
    );
    const targetFile = files.find((file) => file.id === fileId);
    if (
      !trimmedDraft ||
      !comment ||
      (comment.replies?.length ?? 0) >= WORKSPACE_ROOM_MAX_REPLIES ||
      (targetFile?.roomId &&
        getLiveRoomContentBytes({
          commentsByFileId,
          files,
          roomId: targetFile.roomId,
        }) + utf8Encoder.encode(trimmedDraft).byteLength > WORKSPACE_ROOM_MAX_CONTENT_BYTES)
    ) {
      return null;
    }

    const nextReply: FileCommentReply = {
      id: createId(),
      body: trimmedDraft.slice(0, WORKSPACE_ROOM_MAX_COMMENT_LENGTH),
      authorName: identity.name,
      authorColor: identity.color,
      createdAt: new Date().toISOString(),
    };

    setCommentsByFileId((currentComments) => ({
      ...currentComments,
      [fileId]: getFileComments(currentComments, fileId).map((comment) =>
        comment.id === commentId ? { ...comment, replies: [...(comment.replies ?? []), nextReply] } : comment,
      ),
    }));
    setReplyDraftByCommentId((currentDrafts) => ({
      ...currentDrafts,
      [commentId]: "",
    }));
    setActiveReplyCommentId(null);
    setFocusedCommentId(commentId);
    onCommentReplyCreated?.(fileId, commentId, nextReply);
    return nextReply;
  };

  return {
    commentsByFileId,
    commentDraft,
    activeReplyCommentId,
    replyDraftByCommentId,
    focusedCommentId,
    activeFileComments,
    activeOpenComments,
    setCommentDraft,
    setFocusedCommentId,
    replaceCommentsByFileId,
    addFileComment,
    deleteFileComment,
    toggleFileCommentResolved,
    startCommentReply,
    cancelCommentReply,
    updateCommentReplyDraft,
    addFileCommentReply,
  };
}
