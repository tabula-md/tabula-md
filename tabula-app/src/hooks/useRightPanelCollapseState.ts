import { useEffect, useState } from "react";
import type { FileComment } from "../workspaceStorage";

type UseRightPanelCollapseStateArgs = {
  activeFileId: string;
  activeCommentId?: string | null;
  activeReplyCommentId?: string | null;
  commentsByFileId: Record<string, FileComment[]>;
};

const toggleSetValue = (currentIds: Set<string>, id: string) => {
  const nextIds = new Set(currentIds);
  if (nextIds.has(id)) {
    nextIds.delete(id);
  } else {
    nextIds.add(id);
  }
  return nextIds;
};

export function useRightPanelCollapseState({
  activeFileId,
  activeCommentId,
  activeReplyCommentId,
  commentsByFileId,
}: UseRightPanelCollapseStateArgs) {
  const [showResolved, setShowResolved] = useState(false);
  const [collapsedReplyIds, setCollapsedReplyIds] = useState<Set<string>>(() => new Set());
  const [collapsedCommentFileIds, setCollapsedCommentFileIds] = useState<Set<string>>(() => new Set());
  const [collapsedFileTreeFolderIds, setCollapsedFileTreeFolderIds] = useState<Set<string>>(() => new Set());
  const [collapsedOutlineHeadingIds, setCollapsedOutlineHeadingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setShowResolved(false);
    setCollapsedReplyIds(new Set());
    setCollapsedOutlineHeadingIds(new Set());
  }, [activeFileId]);

  useEffect(() => {
    if (!activeReplyCommentId) {
      return;
    }

    setCollapsedReplyIds((currentIds) => {
      if (!currentIds.has(activeReplyCommentId)) {
        return currentIds;
      }

      const nextIds = new Set(currentIds);
      nextIds.delete(activeReplyCommentId);
      return nextIds;
    });
  }, [activeReplyCommentId]);

  useEffect(() => {
    const commentId = activeReplyCommentId ?? activeCommentId;
    if (!commentId) {
      return;
    }

    const fileId = Object.entries(commentsByFileId).find(([, comments]) =>
      comments.some((comment) => comment.id === commentId),
    )?.[0];

    if (!fileId) {
      return;
    }

    setCollapsedCommentFileIds((currentIds) => {
      if (!currentIds.has(fileId)) {
        return currentIds;
      }

      const nextIds = new Set(currentIds);
      nextIds.delete(fileId);
      return nextIds;
    });
  }, [activeCommentId, activeReplyCommentId, commentsByFileId]);

  return {
    showResolved,
    collapsedReplyIds,
    collapsedCommentFileIds,
    collapsedFileTreeFolderIds,
    collapsedOutlineHeadingIds,
    toggleResolvedSection: () => setShowResolved((isVisible) => !isVisible),
    toggleRepliesCollapsed: (commentId: string) =>
      setCollapsedReplyIds((currentIds) => toggleSetValue(currentIds, commentId)),
    toggleCommentFileCollapsed: (fileId: string) =>
      setCollapsedCommentFileIds((currentIds) => toggleSetValue(currentIds, fileId)),
    toggleFileTreeFolderCollapsed: (folderId: string) =>
      setCollapsedFileTreeFolderIds((currentIds) => toggleSetValue(currentIds, folderId)),
    collapseAllFileTreeFolders: (folderIds: Iterable<string>) =>
      setCollapsedFileTreeFolderIds(new Set(folderIds)),
    expandAllFileTreeFolders: () => setCollapsedFileTreeFolderIds(new Set()),
    toggleOutlineHeadingCollapsed: (headingId: string) =>
      setCollapsedOutlineHeadingIds((currentIds) => toggleSetValue(currentIds, headingId)),
    collapseAllOutlineHeadings: (headingIds: Iterable<string>) =>
      setCollapsedOutlineHeadingIds(new Set(headingIds)),
    expandAllOutlineHeadings: () => setCollapsedOutlineHeadingIds(new Set()),
  };
}
