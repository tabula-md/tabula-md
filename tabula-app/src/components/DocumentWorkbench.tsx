import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useMemo,
} from "react";
import { MessageSquarePlus } from "lucide-react";
import {
  getLineNumberForOffset,
  getLineStartOffset,
  hasLongMarkdownLine,
  toggleMarkdownTaskOnLine,
} from "@tabula-md/tabula";
import type {
  DocumentSurfaceModel,
  MarkdownFormatCommand,
  TextChange,
} from "@tabula-md/tabula";
import type { CenterPopover } from "../uiTypes";
import type { LiveSelection } from "../collaboration";
import type { CollabEditorBinding } from "../collaboration/workspaceRoomRuntimeTypes";
import type { SearchMatch, SearchOptions } from "../editor/editorSearchModel";
import type { SearchTarget } from "../editor/useEditorSearchController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import type {
  MarkdownCommentAnchor,
  MarkdownBookmark,
  MarkdownEditorHandle,
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "../markdownEditorTypes";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import type {
  FileBookmark,
  FileViewMode,
  ReadingWidth,
  WorkspaceFile,
} from "../workspaceStorage";
import { DocumentControls, DocumentSearchBar } from "./DocumentControls";
import { FormattingToolbar } from "./FormattingToolbar";
import { MarkdownEditor } from "./MarkdownEditor";
import {
  MarkdownPreview,
  type MarkdownPreviewCommentAnchor,
  type MarkdownPreviewLineActionRequest,
  type MarkdownPreviewLineAnnotation,
  type MarkdownPreviewMetadata,
} from "./MarkdownPreview";
import { StatusBar } from "./StatusBar";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";

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
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchMatches: SearchMatch[];
  searchMatchCount: number;
  searchError: string | null;
  searchOpen: boolean;
  searchQuery: string;
  searchOptions: SearchOptions;
  searchTarget: SearchTarget;
  replaceQuery: string;
  replaceAvailable: boolean;
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
  onCloseSearch: () => void;
  onEditorHistoryStateChange: (historyState: { canUndo: boolean; canRedo: boolean }) => void;
  onEditorScroll: () => void;
  onEditorScrollRatioChange: (ratio: number) => void;
  onEditorSelectionActionPositionChange: (position: MarkdownSelectionActionPosition | null) => void;
  onEditorSelectionChange: (selection?: LiveSelection) => void;
  onFormat: (command: MarkdownFormatCommand) => void;
  onGoToSearchMatch: (direction: 1 | -1) => void;
  onLineAction: (request: MarkdownLineActionRequest) => void;
  onOpenComment: (commentId: string) => void;
  onOpenSelectionComment: () => void;
  onPreviewKeyUp: () => void;
  onPreviewMouseUp: () => void;
  onPreviewScroll: () => void;
  onPreviewTouchEnd: () => void;
  onRedo: () => void;
  onReplaceAllMatches: () => void;
  onReplaceCurrentMatch: () => void;
  onResetSplitRatio: () => void;
  onReplaceQueryChange: (query: string) => void;
  onSearchQueryChange: (query: string) => void;
  onPreviewSearchMatchCountChange: (count: number) => void;
  onSelectAllSearchMatches: () => void;
  onToggleSearchOption: (option: keyof SearchOptions) => void;
  onSetReadingWidth: (readingWidth: ReadingWidth) => void;
  onSetViewMode: (viewMode: FileViewMode) => void;
  onSplitDividerKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onTextChange: (nextValue: string | null, change?: TextChange) => void;
  onToggleLineNumbers: () => void;
  onToggleLineWrapping: () => void;
  onToggleSearch: () => void;
  onToggleSyncScrolling: () => void;
  onToggleViewOptions: () => void;
  onUndo: () => void;
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
  searchInputRef,
  searchMatches,
  searchMatchCount,
  searchError,
  searchOpen,
  searchQuery,
  searchOptions,
  searchTarget,
  replaceQuery,
  replaceAvailable,
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
  onCloseSearch,
  onEditorHistoryStateChange,
  onEditorScroll,
  onEditorScrollRatioChange,
  onEditorSelectionActionPositionChange,
  onEditorSelectionChange,
  onFormat,
  onGoToSearchMatch,
  onLineAction,
  onOpenComment,
  onOpenSelectionComment,
  onPreviewKeyUp,
  onPreviewMouseUp,
  onPreviewScroll,
  onPreviewTouchEnd,
  onRedo,
  onReplaceAllMatches,
  onReplaceCurrentMatch,
  onResetSplitRatio,
  onReplaceQueryChange,
  onSearchQueryChange,
  onPreviewSearchMatchCountChange,
  onSelectAllSearchMatches,
  onToggleSearchOption,
  onSetReadingWidth,
  onSetViewMode,
  onSplitDividerKeyDown,
  onSplitDividerPointerCancel,
  onSplitDividerPointerDown,
  onSplitDividerPointerMove,
  onSplitDividerPointerUp,
  onTextChange,
  onToggleLineNumbers,
  onToggleLineWrapping,
  onToggleSearch,
  onToggleSyncScrolling,
  onToggleViewOptions,
  onUndo,
}: DocumentWorkbenchProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  const shouldRenderPreview = documentSurface.documentControls.activeViewMode !== "edit";
  const activeFormats = useMemo(
    () =>
      documentSurface.documentControls.activeViewMode === "preview" || !activeSelection
        ? []
        : editorRef.current?.getActiveFormats() ?? [],
    [activeSelection, documentSurface.documentControls.activeViewMode, editorRef, text],
  );
  const suspendLineWrappingForLongLine = useMemo(
    () => activeLineWrapping && hasLongMarkdownLine(text),
    [activeLineWrapping, text],
  );
  const effectiveLineWrapping = activeLineWrapping && !suspendLineWrappingForLongLine;
  const isSourceSearchActive = searchOpen && searchTarget === "source";
  const isPreviewSearchActive = searchOpen && searchTarget === "preview";
  const previewBodySourceLineOffset = useMemo(
    () => Math.max(0, getLineNumberForOffset(text, previewBodyStartOffset) - 1),
    [previewBodyStartOffset, text],
  );
  const editorSurfaceClassName = suspendLineWrappingForLongLine
    ? `${documentSurface.editorSurfaceClassName} line-wrapping-suspended`
    : documentSurface.editorSurfaceClassName;
  const handlePreviewTaskToggle = useCallback((sourceLineIndex: number) => {
    const lineStart = getLineStartOffset(text, sourceLineIndex);
    const edit = toggleMarkdownTaskOnLine(text, lineStart);
    if (!edit) {
      return;
    }

    const applied =
      editorRef.current?.applyLocalTextPatches([edit.patch], edit.selection, {
        focus: false,
        isolateHistory: true,
      }) ?? false;
    if (applied) {
      return;
    }

    const patch = edit.patch;
    onTextChange(`${text.slice(0, patch.from)}${patch.insert}${text.slice(patch.to)}`, {
      patches: [patch],
    });
  }, [editorRef, onTextChange, text]);

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
          onToggleSearch={onToggleSearch}
          onToggleViewOptions={onToggleViewOptions}
          onSetReadingWidth={onSetReadingWidth}
          onToggleSyncScrolling={onToggleSyncScrolling}
          onToggleLineWrapping={onToggleLineWrapping}
          onToggleLineNumbers={onToggleLineNumbers}
        />
      </section>

      {searchOpen && (
        <DocumentSearchBar
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          replaceQuery={replaceQuery}
          searchMatchCount={searchMatchCount}
          searchError={searchError}
          activeSearchMatchIndex={activeSearchMatchIndex}
          replaceAvailable={replaceAvailable}
          searchOptions={searchOptions}
          language={language}
          onSearchQueryChange={onSearchQueryChange}
          onToggleSearchOption={onToggleSearchOption}
          onReplaceQueryChange={onReplaceQueryChange}
          onGoToSearchMatch={onGoToSearchMatch}
          onSelectAllSearchMatches={onSelectAllSearchMatches}
          onReplaceCurrentMatch={onReplaceCurrentMatch}
          onReplaceAllMatches={onReplaceAllMatches}
          onCloseSearch={onCloseSearch}
        />
      )}

      <section
        className={documentSurface.workspaceClassName}
        ref={workspaceRef}
        style={splitWorkspaceStyle}
      >
        <article
          className={editorSurfaceClassName}
          ref={editorSurfaceRef}
          onScroll={onEditorScroll}
        >
          <MarkdownEditor
            ref={editorRef}
            ariaLabel={copy.editor}
            interfaceCopy={copy}
            fileId={activeFile.id}
            value={text}
            largeDocumentMode={largeDocumentMode}
            lineWrapping={effectiveLineWrapping}
            lineNumbers={activeLineNumbers}
            bookmarks={activeBookmarks}
            commentAnchors={activeCommentAnchors}
            commentsEnabled
            collaborationBinding={isLive ? collaborationBinding : null}
            activeCommentId={focusedCommentId}
            searchMatches={isSourceSearchActive ? searchMatches : []}
            activeSearchMatchIndex={isSourceSearchActive ? activeSearchMatchIndex : -1}
            onChange={onTextChange}
            onBookmarksChange={onBookmarksChange}
            onHistoryStateChange={onEditorHistoryStateChange}
            onOpenLineActions={onLineAction}
            onOpenComment={onOpenComment}
            onSelectionChange={onEditorSelectionChange}
            onSelectionActionPositionChange={onEditorSelectionActionPositionChange}
            onScrollRatioChange={onEditorScrollRatioChange}
          />
        </article>

        {documentSurface.showSplitResizeHandle && (
          <button
            type="button"
            className="split-resize-handle"
            role="separator"
            aria-label={copy.resizeSplitView}
            aria-orientation="vertical"
            aria-valuemin={splitDividerMinValue}
            aria-valuemax={splitDividerMaxValue}
            aria-valuenow={splitDividerValue}
            onDoubleClick={onResetSplitRatio}
            onKeyDown={onSplitDividerKeyDown}
            onPointerCancel={onSplitDividerPointerCancel}
            onPointerDown={onSplitDividerPointerDown}
            onPointerMove={onSplitDividerPointerMove}
            onPointerUp={onSplitDividerPointerUp}
          />
        )}

        {shouldRenderPreview && (
          <article
            className="preview-surface"
            ref={previewSurfaceRef}
            onKeyUp={onPreviewKeyUp}
            onMouseUp={onPreviewMouseUp}
            onScroll={onPreviewScroll}
            onTouchEnd={onPreviewTouchEnd}
          >
            <MarkdownPreview
              ref={previewRef}
              uiLanguage={language}
              metadata={previewMetadata}
              body={previewBody}
              sourceLineOffset={previewBodySourceLineOffset}
              bodyTextChange={previewBodyTextChange}
              largeDocumentMode={largeDocumentMode}
              commentAnchors={activePreviewCommentAnchors}
              lineAnnotations={activePreviewLineAnnotations}
              activeCommentId={focusedCommentId}
              commentsEnabled
              searchQuery={isPreviewSearchActive ? searchQuery : ""}
              searchOptions={searchOptions}
              activeSearchMatchIndex={isPreviewSearchActive ? activeSearchMatchIndex : -1}
              suspendLineMeasurement={splitDividerDragging}
              onSearchMatchCountChange={onPreviewSearchMatchCountChange}
              onLineAction={onLineAction as (request: MarkdownPreviewLineActionRequest) => void}
              onOpenComment={onOpenComment}
              onToggleTaskLine={handlePreviewTaskToggle}
            />
          </article>
        )}
      </section>

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
