import { useLayoutEffect, useRef, type RefObject } from "react";
import type { MarkdownEditorHandle } from "./MarkdownEditor";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import { getScrollRatio, scrollElementToRatio } from "../scroll";
import type { FileViewMode } from "../workspaceStorage";
import type { SplitScrollSurface } from "./useSplitPreviewFollow";

type MutableValueRef<T> = {
  current: T;
};

type ModeScrollAnchor = {
  surface: SplitScrollSurface;
  position: ReturnType<MarkdownEditorHandle["getViewportLineAnchor"]>;
  ratio: number;
};

type PendingModeScroll = {
  fileId: string;
  toMode: FileViewMode;
  anchor: ModeScrollAnchor;
  focusEditor: boolean;
};

export type SetWorkspaceViewModeOptions = {
  preserveScroll?: boolean;
  focusEditor?: boolean;
};

type UseViewModeScrollPreservationArgs = {
  activeFileId?: string;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  editorSurfaceRef: RefObject<HTMLElement | null>;
  lastSplitScrollSurfaceRef: MutableValueRef<SplitScrollSurface>;
  onQueueEditorFocus: (options?: { preventScroll?: boolean }) => void;
  onSetActiveFileViewMode: (nextViewMode: FileViewMode) => void;
  previewSurfaceRef: RefObject<HTMLElement | null>;
  previewRef: RefObject<MarkdownPreviewHandle | null>;
  scrollSyncingRef: MutableValueRef<boolean>;
  workspaceRef: RefObject<HTMLElement | null>;
};

const clampScrollRatio = (ratio: number) => Math.max(0, Math.min(1, ratio));

const getScrollableDistance = (element: HTMLElement) => Math.max(0, element.scrollHeight - element.clientHeight);

const isScrollableElement = (element: HTMLElement | null) => Boolean(element && getScrollableDistance(element) > 1);

const getWorkspaceRelativeTop = (element: HTMLElement, workspace: HTMLElement) =>
  element.getBoundingClientRect().top - workspace.getBoundingClientRect().top + workspace.scrollTop;

