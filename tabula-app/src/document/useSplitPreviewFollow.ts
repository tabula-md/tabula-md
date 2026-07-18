import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { MarkdownEditorHandle } from "./MarkdownEditor";
import type {
  EditorViewportAnchor,
  MarkdownPreviewHandle,
} from "../preview/previewSyncTypes";
import type { FileViewMode } from "../workspace/workspaceStorage";

export type SplitScrollSurface = "editor" | "preview";

type PendingPreviewFollow = {
  position: EditorViewportAnchor;
};

type MutableValueRef<T> = {
  current: T;
};

type UseSplitPreviewFollowArgs = {
  activeFileId?: string;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  previewFollowEnabled: boolean;
  previewRef: RefObject<MarkdownPreviewHandle | null>;
  scrollSyncingRef: MutableValueRef<boolean>;
  splitDividerDragging: boolean;
};

const normalizeEditorScrollPosition = (
  anchor: EditorViewportAnchor | null | undefined,
  editorRef: RefObject<MarkdownEditorHandle | null>,
): EditorViewportAnchor | null => {
  if (!anchor || !Number.isFinite(anchor.lineNumber)) {
    return null;
  }

  return {
    atDocumentEnd: anchor.atDocumentEnd,
    lineNumber: anchor.atDocumentEnd ? editorRef.current?.getLineCount() ?? anchor.lineNumber : anchor.lineNumber,
    lineOffsetRatio: anchor.atDocumentEnd ? 1 : anchor.lineOffsetRatio,
  };
};

export function useSplitPreviewFollow({
  activeFileId,
  activeViewMode,
  editorRef,
  previewFollowEnabled,
  previewRef,
  scrollSyncingRef,
  splitDividerDragging,
}: UseSplitPreviewFollowArgs) {
  const lastSplitScrollSurfaceRef = useRef<SplitScrollSurface>("editor");
  const pendingPreviewFollowRef = useRef<PendingPreviewFollow | null>(null);
  const previewFollowFrameRef = useRef<number | null>(null);

  const cancelPendingPreviewFollow = () => {
    pendingPreviewFollowRef.current = null;
    if (previewFollowFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFollowFrameRef.current);
      previewFollowFrameRef.current = null;
    }
  };

  const queuePreviewFollow = (position: EditorViewportAnchor | null) => {
    if (!previewFollowEnabled || !position) {
      if (!previewFollowEnabled) {
        cancelPendingPreviewFollow();
      }
      return;
    }

    lastSplitScrollSurfaceRef.current = "editor";
    pendingPreviewFollowRef.current = { position };
    if (previewFollowFrameRef.current !== null) {
      return;
    }

    previewFollowFrameRef.current = window.requestAnimationFrame(() => {
      previewFollowFrameRef.current = null;
      const pendingFollow = pendingPreviewFollowRef.current;
      pendingPreviewFollowRef.current = null;
      if (!pendingFollow || activeViewMode !== "split" || splitDividerDragging) {
        return;
      }

      previewRef.current?.followEditorPosition(pendingFollow.position);
    });
  };

  const queueEditorViewportFollow = () => {
    queuePreviewFollow(normalizeEditorScrollPosition(editorRef.current?.getViewportLineAnchor(), editorRef));
  };

  const followEditorViewportImmediately = () => {
    const position = normalizeEditorScrollPosition(editorRef.current?.getViewportLineAnchor(), editorRef);
    if (!previewFollowEnabled || !position) {
      if (!previewFollowEnabled) {
        cancelPendingPreviewFollow();
      }
      return false;
    }

    cancelPendingPreviewFollow();
    lastSplitScrollSurfaceRef.current = "editor";
    if (!previewRef.current) {
      queuePreviewFollow(position);
      return false;
    }

    previewRef.current.followEditorPosition(position);
    return true;
  };

  const handleEditorScrollRatioChange = (_ratio: number) => {
    if (
      activeViewMode !== "split" ||
      !previewFollowEnabled ||
      splitDividerDragging ||
      scrollSyncingRef.current
    ) {
      return;
    }

    queueEditorViewportFollow();
  };

  const handleEditorSurfaceScroll = () => {
    if (activeViewMode !== "split" || splitDividerDragging) {
      return;
    }

    // In desktop split view the CodeMirror scroller is the only editor scroll owner.
    // This handler remains attached for stacked responsive layouts but should not
    // drive sync from the non-scrollable editor surface.
  };

  const handlePreviewScroll = () => {
    if (activeViewMode !== "split" || splitDividerDragging || scrollSyncingRef.current) {
      return;
    }

    lastSplitScrollSurfaceRef.current = "preview";
    cancelPendingPreviewFollow();
  };

  useLayoutEffect(() => {
    if (activeViewMode !== "split" || !previewFollowEnabled) {
      return;
    }

    followEditorViewportImmediately();
  }, [activeViewMode, activeFileId, previewFollowEnabled]);

  useEffect(() => {
    if (previewFollowEnabled) {
      return;
    }

    cancelPendingPreviewFollow();
  }, [previewFollowEnabled]);

  useEffect(() => () => {
    if (previewFollowFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFollowFrameRef.current);
    }
  }, []);

  return {
    handleEditorScrollRatioChange,
    handleEditorSurfaceScroll,
    handlePreviewScroll,
    lastSplitScrollSurfaceRef,
  };
}
