import type { ActiveDocumentRuntime } from "./documentRuntime";

const classNames = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export type DocumentSurfaceState = {
  document: ActiveDocumentRuntime;
  hasSelectionActionPosition: boolean;
  isLive: boolean;
  openCommentCount: number;
  searchOpen: boolean;
  selectedCharacterCount: number;
  shareOpen: boolean;
  splitDividerDragging: boolean;
};

export const buildDocumentSurface = ({
  document,
  hasSelectionActionPosition,
  isLive,
  openCommentCount,
  searchOpen,
  selectedCharacterCount,
  shareOpen,
  splitDividerDragging,
}: DocumentSurfaceState) => {
  const documentModeClassName = `view-${document.viewMode} reading-${document.readingWidth}`;
  const lineNumbersClassName = document.lineNumbers ? "line-numbers-on" : "line-numbers-off";

  return {
    centerWorkbenchClassName: classNames(
      "center-workbench",
      document.hasFile ? `has-file ${documentModeClassName}` : "empty",
      document.hasFile && lineNumbersClassName,
    ),
    documentControls: {
      activeLineNumbers: document.lineNumbers,
      activeLineWrapping: document.lineWrapping,
      activeReadingWidth: document.readingWidth,
      activeViewMode: document.viewMode,
      canCopyFile: document.canCopy,
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
      selectedCharacterCount > 0 && "has-text-selection",
    ),
    fileShellClassName: classNames(
      "file-shell",
      document.hasFile ? documentModeClassName : "empty",
      document.hasFile && lineNumbersClassName,
      document.canFormat && "with-format-toolbar",
      searchOpen && "with-search-row",
      shareOpen && "share-modal-open",
    ),
    formattingToolbarClassName: classNames(document.viewMode, `reading-${document.readingWidth}`),
    showFormattingToolbar: document.canFormat,
    showSelectionCommentPopover: Boolean(
      isLive && document.hasFile && selectedCharacterCount > 0 && hasSelectionActionPosition,
    ),
    showSplitResizeHandle: document.viewMode === "split" && !shareOpen,
    statusBar: {
      activeFileTitle: document.title,
      activeViewMode: document.viewMode,
      commentCount: isLive ? openCommentCount : 0,
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
