import { useCallback, useMemo, type RefObject } from "react";
import { getCommentRangeInText } from "../commentAnchors";
import type {
  MarkdownCommentAnchor,
  MarkdownEditorHandle,
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "../markdownEditorTypes";
import type {
  MarkdownPreviewCommentAnchor,
  MarkdownPreviewLineAnnotation,
} from "../components/MarkdownPreview";
import {
  positionInSourceLine,
  sourceRangeIntersectsLine,
} from "../lineSurfaceModel";
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

export const isPositionInLineRange = (position: number, lineStart: number, lineEnd: number) =>
  positionInSourceLine(position, lineStart, lineEnd);

export const toggleLineBookmarkInList = ({
  bookmarks,
  createId,
  lineStart,
  lineEnd,
  nowIso,
}: {
  bookmarks: FileBookmark[];
  createId: () => string;
  lineStart: number;
  lineEnd: number;
  nowIso: string;
}) => {
  const existingBookmark = bookmarks.find((bookmark) =>
    isPositionInLineRange(bookmark.position, lineStart, lineEnd),
  );

  if (existingBookmark) {
    return bookmarks.filter((bookmark) => bookmark.id !== existingBookmark.id);
  }

  return [
    ...bookmarks,
    {
      id: createId(),
      position: lineStart,
      createdAt: nowIso,
    },
  ];
};

export const getCommentAnchors = (
  comments: FileComment[],
  sourceText: string,
): MarkdownCommentAnchor[] =>
  comments
    .map((comment) => {
      const commentRange = getCommentRangeInText(sourceText, comment);
      return commentRange ? { id: comment.id, start: commentRange.start, end: commentRange.end } : null;
    })
    .filter((anchor): anchor is MarkdownCommentAnchor => Boolean(anchor));

export const getPreviewCommentAnchors = ({
  commentAnchors,
  previewBody,
  previewBodyStartOffset,
}: {
  commentAnchors: MarkdownCommentAnchor[];
  previewBody: string;
  previewBodyStartOffset: number;
}): MarkdownPreviewCommentAnchor[] =>
  commentAnchors
    .map((anchor) => ({
      id: anchor.id,
      start: anchor.start - previewBodyStartOffset,
      end: anchor.end - previewBodyStartOffset,
    }))
    .filter((anchor) => anchor.end > 0 && anchor.start < previewBody.length)
    .map((anchor) => ({
      ...anchor,
      start: Math.max(0, anchor.start),
      end: Math.min(previewBody.length, anchor.end),
    }))
    .filter((anchor) => anchor.end > anchor.start);

export const getPreviewLineAnnotations = ({
  body,
  bodyStartOffset,
  bookmarks,
  commentAnchors,
  activeCommentId,
}: {
  body: string;
  bodyStartOffset: number;
  bookmarks: FileBookmark[];
  commentAnchors: MarkdownCommentAnchor[];
  activeCommentId?: string | null;
}): MarkdownPreviewLineAnnotation[] => {
  const lines = body.split("\n");
  let bodyOffset = 0;

  return lines.map((line, index) => {
    const start = bodyStartOffset + bodyOffset;
    const end = start + line.length;
    const sourceLine = { start, end };
    const hasBookmark = bookmarks.some((bookmark) => positionInSourceLine(bookmark.position, start, end));
    const lineComments = commentAnchors.filter((anchor) => sourceRangeIntersectsLine(anchor, sourceLine));
    bodyOffset += line.length + 1;

    return {
      lineNumber: index + 1,
      start,
      end,
      hasBookmark,
      hasComment: lineComments.length > 0,
      hasActiveComment: lineComments.some((anchor) => anchor.id === activeCommentId),
    };
  });
};

export const getCommentsInLineRange = ({
  comments,
  lineStart,
  lineEnd,
  sourceText,
}: {
  comments: FileComment[];
  lineStart: number;
  lineEnd: number;
  sourceText: string;
}) =>
  comments.filter((comment) => {
    const commentRange = getCommentRangeInText(sourceText, comment);
    return Boolean(commentRange && sourceRangeIntersectsLine(commentRange, { start: lineStart, end: lineEnd }));
  });

export const formatCommentDate = (isoDate: string, now = Date.now()) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (elapsedSeconds < 45) {
    return "just now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
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
      }),
    [activeBookmarks, activeCommentAnchors, focusedCommentId, previewBody, previewBodyStartOffset],
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

    const selectionAnchor = getSelectedMarkdownAnchor();
    createFileComment({
      fileId: activeFile.id,
      body: commentDraft,
      quote: getSelectedMarkdownExcerpt() || undefined,
      anchor: selectionAnchor,
    });
  }, [activeFile, commentDraft, commentsEnabled, createFileComment, getSelectedMarkdownAnchor, getSelectedMarkdownExcerpt]);

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
