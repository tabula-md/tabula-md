import { useCallback, useMemo, type RefObject } from "react";
import { getCommentRangeInText } from "../commentAnchors";
import {
  formatCommentDate,
  getCommentAnchors,
  getCommentsInLineRange,
  getPreviewCommentAnchors,
  getPreviewLineAnnotations,
  toggleLineBookmarkInList,
} from "../commentRuntimeModel";
import type {
  MarkdownEditorHandle,
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "../markdownEditorTypes";
import type { AppToastState } from "./useAppToast";
import { useAnimationFrameTask } from "./useAnimationFrameTask";
import type { FileComment, FileBookmark, FileViewMode, WorkspaceFile } from "../workspaceStorage";

type SetWorkspaceViewMode = (
  nextViewMode: FileViewMode,
  options?: { preserveScroll?: boolean; focusEditor?: boolean },
) => void;

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

type UseWorkspaceCommentActionsArgs = {
  activeBookmarks: FileBookmark[];
  activeFile?: WorkspaceFile;
  activeFileComments: FileComment[];
  activeOpenComments: FileComment[];
  activeViewMode: FileViewMode;
  clearPreviewSelection: () => void;
  commentDraft: string;
  commentsEnabled: boolean;
  commentInputRef: RefObject<HTMLTextAreaElement | null>;
  createFileComment: (options: {
    fileId: string;
    body: string;
    quote?: string;
    anchor?: {
      start: number;
      end: number;
      sourceQuote: string;
      prefix: string;
      suffix: string;
    } | null;
  }) => FileComment | null;
  createId: () => string;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  files: WorkspaceFile[];
  focusedCommentId: string | null;
  getSelectedMarkdownAnchor: () => {
    start: number;
    end: number;
    sourceQuote: string;
    prefix: string;
    suffix: string;
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
  setActiveFileViewMode: SetWorkspaceViewMode;
  setActiveFileBookmarks: (bookmarks: FileBookmark[]) => void;
  setActiveSelection: (selection: { from: number; to: number }) => void;
  setCenterPopover: (popover: null) => void;
  setFocusedCommentId: (commentId: string | null) => void;
  setRightPanelOpen: (isOpen: boolean) => void;
  setRightPanelView: (view: "comments") => void;
  setSelectionActionPosition: (position: MarkdownSelectionActionPosition | null) => void;
  setTopPopover: (popover: null) => void;
  showToast: ShowToast;
  startCommentReply: (commentId: string) => void;
  suppressSelectionActionPositionRef: RefObject<boolean>;
  text: string;
};

export function useWorkspaceCommentActions({
  activeBookmarks,
  activeFile,
  activeFileComments,
  activeOpenComments,
  activeViewMode,
  clearPreviewSelection,
  commentDraft,
  commentsEnabled,
  commentInputRef,
  createFileComment,
  createId,
  editorRef,
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
  setActiveFileViewMode,
  setActiveSelection,
  setCenterPopover,
  setFocusedCommentId,
  setRightPanelOpen,
  setRightPanelView,
  setSelectionActionPosition,
  setTopPopover,
  showToast,
  startCommentReply,
  suppressSelectionActionPositionRef,
  text,
}: UseWorkspaceCommentActionsArgs) {
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
        commentAnchors: activeCommentAnchors,
        activeCommentId: focusedCommentId,
        includeEmptyLines: !largeDocumentMode,
      }),
    [activeBookmarks, activeCommentAnchors, focusedCommentId, largeDocumentMode, previewBody, previewBodyStartOffset],
  );
  const queueAnimationFrameTask = useAnimationFrameTask();

  const openCommentsPanel = useCallback((commentId?: string) => {
    if (!commentsEnabled) {
      return;
    }

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
    commentsEnabled,
    setCenterPopover,
    setFocusedCommentId,
    setRightPanelOpen,
    setRightPanelView,
    setTopPopover,
  ]);

  const addFileComment = useCallback(() => {
    if (!activeFile || !commentsEnabled) {
      return;
    }

    onBeforeCreateComment?.();
    const selectionAnchor = getSelectedMarkdownAnchor();
    createFileComment({
      fileId: activeFile.id,
      body: commentDraft,
      quote: getSelectedMarkdownExcerpt() || undefined,
      anchor: selectionAnchor,
    });
  }, [
    activeFile,
    commentDraft,
    commentsEnabled,
    createFileComment,
    getSelectedMarkdownAnchor,
    getSelectedMarkdownExcerpt,
    onBeforeCreateComment,
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
    if (!commentsEnabled) {
      return;
    }

    const comment = activeFileComments.find((fileComment) => fileComment.id === commentId);
    if (!comment) {
      openCommentsPanel(commentId);
      return;
    }

    if (activeFile) {
      goToFileComment(activeFile.id, comment);
    }
  }, [activeFile, activeFileComments, commentsEnabled, goToFileComment, openCommentsPanel]);

  const openSelectionComment = useCallback(() => {
    if (!commentsEnabled || !selectedCharacterCount) {
      return;
    }

    setSelectionActionPosition(null);
    openCommentsPanel();
    queueAnimationFrameTask(() => commentInputRef.current?.focus());
  }, [
    commentInputRef,
    commentsEnabled,
    openCommentsPanel,
    queueAnimationFrameTask,
    selectedCharacterCount,
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

  const openLineComments = useCallback((lineRange: MarkdownLineActionRequest) => {
    if (!commentsEnabled) {
      return;
    }

    const lineComments = getCommentsInLineRange({
      comments: activeOpenComments,
      lineStart: lineRange.start,
      lineEnd: lineRange.end,
      sourceText: text,
    });
    openCommentsPanel(lineComments[0]?.id);
  }, [activeOpenComments, commentsEnabled, openCommentsPanel, text]);

  const openLineCommentComposer = useCallback((lineRange: MarkdownLineActionRequest) => {
    if (!commentsEnabled) {
      return;
    }

    const { start, end } = lineRange;
    if (end <= start) {
      showToast("Line comments need text on the line.", "error");
      return;
    }

    clearPreviewSelection();
    setActiveSelection({ from: start, to: end });
    setSelectionActionPosition(null);
    if (activeViewMode === "preview") {
      setActiveFileViewMode("edit", { preserveScroll: false, focusEditor: false });
    }

    queueAnimationFrameTask(() => {
      suppressSelectionActionPositionRef.current = true;
      editorRef.current?.setSelectionRange(start, end);
      suppressSelectionActionPositionRef.current = false;
      setSelectionActionPosition(null);
      openCommentsPanel();
      commentInputRef.current?.focus();
    });
  }, [
    activeViewMode,
    clearPreviewSelection,
    commentInputRef,
    commentsEnabled,
    editorRef,
    openCommentsPanel,
    queueAnimationFrameTask,
    setActiveFileViewMode,
    setActiveSelection,
    setSelectionActionPosition,
    showToast,
    suppressSelectionActionPositionRef,
  ]);

  const handleLineAnnotationAction = useCallback((request: MarkdownLineActionRequest) => {
    setSelectionActionPosition(null);
    if (request.action === "bookmark") {
      toggleLineBookmark(request);
      return;
    }

    if (!commentsEnabled) {
      return;
    }

    if (request.hasComment) {
      openLineComments(request);
      return;
    }

    openLineCommentComposer(request);
  }, [commentsEnabled, openLineCommentComposer, openLineComments, setSelectionActionPosition, toggleLineBookmark]);

  return {
    activeCommentAnchors,
    activePreviewCommentAnchors,
    activePreviewLineAnnotations,
    addFileComment,
    formatCommentDate,
    goToFileComment,
    handleLineAnnotationAction,
    openCommentMarker,
    openCommentsPanel,
    openSelectionComment,
    startCommentReply: startCommentReplyForFile,
  };
}
