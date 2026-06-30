import {
  type CSSProperties,
  type RefObject,
} from "react";
import { MessageSquarePlus } from "lucide-react";
import type { DocumentSurfaceModel } from "@tabula-md/tabula";
import type { SearchMatch } from "../markdown";
import type { MarkdownFormatCommand } from "../markdownFormatting";
import type { CenterPopover } from "../uiTypes";
import type { Collaborator, LiveSelection } from "../collab";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import type {
  MarkdownCommentAnchor,
  MarkdownBookmark,
  MarkdownEditorHandle,
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "../markdownEditorTypes";
import type {
  FileBookmark,
  FileViewMode,
  ReadingWidth,
  WorkspaceFile,
} from "../workspaceStorage";
import type { TextChange } from "../textPatches";
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

export type DocumentWorkbenchProps = {
  activeBookmarks: FileBookmark[];
  activeCommentAnchors: MarkdownCommentAnchor[];
  activeFile: WorkspaceFile;
  activeFileTitle: string;
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activePreviewCommentAnchors: MarkdownPreviewCommentAnchor[];
  activePreviewLineAnnotations: MarkdownPreviewLineAnnotation[];
  activeSearchMatchIndex: number;
  canRedo: boolean;
  canUndo: boolean;
  centerPopover: CenterPopover;
  collaborators: Collaborator[];
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
  previewMetadata: MarkdownPreviewMetadata[];
  previewSurfaceRef: RefObject<HTMLElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchMatches: SearchMatch[];
  searchOpen: boolean;
  searchQuery: string;
  selectedCharacterCount: number;
  selectedLineCount: number;
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
  onCopyFile: () => void;
  onEditorHistoryStateChange: (historyState: { canUndo: boolean; canRedo: boolean }) => void;
  onEditorScroll: () => void;
  onEditorScrollRatioChange: (ratio: number) => void;
  onEditorSelectionActionPositionChange: (position: MarkdownSelectionActionPosition | null) => void;
  onEditorSelectionChange: (selection: LiveSelection) => void;
  onFormat: (command: MarkdownFormatCommand) => void;
  onGoToSearchMatch: (direction: 1 | -1) => void;
  onLineAction: (request: MarkdownLineActionRequest) => void;
  onOpenComment: (commentId: string) => void;
  onOpenComments: () => void;
  onOpenSelectionComment: () => void;
  onPreviewKeyUp: () => void;
  onPreviewMouseUp: () => void;
  onPreviewScroll: () => void;
  onPreviewTouchEnd: () => void;
  onRedo: () => void;
  onResetSplitRatio: () => void;
  onSearchQueryChange: (query: string) => void;
  onSetReadingWidth: (readingWidth: ReadingWidth) => void;
  onSetViewMode: (viewMode: FileViewMode) => void;
  onSplitDividerKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onTextChange: (nextValue: string, change?: TextChange) => void;
  onToggleLineNumbers: () => void;
  onToggleLineWrapping: () => void;
  onToggleSearch: () => void;
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
    Math.min(position.clientX, viewportWidth - options.width - 12),
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
  activeFileTitle,
  activeLineNumbers,
  activeLineWrapping,
  activePreviewCommentAnchors,
  activePreviewLineAnnotations,
  activeSearchMatchIndex,
  canRedo,
  canUndo,
  centerPopover,
  collaborators,
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
  previewMetadata,
  previewSurfaceRef,
  searchInputRef,
  searchMatches,
  searchOpen,
  searchQuery,
  selectedCharacterCount,
  selectedLineCount,
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
  onCopyFile,
  onEditorHistoryStateChange,
  onEditorScroll,
  onEditorScrollRatioChange,
  onEditorSelectionActionPositionChange,
  onEditorSelectionChange,
  onFormat,
  onGoToSearchMatch,
  onLineAction,
  onOpenComment,
  onOpenComments,
  onOpenSelectionComment,
  onPreviewKeyUp,
  onPreviewMouseUp,
  onPreviewScroll,
  onPreviewTouchEnd,
  onRedo,
  onResetSplitRatio,
  onSearchQueryChange,
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
  onToggleViewOptions,
  onUndo,
}: DocumentWorkbenchProps) {
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
          canCopyFile={documentSurface.documentControls.canCopyFile}
          centerPopover={centerPopover}
          language={language}
          searchOpen={searchOpen}
          onCopyFile={onCopyFile}
          onSetViewMode={onSetViewMode}
          onToggleSearch={onToggleSearch}
          onToggleViewOptions={onToggleViewOptions}
          onSetReadingWidth={onSetReadingWidth}
          onToggleLineWrapping={onToggleLineWrapping}
          onToggleLineNumbers={onToggleLineNumbers}
        />
      </section>

      {searchOpen && (
        <DocumentSearchBar
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          searchMatches={searchMatches}
          activeSearchMatchIndex={activeSearchMatchIndex}
          language={language}
          onSearchQueryChange={onSearchQueryChange}
          onGoToSearchMatch={onGoToSearchMatch}
          onCloseSearch={onCloseSearch}
        />
      )}

      <section
        className={documentSurface.workspaceClassName}
        ref={workspaceRef}
        style={splitWorkspaceStyle}
      >
        <article
          className={documentSurface.editorSurfaceClassName}
          ref={editorSurfaceRef}
          onScroll={onEditorScroll}
        >
          <MarkdownEditor
            ref={editorRef}
            fileId={activeFile.id}
            fileTitle={activeFileTitle}
            roomId={activeFile.roomId}
            value={text}
            lineWrapping={activeLineWrapping}
            lineNumbers={activeLineNumbers}
            bookmarks={activeBookmarks}
            commentAnchors={isLive ? activeCommentAnchors : []}
            commentsEnabled={isLive}
            collaborators={isLive ? collaborators : []}
            activeCommentId={focusedCommentId}
            searchMatches={searchOpen ? searchMatches : []}
            activeSearchMatchIndex={searchOpen ? activeSearchMatchIndex : -1}
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
            aria-label="Resize split view"
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

        <article
          className="preview-surface"
          ref={previewSurfaceRef}
          onKeyUp={onPreviewKeyUp}
          onMouseUp={onPreviewMouseUp}
          onScroll={onPreviewScroll}
          onTouchEnd={onPreviewTouchEnd}
        >
          <MarkdownPreview
            metadata={previewMetadata}
            body={previewBody}
            commentAnchors={isLive ? activePreviewCommentAnchors : []}
            lineAnnotations={activePreviewLineAnnotations}
            activeCommentId={focusedCommentId}
            commentsEnabled={isLive}
            suspendLineMeasurement={splitDividerDragging}
            onLineAction={onLineAction as (request: MarkdownPreviewLineActionRequest) => void}
            onOpenComment={onOpenComment}
          />
        </article>
      </section>

      {documentSurface.showSelectionCommentPopover && selectionActionPosition && (
        <div
          className="selection-comment-popover"
          style={getFloatingPopoverStyle(selectionActionPosition, {
            width: 128,
            yOffset: 30,
          })}
          role="toolbar"
          aria-label="Selection actions"
        >
          <button
            className="selection-comment-button"
            type="button"
            onClick={onOpenSelectionComment}
          >
            <MessageSquarePlus size={15} />
            <span>Add comment</span>
          </button>
        </div>
      )}

      <StatusBar
        activeFileTitle={documentSurface.statusBar.activeFileTitle}
        activeViewMode={documentSurface.statusBar.activeViewMode}
        isLive={isLive}
        language={language}
        statusLabel={statusLabel}
        wordCount={documentSurface.statusBar.wordCount}
        commentCount={documentSurface.statusBar.commentCount}
        cursorPositionLabel={cursorPositionLabel}
        selectedCharacterCount={selectedCharacterCount}
        selectedLineCount={selectedLineCount}
        onOpenComments={onOpenComments}
      />
    </>
  );
}
