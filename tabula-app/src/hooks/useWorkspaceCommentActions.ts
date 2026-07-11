import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { getCommentRangeInText } from "../commentAnchors";
import {
  formatCommentDate,
  getCommentAnchors,
  getPreviewCommentAnchors,
  getPreviewLineAnnotations,
  toggleLineBookmarkInList,
} from "../commentRuntimeModel";
import type {
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "../markdownEditorTypes";
import type { AppToastState } from "./useAppToast";
import { useAnimationFrameTask } from "./useAnimationFrameTask";
import type { FileComment, FileBookmark, WorkspaceFile } from "../workspaceStorage";

type QueueEditorTextRange = (
  start: number,
  end?: number,
  options?: { preventScroll?: boolean },
) => void;

type ShowToast = (
  message: string,
  tone?: AppToastState["tone"],
  action?: Pick<AppToastState, "actionLabel" | "onAction">,
) => void;

type PendingSelectionComment = {
  fileId: string;
  quote: string;
  anchor: {
    start: number;
    end: number;
    sourceQuote: string;
  };
};

type UseWorkspaceCommentActionsArgs = {
  activeBookmarks: FileBookmark[];
  activeFile?: WorkspaceFile;
  activeFileComments: FileComment[];
  activeOpenComments: FileComment[];
  commentDraft: string;
  commentInputRef: RefObject<HTMLTextAreaElement | null>;
  createFileComment: (options: {
    fileId: string;
    body: string;
    quote?: string;
    anchor?: {
      start: number;
      end: number;
      sourceQuote: string;
    } | null;
  }) => FileComment | null;
  createId: () => string;
  files: WorkspaceFile[];
  focusedCommentId: string | null;
  getSelectedMarkdownAnchor: () => {
    start: number;
    end: number;
    sourceQuote: string;
  } | null;
  getSelectedMarkdownExcerpt: () => string;
  previewBody: string;
  previewBodyStartOffset: number;
  previewSurfaceRef: RefObject<HTMLElement | null>;
  largeDocumentMode: boolean;
  onBeforeCreateComment?: () => void;
  queueEditorTextRange: QueueEditorTextRange;
  selectFile: (fileId: string) => void;
  selectedCharacterCount: number;
  setActiveFileBookmarks: (bookmarks: FileBookmark[]) => void;
  setCenterPopover: (popover: null) => void;
  setFocusedCommentId: (commentId: string | null) => void;
  setRightPanelOpen: (isOpen: boolean) => void;
  setRightPanelView: (view: "comments") => void;
  setSelectionActionPosition: (position: MarkdownSelectionActionPosition | null) => void;
  setTopPopover: (popover: null) => void;
  showToast: ShowToast;
  startCommentReply: (commentId: string) => void;
  text: string;
};

export function useWorkspaceCommentActions({
  activeBookmarks,
  activeFile,
  activeFileComments,
  activeOpenComments,
  commentDraft,
  commentInputRef,
  createFileComment,
  createId,
  files,
  focusedCommentId,
  getSelectedMarkdownAnchor,
  getSelectedMarkdownExcerpt,
  previewBody,
  previewBodyStartOffset,
  previewSurfaceRef,
  largeDocumentMode,
  onBeforeCreateComment,
  queueEditorTextRange,
  selectFile,
  selectedCharacterCount,
  setActiveFileBookmarks,
  setCenterPopover,
  setFocusedCommentId,
  setRightPanelOpen,
  setRightPanelView,
  setSelectionActionPosition,
  setTopPopover,
  showToast,
  startCommentReply,
  text,
}: UseWorkspaceCommentActionsArgs) {
  const [selectionCommentPending, setSelectionCommentPending] = useState(false);
  const [pendingSelectionComment, setPendingSelectionComment] = useState<PendingSelectionComment | null>(null);
  const consumeSelectionCommentRequest = useCallback(() => setSelectionCommentPending(false), []);
  const cancelSelectionComment = useCallback(() => {
    setSelectionCommentPending(false);
    setPendingSelectionComment(null);
  }, []);
  const activeCommentAnchors = useMemo(
    () => getCommentAnchors(activeOpenComments, text),
    [activeOpenComments, text],
  );
  const activePreviewCommentAnchors = useMemo(
    () =>
      getPreviewCommentAnchors({
        commentAnchors: activeCommentAnchors,
        previewBody,
        previewBodyStartOffset,
      }),
    [activeCommentAnchors, previewBody, previewBodyStartOffset],
  );
  const activePreviewLineAnnotations = useMemo(
    () =>
      getPreviewLineAnnotations({
        body: previewBody,
        bodyStartOffset: previewBodyStartOffset,
        bookmarks: activeBookmarks,
        commentAnchors: [],
        includeEmptyLines: !largeDocumentMode,
      }),
    [activeBookmarks, largeDocumentMode, previewBody, previewBodyStartOffset],
  );
  const queueAnimationFrameTask = useAnimationFrameTask();

  useEffect(() => {
    setSelectionCommentPending(false);
    setPendingSelectionComment(null);
  }, [activeFile?.id]);

  const openCommentsPanel = useCallback((commentId?: string) => {
    setRightPanelOpen(true);
    setRightPanelView("comments");
    setTopPopover(null);
    setCenterPopover(null);

    if (commentId) {
      setFocusedCommentId(commentId);
      queueAnimationFrameTask(() => {
        document
          .querySelector<HTMLElement>(`.right-comment-card[data-comment-id="${commentId}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
    }
  }, [
    queueAnimationFrameTask,
    setCenterPopover,
    setFocusedCommentId,
    setRightPanelOpen,
    setRightPanelView,
    setTopPopover,
  ]);

  const addFileComment = useCallback((options: { includeSelection?: boolean } = {}) => {
    if (!activeFile) {
      return;
    }

    onBeforeCreateComment?.();
    const includeSelection = options.includeSelection ?? true;
    const capturedSelection = includeSelection && pendingSelectionComment?.fileId === activeFile.id
      ? pendingSelectionComment
      : null;
    createFileComment({
      fileId: activeFile.id,
      body: commentDraft,
      quote: capturedSelection?.quote,
      anchor: capturedSelection?.anchor,
    });
    if (includeSelection) {
      setPendingSelectionComment(null);
    }
  }, [
    activeFile,
    commentDraft,
    createFileComment,
    onBeforeCreateComment,
    pendingSelectionComment,
  ]);

  const startCommentReplyForFile = useCallback((_fileId: string, commentId: string) => {
    openCommentsPanel(commentId);
    startCommentReply(commentId);
  }, [openCommentsPanel, startCommentReply]);

  const goToFileComment = useCallback((fileId: string, comment: FileComment) => {
    const targetFile = files.find((file) => file.id === fileId);
    if (!targetFile) {
      return;
    }

    openCommentsPanel(comment.id);
    if (targetFile.id !== activeFile?.id) {
      selectFile(targetFile.id);
    }

    const commentRange = getCommentRangeInText(targetFile.text, comment);
    if (!commentRange) {
      showToast("Original text not found.", "neutral");
      return;
    }

    if (targetFile.viewMode === "preview") {
      queueAnimationFrameTask(() => {
        previewSurfaceRef.current
          ?.querySelector<HTMLElement>(`.preview-comment-mark[data-comment-id="${comment.id}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }

    queueEditorTextRange(commentRange.start, commentRange.end);
  }, [
    activeFile?.id,
    files,
    openCommentsPanel,
    previewSurfaceRef,
    queueAnimationFrameTask,
    queueEditorTextRange,
    selectFile,
    showToast,
  ]);

  const openCommentMarker = useCallback((commentId: string) => {
    const comment = activeFileComments.find((fileComment) => fileComment.id === commentId);
    if (!comment) {
      openCommentsPanel(commentId);
      return;
    }

    if (activeFile) {
      goToFileComment(activeFile.id, comment);
    }
  }, [activeFile, activeFileComments, goToFileComment, openCommentsPanel]);

  const openSelectionComment = useCallback(() => {
    const anchor = getSelectedMarkdownAnchor();
    const quote = getSelectedMarkdownExcerpt();
    if (!activeFile || !selectedCharacterCount || !anchor || !quote) {
      return;
    }

    setPendingSelectionComment({ fileId: activeFile.id, anchor, quote });
    setFocusedCommentId(null);
    setSelectionActionPosition(null);
    openCommentsPanel();
    setSelectionCommentPending(true);
    queueAnimationFrameTask(() => commentInputRef.current?.focus());
  }, [
    activeFile,
    commentInputRef,
    getSelectedMarkdownAnchor,
    getSelectedMarkdownExcerpt,
    openCommentsPanel,
    queueAnimationFrameTask,
    selectedCharacterCount,
    setFocusedCommentId,
    setSelectionActionPosition,
  ]);

  const toggleLineBookmark = useCallback((lineRange: MarkdownLineActionRequest) => {
    if (!activeFile) {
      return;
    }

    const nextBookmarks = toggleLineBookmarkInList({
      bookmarks: activeBookmarks,
      createId,
      lineStart: lineRange.start,
      lineEnd: lineRange.end,
      nowIso: new Date().toISOString(),
    });

    setActiveFileBookmarks(nextBookmarks);
  }, [activeBookmarks, activeFile, createId, setActiveFileBookmarks]);

  const handleLineAnnotationAction = useCallback((request: MarkdownLineActionRequest) => {
    setSelectionActionPosition(null);
    toggleLineBookmark(request);
  }, [setSelectionActionPosition, toggleLineBookmark]);

  return {
    activeCommentAnchors,
    activePreviewCommentAnchors,
    activePreviewLineAnnotations,
    addFileComment,
    cancelSelectionComment,
    formatCommentDate,
    goToFileComment,
    handleLineAnnotationAction,
    openCommentMarker,
    openCommentsPanel,
    openSelectionComment,
    pendingSelectionCommentText: pendingSelectionComment?.quote ?? "",
    selectionCommentPending,
    consumeSelectionCommentRequest,
    startCommentReply: startCommentReplyForFile,
  };
}
