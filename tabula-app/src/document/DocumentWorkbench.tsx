import {
  type CSSProperties,
  type RefObject,
  useMemo,
} from "react";
import { MessageSquarePlus } from "lucide-react";
import type {
  DocumentSurfaceModel,
  MarkdownFormatCommand,
  TextChange,
} from "@tabula-md/tabula";
import type { CenterPopover } from "../ui/uiTypes";
import type { LiveSelection } from "../collaboration/liveCollaboration";
import type { CollabEditorBinding } from "../collaboration/liveCollaboration";
import type { SearchMatch, SearchOptions } from "../editor/editorSearchModel";
import type { SearchTarget } from "../editor/useEditorSearchController";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type {
  MarkdownCommentAnchor,
  MarkdownBookmark,
  MarkdownEditorHandle,
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "./markdownEditorTypes";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import type {
  FileBookmark,
  FileViewMode,
  ReadingWidth,
  WorkspaceFile,
} from "../workspace/workspaceStorage";
import {
  DocumentControls,
  DocumentSearchBar,
  type DocumentSearchBarProps,
} from "./DocumentControls";
import { FormattingToolbar } from "./FormattingToolbar";
import type {
  MarkdownPreviewCommentAnchor,
  MarkdownPreviewLineAnnotation,
  MarkdownPreviewMetadata,
  MarkdownPreviewProps,
} from "../preview/markdownPreviewTypes";
import { StatusBar } from "./StatusBar";
import { getWorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";
import { prepareMarkdownPreview } from "../preview/markdownPreviewLoader";
import { TabulaDocumentSurface } from "../workbench/index";

export type DocumentWorkbenchProps = {
  activeBookmarks: FileBookmark[];
  activeCommentAnchors: MarkdownCommentAnchor[];
  activeFile: WorkspaceFile;
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activeSyncScrolling: boolean;
  activePreviewCommentAnchors: MarkdownPreviewCommentAnchor[];
  activePreviewLineAnnotations: MarkdownPreviewLineAnnotation[];
  activeSearchMatchIndex: number;
  activeSelection?: LiveSelection;
  canRedo: boolean;
  canUndo: boolean;
  centerPopover: CenterPopover;
  collaborationBinding?: CollabEditorBinding | null;
  cursorPositionLabel: string;
  documentSurface: DocumentSurfaceModel;
  documentSearch: Omit<DocumentSearchBarProps, "language">;
  editorHistoryCanRedo: boolean;
  editorHistoryCanUndo: boolean;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  editorSurfaceRef: RefObject<HTMLElement | null>;
  focusedCommentId: string | null;
  isLive: boolean;
  language: WorkspaceLanguage;
  previewBody: string;
  previewBodyStartOffset: number;
  previewBodyTextChange?: TextChange | null;
  largeDocumentMode: boolean;
  previewRef: RefObject<MarkdownPreviewHandle | null>;
  previewMetadata: MarkdownPreviewMetadata[];
  previewSurfaceRef: RefObject<HTMLElement | null>;
  searchMatches: SearchMatch[];
  searchOpen: boolean;
  searchQuery: string;
  searchOptions: SearchOptions;
  searchTarget: SearchTarget;
  selectedCharacterCount: number;
  selectedLineCount: number;
  saveRevision: number;
  selectionActionPosition: MarkdownSelectionActionPosition | null;
  splitDividerDragging: boolean;
  splitDividerMaxValue: number;
  splitDividerMinValue: number;
  splitDividerValue: number;
  splitWorkspaceStyle?: CSSProperties;
  statusLabel: string;
  text: string;
  toolbarLabel: string;
  workspaceRef: RefObject<HTMLElement | null>;
  onBookmarksChange: (bookmarks: MarkdownBookmark[]) => void;
  onEditorHistoryStateChange: (historyState: { canUndo: boolean; canRedo: boolean }) => void;
  onEditorScroll: () => void;
  onEditorScrollRatioChange: (ratio: number) => void;
  onEditorSelectionActionPositionChange: (position: MarkdownSelectionActionPosition | null) => void;
  onEditorSelectionChange: (selection?: LiveSelection) => void;
  onFormat: (command: MarkdownFormatCommand) => void;
  onLineAction: (request: MarkdownLineActionRequest) => void;
  onOpenComment: (commentId: string) => void;
  onOpenWorkspaceLink?: MarkdownPreviewProps["onOpenWorkspaceLink"];
  onOpenSelectionComment: () => void;
  onPreviewKeyUp: () => void;
  onPreviewMouseUp: () => void;
  onPreviewScroll: () => void;
  onPreviewTouchEnd: () => void;
  onRedo: () => void;
  onResetSplitRatio: () => void;
  onPreviewSearchMatchCountChange: (count: number, truncated?: boolean) => void;
  onSetReadingWidth: (readingWidth: ReadingWidth) => void;
  onSetViewMode: (viewMode: FileViewMode) => void;
  onSplitDividerKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onTextChange: (nextValue: string | null, change?: TextChange) => void;
  onToggleLineNumbers: () => void;
  onToggleSearch: () => void;
  onToggleLineWrapping: () => void;
  onToggleSyncScrolling: () => void;
  onToggleViewOptions: () => void;
  onUndo: () => void;
  resolveWorkspaceDocument?: MarkdownPreviewProps["resolveWorkspaceDocument"];
  resolveWorkspaceLink?: MarkdownPreviewProps["resolveWorkspaceLink"];
};

const getFloatingPopoverStyle = (
  position: MarkdownSelectionActionPosition,
  options: { width: number; yOffset: number },
): CSSProperties => {
  const viewportWidth = window.innerWidth || 1024;
  const left = Math.max(
    12,
    Math.min(position.clientX - options.width / 2, viewportWidth - options.width - 12),
  );
  const top = Math.max(72, position.clientY + options.yOffset);
  return {
    left,
    top,
  };
};

export function DocumentWorkbench({
  activeBookmarks,
  activeCommentAnchors,
  activeFile,
  activeLineNumbers,
  activeLineWrapping,
  activeSyncScrolling,
  activePreviewCommentAnchors,
  activePreviewLineAnnotations,
  activeSearchMatchIndex,
  activeSelection,
  canRedo,
  canUndo,
  centerPopover,
  collaborationBinding,
  cursorPositionLabel,
  documentSurface,
  documentSearch,
  editorHistoryCanRedo,
  editorHistoryCanUndo,
  editorRef,
  editorSurfaceRef,
  focusedCommentId,
  isLive,
  language,
  previewBody,
  previewBodyStartOffset,
  previewBodyTextChange,
  largeDocumentMode,
  previewRef,
  previewMetadata,
  previewSurfaceRef,
  searchMatches,
  searchOpen,
  searchQuery,
  searchOptions,
  searchTarget,
  selectedCharacterCount,
  selectedLineCount,
  saveRevision,
  selectionActionPosition,
  splitDividerDragging,
  splitDividerMaxValue,
  splitDividerMinValue,
  splitDividerValue,
  splitWorkspaceStyle,
  statusLabel,
  text,
  toolbarLabel,
  workspaceRef,
  onBookmarksChange,
  onEditorHistoryStateChange,
  onEditorScroll,
  onEditorScrollRatioChange,
  onEditorSelectionActionPositionChange,
  onEditorSelectionChange,
  onFormat,
  onLineAction,
  onOpenComment,
  onOpenWorkspaceLink,
  onOpenSelectionComment,
  onPreviewKeyUp,
  onPreviewMouseUp,
  onPreviewScroll,
  onPreviewTouchEnd,
  onRedo,
  onResetSplitRatio,
  onPreviewSearchMatchCountChange,
  onSetReadingWidth,
  onSetViewMode,
  onSplitDividerKeyDown,
  onSplitDividerPointerCancel,
  onSplitDividerPointerDown,
  onSplitDividerPointerMove,
  onSplitDividerPointerUp,
  onTextChange,
  onToggleLineNumbers,
  onToggleSearch,
  onToggleLineWrapping,
  onToggleSyncScrolling,
  onToggleViewOptions,
  onUndo,
  resolveWorkspaceDocument,
  resolveWorkspaceLink,
}: DocumentWorkbenchProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  const activeFormats = useMemo(
    () =>
      documentSurface.documentControls.activeViewMode === "preview" || !activeSelection
        ? []
        : editorRef.current?.getActiveFormats() ?? [],
    [activeSelection, documentSurface.documentControls.activeViewMode, editorRef, text],
  );
  return (
    <>
      <section
        className={documentSurface.documentToolbarClassName}
        aria-label={toolbarLabel}
      >
        {documentSurface.showFormattingToolbar && (
          <FormattingToolbar
            className={documentSurface.formattingToolbarClassName}
            canUndo={canUndo || editorHistoryCanUndo}
            canRedo={canRedo || editorHistoryCanRedo}
            language={language}
            activeFormats={activeFormats}
            onFormat={onFormat}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        )}

        <DocumentControls
          activeViewMode={documentSurface.documentControls.activeViewMode}
          activeReadingWidth={documentSurface.documentControls.activeReadingWidth}
          activeLineWrapping={documentSurface.documentControls.activeLineWrapping}
          activeLineNumbers={documentSurface.documentControls.activeLineNumbers}
          activeSyncScrolling={activeSyncScrolling}
          centerPopover={centerPopover}
          language={language}
          searchOpen={searchOpen}
          onSetViewMode={onSetViewMode}
          onPreparePreview={prepareMarkdownPreview}
          onToggleViewOptions={onToggleViewOptions}
          onSetReadingWidth={onSetReadingWidth}
          onToggleSyncScrolling={onToggleSyncScrolling}
          onToggleLineWrapping={onToggleLineWrapping}
          onToggleLineNumbers={onToggleLineNumbers}
          onToggleSearch={onToggleSearch}
        />
      </section>

      {searchOpen && (
        <DocumentSearchBar {...documentSearch} language={language} />
      )}

      <TabulaDocumentSurface
        activeBookmarks={activeBookmarks}
        activeCommentAnchors={activeCommentAnchors}
        activeFile={activeFile}
        activeLineNumbers={activeLineNumbers}
        activeLineWrapping={activeLineWrapping}
        activePreviewCommentAnchors={activePreviewCommentAnchors}
        activePreviewLineAnnotations={activePreviewLineAnnotations}
        activeSearchMatchIndex={activeSearchMatchIndex}
        collaborationBinding={collaborationBinding}
        documentSurface={documentSurface}
        editorRef={editorRef}
        editorSurfaceRef={editorSurfaceRef}
        focusedCommentId={focusedCommentId}
        isLive={isLive}
        language={language}
        largeDocumentMode={largeDocumentMode}
        previewBody={previewBody}
        previewBodyStartOffset={previewBodyStartOffset}
        previewBodyTextChange={previewBodyTextChange}
        previewMetadata={previewMetadata}
        previewRef={previewRef}
        previewSurfaceRef={previewSurfaceRef}
        searchMatches={searchMatches}
        searchOpen={searchOpen}
        searchOptions={searchOptions}
        searchQuery={searchQuery}
        searchTarget={searchTarget}
        splitDividerDragging={splitDividerDragging}
        splitDividerMaxValue={splitDividerMaxValue}
        splitDividerMinValue={splitDividerMinValue}
        splitDividerValue={splitDividerValue}
        splitWorkspaceStyle={splitWorkspaceStyle}
        text={text}
        workspaceRef={workspaceRef}
        onBookmarksChange={onBookmarksChange}
        onEditorHistoryStateChange={onEditorHistoryStateChange}
        onEditorScroll={onEditorScroll}
        onEditorScrollRatioChange={onEditorScrollRatioChange}
        onEditorSelectionActionPositionChange={onEditorSelectionActionPositionChange}
        onEditorSelectionChange={onEditorSelectionChange}
        onLineAction={onLineAction}
        onOpenComment={onOpenComment}
        onOpenWorkspaceLink={onOpenWorkspaceLink}
        onPreviewKeyUp={onPreviewKeyUp}
        onPreviewMouseUp={onPreviewMouseUp}
        onPreviewScroll={onPreviewScroll}
        onPreviewTouchEnd={onPreviewTouchEnd}
        onPreviewSearchMatchCountChange={onPreviewSearchMatchCountChange}
        onResetSplitRatio={onResetSplitRatio}
        onSplitDividerKeyDown={onSplitDividerKeyDown}
        onSplitDividerPointerCancel={onSplitDividerPointerCancel}
        onSplitDividerPointerDown={onSplitDividerPointerDown}
        onSplitDividerPointerMove={onSplitDividerPointerMove}
        onSplitDividerPointerUp={onSplitDividerPointerUp}
        onTextChange={onTextChange}
        resolveWorkspaceDocument={resolveWorkspaceDocument}
        resolveWorkspaceLink={resolveWorkspaceLink}
      />

      {documentSurface.showSelectionCommentPopover && selectionActionPosition && (
        <button
          className="selection-comment-popover selection-comment-button ui-popover"
          type="button"
          style={getFloatingPopoverStyle(selectionActionPosition, {
            width: 164,
            yOffset: 30,
          })}
          aria-label={copy.addComment}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onOpenSelectionComment}
        >
          <MessageSquarePlus size={16} aria-hidden="true" />
          <span>{copy.addComment}</span>
        </button>
      )}

      <StatusBar
        activeFileTitle={documentSurface.statusBar.activeFileTitle}
        activeViewMode={documentSurface.statusBar.activeViewMode}
        isLive={isLive}
        language={language}
        saveRevision={saveRevision}
        statusLabel={statusLabel}
        wordCount={documentSurface.statusBar.wordCount}
        cursorPositionLabel={cursorPositionLabel}
        selectedCharacterCount={selectedCharacterCount}
        selectedLineCount={selectedLineCount}
      />
    </>
  );
}
