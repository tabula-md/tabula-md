import { useEffect, useMemo, useState } from "react";
import {
  type TextPatch,
  WORKSPACE_ROOM_MAX_COMMENTS,
  WORKSPACE_ROOM_MAX_COMMENT_LENGTH,
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_MAX_REPLIES,
} from "@tabula-md/tabula";
import type { Collaborator } from "../collaboration/liveCollaboration";
import { mapSessionCommentAnchors } from "./commentAnchorSessionModel";
import type { FileComment, FileCommentReply, WorkspaceFile } from "../workspace/workspaceStorage";

export type CommentSelectionAnchor = {
  start: number;
  end: number;
  sourceQuote: string;
};

type AddFileCommentOptions = {
  fileId: string;
  body: string;
  quote?: string;
  anchor?: CommentSelectionAnchor | null;
};

export type DeletedFileComment = {
  comment: FileComment;
  fileId: string;
  index: number;
};

type UseFileCommentsOptions = {
  initialCommentsByFileId: Record<string, FileComment[]>;
  activeFileId: string;
  files: WorkspaceFile[];
  isRoomSession: boolean;
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

const getWorkspaceContentBytes = ({
  commentsByFileId,
  files,
}: {
  commentsByFileId: Record<string, FileComment[]>;
  files: WorkspaceFile[];
}) => files.reduce(
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
  isRoomSession,
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
      (isRoomSession && targetFile && getWorkspaceContentBytes({ commentsByFileId, files }) +
        utf8Encoder.encode(trimmedDraft).byteLength > WORKSPACE_ROOM_MAX_CONTENT_BYTES)
    ) {
      return null;
    }

    const nextComment: FileComment = {
      id: createId(),
      body: trimmedDraft.slice(0, WORKSPACE_ROOM_MAX_COMMENT_LENGTH),
      anchorDetached: false,
      authorName: identity.name,
      authorColor: identity.color,
      quote,
      sourceQuote: anchor?.sourceQuote,
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
      return undefined;
    }

    const comments = getFileComments(commentsByFileId, fileId);
    const index = comments.findIndex((comment) => comment.id === commentId);
    const comment = comments[index];
    if (!comment) return undefined;

    setCommentsByFileId((currentComments) => ({
      ...currentComments,
      [fileId]: getFileComments(currentComments, fileId).filter((comment) => comment.id !== commentId),
    }));
    setFocusedCommentId((currentCommentId) => (currentCommentId === commentId ? null : currentCommentId));
    onCommentDeleted?.(fileId, commentId);
    return { comment, fileId, index } satisfies DeletedFileComment;
  };

  const restoreFileComment = ({ comment, fileId, index }: DeletedFileComment) => {
    if (!fileIds.has(fileId)) return false;
    setCommentsByFileId((currentComments) => {
      const comments = getFileComments(currentComments, fileId);
      if (comments.some((candidate) => candidate.id === comment.id)) return currentComments;
      const nextComments = [...comments];
      nextComments.splice(Math.min(Math.max(0, index), nextComments.length), 0, comment);
      return { ...currentComments, [fileId]: nextComments };
    });
    onCommentCreated?.(fileId, comment);
    return true;
  };

  const deleteCommentsForFiles = (deletedFileIds: ReadonlySet<string>) => {
    const deletedComments = Object.fromEntries(
      Object.entries(commentsByFileId).filter(([fileId, comments]) =>
        deletedFileIds.has(fileId) && comments.length > 0,
      ),
    );
    if (Object.keys(deletedComments).length === 0) return deletedComments;
    setCommentsByFileId((currentComments) =>
      Object.fromEntries(
        Object.entries(currentComments).filter(([fileId]) => !deletedFileIds.has(fileId)),
      ),
    );
    setFocusedCommentId((commentId) =>
      commentId && Object.values(deletedComments).flat().some((comment) => comment.id === commentId)
        ? null
        : commentId,
    );
    return deletedComments;
  };

  const restoreCommentsForFiles = (deletedComments: Record<string, FileComment[]>) => {
    const restorableEntries = Object.entries(deletedComments).filter(([fileId]) => fileIds.has(fileId));
    if (restorableEntries.length === 0) return;
    setCommentsByFileId((currentComments) => ({
      ...currentComments,
      ...Object.fromEntries(restorableEntries),
    }));
    for (const [fileId, comments] of restorableEntries) {
      for (const comment of comments) onCommentCreated?.(fileId, comment);
    }
  };

  const mapFileCommentAnchors = (
    fileId: string,
    patches: readonly TextPatch[],
    oldDocumentLength: number,
  ) => {
    if (!fileIds.has(fileId) || patches.length === 0) {
      return;
    }

    setCommentsByFileId((currentComments) => {
      const comments = getFileComments(currentComments, fileId);
      const nextComments = mapSessionCommentAnchors({
        comments,
        isRoomSession,
        oldDocumentLength,
        patches,
      });
      return nextComments === comments
        ? currentComments
        : { ...currentComments, [fileId]: [...nextComments] };
    });
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
      (isRoomSession && targetFile &&
        getWorkspaceContentBytes({
          commentsByFileId,
          files,
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
    mapFileCommentAnchors,
    deleteFileComment,
    restoreFileComment,
    deleteCommentsForFiles,
    restoreCommentsForFiles,
    toggleFileCommentResolved,
    startCommentReply,
    cancelCommentReply,
    updateCommentReplyDraft,
    addFileCommentReply,
  };
}
