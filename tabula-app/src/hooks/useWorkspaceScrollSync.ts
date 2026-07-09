import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { MarkdownEditorHandle } from "../components/MarkdownEditor";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import { useWorkspaceUiStore } from "../stores/workspaceUiStore";
import type { FileViewMode } from "../workspaceStorage";
import { useSplitPreviewFollow } from "./useSplitPreviewFollow";
import { useViewModeScrollPreservation } from "./useViewModeScrollPreservation";

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

type UseWorkspaceScrollSyncArgs = {
  activeFileId?: string;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  previewRef: RefObject<MarkdownPreviewHandle | null>;
  syncScrollingEnabled: boolean;
  onSetActiveFileViewMode: (nextViewMode: FileViewMode) => void;
};

export function useWorkspaceScrollSync({
  activeFileId,
  activeViewMode,
  editorRef,
  previewRef,
  syncScrollingEnabled,
  onSetActiveFileViewMode,
}: UseWorkspaceScrollSyncArgs) {
  const scrollSyncingRef = useRef(false);
  const pendingEditorCommandRef = useRef<PendingEditorCommand | null>(null);
  const [editorCommandRevision, setEditorCommandRevision] = useState(0);
  const splitDividerDragging = useWorkspaceUiStore((state) => state.splitDragging);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const editorSurfaceRef = useRef<HTMLElement | null>(null);
  const previewSurfaceRef = useRef<HTMLElement | null>(null);

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

  const {
    handleEditorScrollRatioChange,
    handleEditorSurfaceScroll,
    handlePreviewScroll,
    lastSplitScrollSurfaceRef,
  } = useSplitPreviewFollow({
    activeFileId,
    activeViewMode,
    editorRef,
    previewFollowEnabled: syncScrollingEnabled,
    previewRef,
    scrollSyncingRef,
    splitDividerDragging,
  });

  const { setActiveFileViewMode } = useViewModeScrollPreservation({
    activeFileId,
    activeViewMode,
    editorRef,
    editorSurfaceRef,
    lastSplitScrollSurfaceRef,
    onQueueEditorFocus: queueEditorFocus,
    onSetActiveFileViewMode,
    previewSurfaceRef,
    scrollSyncingRef,
    workspaceRef,
  });

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
