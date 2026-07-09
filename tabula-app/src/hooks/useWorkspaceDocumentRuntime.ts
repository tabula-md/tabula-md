import { useCallback, type RefObject } from "react";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
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
  onCommitActiveFileSplitRatio: (splitRatio: number) => void;
  onSetWorkspaceFileViewMode: (viewMode: FileViewMode) => void;
};

export function useWorkspaceDocumentRuntime({
  activeFile,
  editorDocumentRuntime,
  editorRef,
  onCommitActiveFileSplitRatio,
  onSetWorkspaceFileViewMode,
}: UseWorkspaceDocumentRuntimeOptions) {
  const visibleText = activeFile ? editorDocumentRuntime.getVisibleFileText(activeFile) : "";
  const activeDocument = useActiveDocumentRuntime(activeFile, { text: visibleText });
  const text = activeDocument.text;
  const activeViewMode = activeDocument.viewMode;

  const scroll = useWorkspaceScrollSync({
    activeFileId: activeFile?.id,
    activeViewMode,
    editorRef,
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
    editorRef,
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
    renderedPreview: activeDocument.renderedPreview,
    text,
    ...scroll,
    ...split,
    ...search,
    ...selection,
  };
}
