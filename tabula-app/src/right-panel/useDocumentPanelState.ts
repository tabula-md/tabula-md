import { useEffect, useState } from "react";
import type { FileComment } from "../workspace/workspaceStorage";

type UseDocumentPanelStateOptions = {
  activeFileId: string;
  activeCommentId?: string | null;
  activeReplyCommentId?: string | null;
  commentsByFileId: Record<string, FileComment[]>;
};

export type DocumentPanelLinkSection = "outgoing" | "backlinks";

const emptyCollapsedOutlineHeadingIds = new Set<string>();

const toggleSetValue = <Value,>(currentIds: Set<Value>, id: Value) => {
  const nextIds = new Set(currentIds);
  if (nextIds.has(id)) {
    nextIds.delete(id);
  } else {
    nextIds.add(id);
  }
  return nextIds;
};

export function useDocumentPanelState({
  activeFileId,
  activeCommentId,
  activeReplyCommentId,
  commentsByFileId,
}: UseDocumentPanelStateOptions) {
  const [showResolved, setShowResolved] = useState(false);
  const [collapsedReplyIds, setCollapsedReplyIds] = useState<Set<string>>(() => new Set());
  const [collapsedCommentFileIds, setCollapsedCommentFileIds] = useState<Set<string>>(() => new Set());
  const [collapsedLinkSections, setCollapsedLinkSections] = useState<Set<DocumentPanelLinkSection>>(
    () => new Set(),
  );
  const [
    collapsedOutlineHeadingIdsByFileId,
    setCollapsedOutlineHeadingIdsByFileId,
  ] = useState<Map<string, Set<string>>>(() => new Map());
  const collapsedOutlineHeadingIds =
    collapsedOutlineHeadingIdsByFileId.get(activeFileId) ??
    emptyCollapsedOutlineHeadingIds;

  useEffect(() => {
    setShowResolved(false);
    setCollapsedReplyIds(new Set());
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
    collapsedLinkSections,
    collapsedOutlineHeadingIds,
    toggleResolvedSection: () => setShowResolved((isVisible) => !isVisible),
    toggleRepliesCollapsed: (commentId: string) =>
      setCollapsedReplyIds((currentIds) => toggleSetValue(currentIds, commentId)),
    toggleCommentFileCollapsed: (fileId: string) =>
      setCollapsedCommentFileIds((currentIds) => toggleSetValue(currentIds, fileId)),
    toggleLinkSectionCollapsed: (section: DocumentPanelLinkSection) =>
      setCollapsedLinkSections((currentSections) => toggleSetValue(currentSections, section)),
    toggleOutlineHeadingCollapsed: (headingId: string) =>
      setCollapsedOutlineHeadingIdsByFileId((currentByFileId) => {
        const nextByFileId = new Map(currentByFileId);
        nextByFileId.set(
          activeFileId,
          toggleSetValue(
            currentByFileId.get(activeFileId) ?? new Set<string>(),
            headingId,
          ),
        );
        return nextByFileId;
      }),
    collapseAllOutlineHeadings: (headingIds: Iterable<string>) =>
      setCollapsedOutlineHeadingIdsByFileId((currentByFileId) => {
        const nextByFileId = new Map(currentByFileId);
        nextByFileId.set(activeFileId, new Set(headingIds));
        return nextByFileId;
      }),
    expandAllOutlineHeadings: () =>
      setCollapsedOutlineHeadingIdsByFileId((currentByFileId) => {
        if (!currentByFileId.has(activeFileId)) {
          return currentByFileId;
        }
        const nextByFileId = new Map(currentByFileId);
        nextByFileId.delete(activeFileId);
        return nextByFileId;
      }),
  };
}
