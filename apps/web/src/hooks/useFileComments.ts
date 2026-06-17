import { useEffect, useState } from "react";
import type { Collaborator } from "../collab";
import type { FileComment, FileCommentReply, MarkdownFile } from "../workspaceStorage";

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
  files: MarkdownFile[];
  identity: Collaborator;
  createId: () => string;
};

const getFileComments = (commentsByFileId: Record<string, FileComment[]>, fileId: string) =>
  commentsByFileId[fileId] ?? [];

export function useFileComments({
  initialCommentsByFileId,
  activeFileId,
  files,
  identity,
  createId,
}: UseFileCommentsOptions) {
  const [commentsByFileId, setCommentsByFileId] =
    useState<Record<string, FileComment[]>>(() => initialCommentsByFileId);
  const [commentDraft, setCommentDraft] = useState("");
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [replyDraftByCommentId, setReplyDraftByCommentId] = useState<Record<string, string>>({});
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);

  const activeFileComments = activeFileId ? getFileComments(commentsByFileId, activeFileId) : [];
  const activeOpenComments = activeFileComments.filter((comment) => !comment.resolved);
  const fileIds = new Set(files.map((file) => file.id));

  const resetCommentInteraction = () => {
    setCommentDraft("");
    setFocusedCommentId(null);
    setActiveReplyCommentId(null);
    setReplyDraftByCommentId({});
  };

  useEffect(() => {
    resetCommentInteraction();
  }, [activeFileId]);

  const replaceCommentsByFileId = (nextCommentsByFileId: Record<string, FileComment[]>) => {
    setCommentsByFileId(nextCommentsByFileId);
    resetCommentInteraction();
  };

  const addFileComment = ({ fileId, body, quote, anchor }: AddFileCommentOptions) => {
    if (!fileIds.has(fileId)) {
      return null;
    }

    const trimmedDraft = body.trim();
    if (!trimmedDraft) {
      return null;
    }

    const nextComment: FileComment = {
      id: createId(),
      body: trimmedDraft,
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
  };

  const toggleFileCommentResolved = (fileId: string, commentId: string) => {
    if (!fileIds.has(fileId)) {
      return;
    }

    setCommentsByFileId((currentComments) => ({
      ...currentComments,
      [fileId]: getFileComments(currentComments, fileId).map((comment) =>
        comment.id === commentId ? { ...comment, resolved: !comment.resolved } : comment,
      ),
    }));
    setFocusedCommentId((currentCommentId) => (currentCommentId === commentId ? null : currentCommentId));
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
      [commentId]: draft,
    }));
  };

  const addFileCommentReply = (fileId: string, commentId: string) => {
    if (!fileIds.has(fileId)) {
      return null;
    }

    const trimmedDraft = (replyDraftByCommentId[commentId] ?? "").trim();
    if (!trimmedDraft) {
      return null;
    }

    const nextReply: FileCommentReply = {
      id: createId(),
      body: trimmedDraft,
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