export function useViewModeScrollPreservation({
  activeFileId,
  activeViewMode,
  editorRef,
  editorSurfaceRef,
  lastSplitScrollSurfaceRef,
  onQueueEditorFocus,
  onSetActiveFileViewMode,
  previewSurfaceRef,
  previewRef,
  scrollSyncingRef,
  workspaceRef,
}: UseViewModeScrollPreservationArgs) {
  const pendingModeScrollRef = useRef<PendingModeScroll | null>(null);

  const getSurfaceElement = (surface: SplitScrollSurface) =>
    surface === "preview" ? previewSurfaceRef.current : editorSurfaceRef.current;

  const getSurfaceRatioInWorkspace = (surfaceElement: HTMLElement, workspace: HTMLElement) => {
    const surfaceTop = getWorkspaceRelativeTop(surfaceElement, workspace);
    const surfaceScrollableDistance = Math.max(0, surfaceElement.scrollHeight - workspace.clientHeight);
    if (surfaceScrollableDistance <= 1) {
      return 0;
    }

    return clampScrollRatio((workspace.scrollTop - surfaceTop) / surfaceScrollableDistance);
  };

  const getCurrentModeScrollAnchor = (): ModeScrollAnchor => {
    const workspace = workspaceRef.current;

    if (activeViewMode === "edit") {
      return {
        surface: "editor",
        position: editorRef.current?.getViewportLineAnchor() ?? null,
        ratio: workspace ? getScrollRatio(workspace) : 0,
      };
    }

    if (activeViewMode === "preview") {
      return {
        surface: "preview",
        position: previewRef.current?.getViewportLineAnchor() ?? null,
        ratio: workspace ? getScrollRatio(workspace) : 0,
      };
    }

    if (workspace && isScrollableElement(workspace)) {
      const previewSurface = previewSurfaceRef.current;
      const editorSurface = editorSurfaceRef.current;
      const previewTop = previewSurface ? getWorkspaceRelativeTop(previewSurface, workspace) : Number.POSITIVE_INFINITY;
      const viewportAnchor = workspace.scrollTop + workspace.clientHeight * 0.45;

      if (previewSurface && viewportAnchor >= previewTop) {
        return {
          surface: "preview",
          position: previewRef.current?.getViewportLineAnchor() ?? null,
          ratio: getSurfaceRatioInWorkspace(previewSurface, workspace),
        };
      }

      if (editorSurface) {
        return {
          surface: "editor",
          position: editorRef.current?.getViewportLineAnchor() ?? null,
          ratio: getSurfaceRatioInWorkspace(editorSurface, workspace),
        };
      }
    }

    const sourceSurface = lastSplitScrollSurfaceRef.current;
    const sourceElement = getSurfaceElement(sourceSurface);
    return {
      surface: sourceSurface,
      position:
        sourceSurface === "editor"
          ? editorRef.current?.getViewportLineAnchor() ?? null
          : previewRef.current?.getViewportLineAnchor() ?? null,
      ratio:
        sourceSurface === "editor"
          ? (editorRef.current?.getScrollRatio() ?? 0)
          : sourceElement && isScrollableElement(sourceElement)
            ? getScrollRatio(sourceElement)
            : 0,
    };
  };

  const scrollWorkspaceToSurfaceAnchor = (
    workspace: HTMLElement,
    surface: SplitScrollSurface,
    ratio: number,
  ) => {
    const surfaceElement = getSurfaceElement(surface);
    if (!surfaceElement) {
      scrollElementToRatio(workspace, ratio);
      return;
    }

    const surfaceTop = getWorkspaceRelativeTop(surfaceElement, workspace);
    const surfaceScrollableDistance = Math.max(0, surfaceElement.scrollHeight - workspace.clientHeight);
    const nextScrollTop = surfaceTop + clampScrollRatio(ratio) * surfaceScrollableDistance;
    workspace.scrollTop = Math.max(0, Math.min(nextScrollTop, getScrollableDistance(workspace)));
  };

  const applyModeScrollAnchor = (anchor: ModeScrollAnchor) => {
    if (anchor.position) {
      if (activeViewMode !== "preview") {
        editorRef.current?.revealViewportLineAnchor(anchor.position);
      }
      if (activeViewMode !== "edit") {
        previewRef.current?.followEditorPosition(anchor.position);
      }
      return;
    }
    const workspace = workspaceRef.current;

    if (activeViewMode === "split") {
      if (workspace && isScrollableElement(workspace)) {
        scrollWorkspaceToSurfaceAnchor(workspace, anchor.surface, anchor.ratio);
        return;
      }

      editorRef.current?.scrollToRatio(anchor.ratio);
      if (previewSurfaceRef.current) {
        scrollElementToRatio(previewSurfaceRef.current, anchor.ratio);
      }
      return;
    }

    if (workspace) {
      scrollElementToRatio(workspace, anchor.ratio);
    }
  };

  const releaseScrollSync = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollSyncingRef.current = false;
      });
    });
  };

  const setActiveFileViewMode = (
    nextViewMode: FileViewMode,
    options: SetWorkspaceViewModeOptions = {},
  ) => {
    if (!activeFileId) {
      return;
    }

    const shouldPreserveScroll = options.preserveScroll ?? true;
    const shouldFocusEditor = options.focusEditor ?? (nextViewMode === "edit" && !shouldPreserveScroll);
    if (nextViewMode !== activeViewMode && shouldPreserveScroll) {
      const anchor = getCurrentModeScrollAnchor();
      pendingModeScrollRef.current = {
        fileId: activeFileId,
        toMode: nextViewMode,
        anchor,
        focusEditor: shouldFocusEditor,
      };
    } else {
      pendingModeScrollRef.current = null;
    }

    onSetActiveFileViewMode(nextViewMode);

    if (shouldFocusEditor && !shouldPreserveScroll) {
      onQueueEditorFocus();
    }
  };

  useLayoutEffect(() => {
    const pendingModeScroll = pendingModeScrollRef.current;
    if (
      !pendingModeScroll ||
      pendingModeScroll.fileId !== activeFileId ||
      pendingModeScroll.toMode !== activeViewMode
    ) {
      return;
    }

    scrollSyncingRef.current = true;
    applyModeScrollAnchor(pendingModeScroll.anchor);
    pendingModeScrollRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      if (activeViewMode === "edit" && pendingModeScroll.focusEditor) {
        editorRef.current?.focus({ preventScroll: true });
      }
      applyModeScrollAnchor(pendingModeScroll.anchor);
      releaseScrollSync();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeFileId, activeViewMode]);

  return {
    setActiveFileViewMode,
  };
}
