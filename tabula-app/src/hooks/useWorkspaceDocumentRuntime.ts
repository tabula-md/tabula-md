import { useCallback, useMemo, type RefObject } from "react";
import type { TextChange } from "@tabula-md/tabula";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import type { FileViewMode, WorkspaceFile } from "../workspaceStorage";
import type { WorkspaceEditorDocumentRuntimeOwner } from "./editorDocumentRuntimeOwner";
import { useActiveDocumentRuntime } from "./useActiveDocumentRuntime";
import { useEditorSearchController } from "../editor/useEditorSearchController";
import { useSelectionCommentController } from "./useSelectionCommentController";
import { useSplitViewController } from "./useSplitViewController";
import { useWorkspaceScrollSync } from "./useWorkspaceScrollSync";

type UseWorkspaceDocumentRuntimeOptions = {
  activeFile?: WorkspaceFile;
  editorDocumentRuntime: WorkspaceEditorDocumentRuntimeOwner;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  previewRef: RefObject<MarkdownPreviewHandle | null>;
  syncScrollingEnabled: boolean;
  visibleTextChange?: TextChange | null;
  visibleTextRevision: number;
  onCommitActiveFileSplitRatio: (splitRatio: number) => void;
  onSetWorkspaceFileViewMode: (viewMode: FileViewMode) => void;
};

export function useWorkspaceDocumentRuntime({
  activeFile,
  editorDocumentRuntime,
  editorRef,
  previewRef,
  syncScrollingEnabled,
  visibleTextChange,
  visibleTextRevision,
  onCommitActiveFileSplitRatio,
  onSetWorkspaceFileViewMode,
}: UseWorkspaceDocumentRuntimeOptions) {
  const visibleText = useMemo(
    () => (activeFile ? editorDocumentRuntime.getVisibleFileText(activeFile) : ""),
    [activeFile, editorDocumentRuntime, visibleTextRevision],
  );
  const activeDocument = useActiveDocumentRuntime(activeFile, {
    text: visibleText,
    textChange: visibleTextChange,
  });
  const text = activeDocument.text;
  const activeViewMode = activeDocument.viewMode;

  const scroll = useWorkspaceScrollSync({
    activeFileId: activeFile?.id,
    activeViewMode,
    editorRef,
    previewRef,
    syncScrollingEnabled,
    onSetActiveFileViewMode: onSetWorkspaceFileViewMode,
  });
  const {
    editorSurfaceRef,
    previewSurfaceRef,
    queueEditorTextRange,
    setActiveFileViewMode,
    workspaceRef,
  } = scroll;
  const split = useSplitViewController({
    activeViewMode,
    activeSplitRatio: activeDocument.splitRatio,
    workspaceRef,
    editorSurfaceRef,
    onSetSplitRatio: onCommitActiveFileSplitRatio,
  });

  const focusTextRange = useCallback(
    (start: number, end = start) => {
      if (activeViewMode === "preview") {
        setActiveFileViewMode("edit", {
          preserveScroll: false,
          focusEditor: false,
        });
      }

      queueEditorTextRange(start, end);
    },
    [activeViewMode, queueEditorTextRange, setActiveFileViewMode],
  );

  const search = useEditorSearchController({
    activeFileId: activeFile?.id,
    activeViewMode,
    editorRef,
    previewSurfaceRef,
    text,
    onFocusTextRange: focusTextRange,
  });
  const selection = useSelectionCommentController({
    activeFileId: activeFile?.id,
    activeViewMode,
    editorRef,
    previewBodyStartOffset: activeDocument.previewBodyStartOffset,
    previewSurfaceRef,
    text,
  });

  return {
    activeDocument,
    activeBookmarks: activeDocument.bookmarks,
    activeFileTitle: activeDocument.title,
    activeLineNumbers: activeDocument.lineNumbers,
    activeLineWrapping: activeDocument.lineWrapping,
    activeSplitRatio: activeDocument.splitRatio,
    activeViewMode,
    focusTextRange,
    outlineHeadings: activeDocument.outlineHeadings,
    parsedMarkdown: activeDocument.parsedMarkdown,
    previewBodyStartOffset: activeDocument.previewBodyStartOffset,
    previewBodyTextChange: activeDocument.previewBodyTextChange,
    renderedPreview: activeDocument.renderedPreview,
    text,
    ...scroll,
    ...split,
    ...search,
    ...selection,
  };
}
