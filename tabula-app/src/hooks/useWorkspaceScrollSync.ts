import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { MarkdownEditorHandle } from "../components/MarkdownEditor";
import { getScrollRatio, scrollElementToRatio } from "../scroll";
import type { FileViewMode } from "../workspaceStorage";

type ModeScrollSurface = "editor" | "preview";

type ModeScrollAnchor = {
  surface: ModeScrollSurface;
  ratio: number;
};

type PendingModeScroll = {
  fileId: string;
  toMode: FileViewMode;
  anchor: ModeScrollAnchor;
  focusEditor: boolean;
};

type PendingEditorCommand =
  | {
      kind: "focus";
      preventScroll?: boolean;
    }
  | {
      kind: "selectRange";
      start: number;
      end: number;
      preventScroll?: boolean;
    };

type SetWorkspaceViewModeOptions = {
  preserveScroll?: boolean;
  focusEditor?: boolean;
};

type UseWorkspaceScrollSyncArgs = {
  activeFileId?: string;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  onSetActiveFileViewMode: (nextViewMode: FileViewMode) => void;
};

const clampScrollRatio = (ratio: number) => Math.max(0, Math.min(1, ratio));

const getScrollableDistance = (element: HTMLElement) => Math.max(0, element.scrollHeight - element.clientHeight);

const isScrollableElement = (element: HTMLElement | null) => Boolean(element && getScrollableDistance(element) > 1);

const getWorkspaceRelativeTop = (element: HTMLElement, workspace: HTMLElement) =>
  element.getBoundingClientRect().top - workspace.getBoundingClientRect().top + workspace.scrollTop;

