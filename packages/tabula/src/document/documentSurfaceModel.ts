import type { FileViewMode, ReadingWidth } from "./documentPrimitives";

const classNames = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(" ");

export type DocumentSurfaceDocumentState = {
  canCopy: boolean;
  canFormat: boolean;
  hasFile: boolean;
  lineNumbers: boolean;
  lineWrapping: boolean;
  readingWidth: ReadingWidth;
  title: string;
  viewMode: FileViewMode;
  wordCount: number;
};

export type DocumentSurfaceState = {
  document: DocumentSurfaceDocumentState;
  hasSelectionActionPosition: boolean;
  searchOpen: boolean;
  selectedCharacterCount: number;
  shareOpen: boolean;
  splitDividerDragging: boolean;
};

export const buildDocumentSurface = ({
  document,
  hasSelectionActionPosition,
  searchOpen,
  selectedCharacterCount,
  shareOpen,
  splitDividerDragging,
}: DocumentSurfaceState) => {
  const documentModeClassName = `view-${document.viewMode} reading-${document.readingWidth}`;
  const lineNumbersClassName = document.lineNumbers
    ? "line-numbers-on"
    : "line-numbers-off";
  const lineWrappingClassName = document.lineWrapping
    ? "line-wrapping-on"
    : "line-wrapping-off";

  return {
    centerWorkbenchClassName: classNames(
      "center-workbench",
      document.hasFile ? `has-file ${documentModeClassName}` : "empty",
      document.hasFile && lineNumbersClassName,
      document.hasFile && lineWrappingClassName,
    ),
    documentControls: {
      activeLineNumbers: document.lineNumbers,
      activeLineWrapping: document.lineWrapping,
      activeReadingWidth: document.readingWidth,
      activeViewMode: document.viewMode,
    },
    documentToolbarClassName: classNames(
      "document-toolbar-row",
      document.viewMode,
      `reading-${document.readingWidth}`,
      document.canFormat && "with-formatting",
    ),
    editorSurfaceClassName: classNames(
      "editor-surface",
      lineNumbersClassName,
      lineWrappingClassName,
      selectedCharacterCount > 0 && "has-text-selection",
    ),
    fileShellClassName: classNames(
      "file-shell",
      document.hasFile ? documentModeClassName : "empty",
      document.hasFile && "comments-enabled",
      document.hasFile && lineNumbersClassName,
      document.hasFile && lineWrappingClassName,
      document.canFormat && "with-format-toolbar",
      searchOpen && "with-search-row",
      shareOpen && "share-modal-open",
    ),
    formattingToolbarClassName: classNames(
      document.viewMode,
      `reading-${document.readingWidth}`,
    ),
    showFormattingToolbar: document.canFormat,
    showSelectionCommentPopover: Boolean(
      document.hasFile &&
        selectedCharacterCount > 0 &&
        hasSelectionActionPosition,
    ),
    showSplitResizeHandle: document.viewMode === "split" && !shareOpen,
    statusBar: {
      activeFileTitle: document.title,
      activeViewMode: document.viewMode,
      wordCount: document.wordCount,
    },
    workspaceClassName: classNames(
      "workspace",
      document.viewMode,
      `reading-${document.readingWidth}`,
      splitDividerDragging && "split-resizing",
    ),
  };
};

export type DocumentSurfaceModel = ReturnType<typeof buildDocumentSurface>;