export function useWorkspaceScrollSync({
  activeFileId,
  activeViewMode,
  editorRef,
  onSetActiveFileViewMode,
}: UseWorkspaceScrollSyncArgs) {
  const scrollSyncingRef = useRef(false);
  const lastSplitScrollSurfaceRef = useRef<ModeScrollSurface>("editor");
  const pendingModeScrollRef = useRef<PendingModeScroll | null>(null);
  const pendingEditorCommandRef = useRef<PendingEditorCommand | null>(null);
  const pendingSplitScrollRef = useRef<{ source: ModeScrollSurface; ratio: number } | null>(null);
  const splitScrollFrameRef = useRef<number | null>(null);
  const [editorCommandRevision, setEditorCommandRevision] = useState(0);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const editorSurfaceRef = useRef<HTMLElement | null>(null);
  const previewSurfaceRef = useRef<HTMLElement | null>(null);

  const getSurfaceElement = (surface: ModeScrollSurface) =>
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
      return { surface: "editor", ratio: workspace ? getScrollRatio(workspace) : 0 };
    }

    if (activeViewMode === "preview") {
      return { surface: "preview", ratio: workspace ? getScrollRatio(workspace) : 0 };
    }

    if (workspace && isScrollableElement(workspace)) {
      const previewSurface = previewSurfaceRef.current;
      const editorSurface = editorSurfaceRef.current;
      const previewTop = previewSurface ? getWorkspaceRelativeTop(previewSurface, workspace) : Number.POSITIVE_INFINITY;
      const viewportAnchor = workspace.scrollTop + workspace.clientHeight * 0.45;

      if (previewSurface && viewportAnchor >= previewTop) {
        return {
          surface: "preview",
          ratio: getSurfaceRatioInWorkspace(previewSurface, workspace),
        };
      }

      if (editorSurface) {
        return {
          surface: "editor",
          ratio: getSurfaceRatioInWorkspace(editorSurface, workspace),
        };
      }
    }

    const sourceSurface = lastSplitScrollSurfaceRef.current;
    const sourceElement = getSurfaceElement(sourceSurface);
    return {
      surface: sourceSurface,
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
    surface: ModeScrollSurface,
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
      scrollSyncingRef.current = false;
    });
  };

  const queueSplitScrollSync = (source: ModeScrollSurface, ratio: number) => {
    lastSplitScrollSurfaceRef.current = source;
    pendingSplitScrollRef.current = { source, ratio: clampScrollRatio(ratio) };

    if (splitScrollFrameRef.current !== null) {
      return;
    }

    splitScrollFrameRef.current = window.requestAnimationFrame(() => {
      splitScrollFrameRef.current = null;
      const pendingScroll = pendingSplitScrollRef.current;
      pendingSplitScrollRef.current = null;
      if (!pendingScroll || activeViewMode !== "split") {
        return;
      }

      scrollSyncingRef.current = true;
      if (pendingScroll.source === "editor") {
        const previewSurface = previewSurfaceRef.current;
        if (previewSurface) {
          scrollElementToRatio(previewSurface, pendingScroll.ratio);
        }
      } else {
        editorRef.current?.scrollToRatio(pendingScroll.ratio);
      }
      releaseScrollSync();
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
      pendingModeScrollRef.current = {
        fileId: activeFileId,
        toMode: nextViewMode,
        anchor: getCurrentModeScrollAnchor(),
        focusEditor: shouldFocusEditor,
      };
    } else {
      pendingModeScrollRef.current = null;
    }

    onSetActiveFileViewMode(nextViewMode);

    if (shouldFocusEditor && !shouldPreserveScroll) {
      queueEditorFocus();
    }
  };

  const queueEditorCommand = (command: PendingEditorCommand) => {
    pendingEditorCommandRef.current = command;
    setEditorCommandRevision((currentRevision) => currentRevision + 1);
  };

  const queueEditorFocus = (options: { preventScroll?: boolean } = {}) => {
    queueEditorCommand({ kind: "focus", preventScroll: options.preventScroll });
  };

  const queueEditorTextRange = (start: number, end = start, options: { preventScroll?: boolean } = {}) => {
    queueEditorCommand({
      kind: "selectRange",
      start,
      end,
      preventScroll: options.preventScroll,
    });
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

    if (activeViewMode !== "edit" || !pendingModeScroll.focusEditor) {
      releaseScrollSync();
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      editorRef.current?.focus({ preventScroll: true });
      applyModeScrollAnchor(pendingModeScroll.anchor);
      releaseScrollSync();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeFileId, activeViewMode]);

  useLayoutEffect(() => {
    const pendingEditorCommand = pendingEditorCommandRef.current;
    if (!pendingEditorCommand || !activeFileId || activeViewMode !== "edit") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      pendingEditorCommandRef.current = null;
      if (pendingEditorCommand.kind === "focus") {
        editorRef.current?.focus({ preventScroll: pendingEditorCommand.preventScroll });
        return;
      }

      editorRef.current?.focus({ preventScroll: pendingEditorCommand.preventScroll });
      editorRef.current?.setSelectionRange(pendingEditorCommand.start, pendingEditorCommand.end);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeFileId, activeViewMode, editorCommandRevision, editorRef]);

  const handleEditorScrollRatioChange = (ratio: number) => {
    if (activeViewMode !== "split" || scrollSyncingRef.current) {
      return;
    }

    queueSplitScrollSync("editor", ratio);
  };

  const handleEditorSurfaceScroll = () => {
    if (activeViewMode !== "split") {
      return;
    }

    // In desktop split view the CodeMirror scroller is the only editor scroll owner.
    // This handler remains attached for stacked responsive layouts but should not
    // drive sync from the non-scrollable editor surface.
  };

  const handlePreviewScroll = () => {
    if (activeViewMode !== "split" || scrollSyncingRef.current) {
      return;
    }

    const previewSurface = previewSurfaceRef.current;
    if (!previewSurface) {
      return;
    }

    queueSplitScrollSync("preview", getScrollRatio(previewSurface));
  };

  useEffect(() => {
    if (activeViewMode !== "split") {
      return;
    }

    const pendingModeScroll = pendingModeScrollRef.current;
    if (pendingModeScroll) {
      const { fileId, toMode } = pendingModeScroll;
      if (fileId === activeFileId && toMode === "split") {
        return;
      }
    }

    const previewSurface = previewSurfaceRef.current;
    if (!previewSurface) {
      return;
    }

    scrollSyncingRef.current = true;
    scrollElementToRatio(previewSurface, editorRef.current?.getScrollRatio() ?? 0);
    releaseScrollSync();
  }, [activeViewMode, activeFileId]);

  useEffect(() => () => {
    if (splitScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(splitScrollFrameRef.current);
    }
  }, []);

  return {
    workspaceRef,
    editorSurfaceRef,
    previewSurfaceRef,
    setActiveFileViewMode,
    queueEditorFocus,
    queueEditorTextRange,
    handleEditorScrollRatioChange,
    handleEditorSurfaceScroll,
    handlePreviewScroll,
  };
}
