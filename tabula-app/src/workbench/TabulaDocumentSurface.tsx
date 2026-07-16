import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getLineNumberForOffset,
  getLineStartOffset,
  hasLongMarkdownLine,
  toggleMarkdownTaskOnLine,
} from "@tabula-md/tabula";
import type { DocumentSurfaceModel, TextChange } from "@tabula-md/tabula";
import type { LiveSelection } from "../collaboration";
import type { CollabEditorBinding } from "../collaboration/liveCollaboration";
import type { SearchMatch, SearchOptions } from "../editor/editorSearchModel";
import type { SearchTarget } from "../editor/useEditorSearchController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import type {
  MarkdownBookmark,
  MarkdownCommentAnchor,
  MarkdownEditorHandle,
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "../markdownEditorTypes";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import type { FileBookmark, WorkspaceFile } from "../workspaceStorage";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { ResizeHandle } from "../components/ui/ResizeHandle";
import {
  type MarkdownPreviewCommentAnchor,
  type MarkdownPreviewLineActionRequest,
  type MarkdownPreviewLineAnnotation,
  type MarkdownPreviewMetadata,
} from "../preview/markdownPreviewTypes";
import {
  getLoadedMarkdownPreview,
  loadMarkdownPreview,
  type MarkdownPreviewComponent,
} from "../preview/markdownPreviewLoader";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";

/**
 * The shared editor/preview lane used by Tabula workbenches.
 *
 * Persistence, rooms, comments, and host-specific chrome stay outside this
 * component. That lets a future MCP adapter supply the same document surface
 * without inheriting the browser workspace runtime.
 */
export type TabulaDocumentSurfaceProps = {
  activeBookmarks: FileBookmark[];
  activeCommentAnchors: MarkdownCommentAnchor[];
  activeFile: Pick<WorkspaceFile, "id">;
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activePreviewCommentAnchors: MarkdownPreviewCommentAnchor[];
  activePreviewLineAnnotations: MarkdownPreviewLineAnnotation[];
  activeSearchMatchIndex: number;
  collaborationBinding?: CollabEditorBinding | null;
  documentSurface: Pick<
    DocumentSurfaceModel,
    | "documentControls"
    | "editorSurfaceClassName"
    | "showSplitResizeHandle"
    | "workspaceClassName"
  >;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  editorSurfaceRef: RefObject<HTMLElement | null>;
  focusedCommentId: string | null;
  isLive: boolean;
  language: WorkspaceLanguage;
  largeDocumentMode: boolean;
  previewBody: string;
  previewBodyStartOffset: number;
  previewBodyTextChange?: TextChange | null;
  previewMetadata: MarkdownPreviewMetadata[];
  previewRef: RefObject<MarkdownPreviewHandle | null>;
  previewSurfaceRef: RefObject<HTMLElement | null>;
  searchMatches: SearchMatch[];
  searchOpen: boolean;
  searchOptions: SearchOptions;
  searchQuery: string;
  searchTarget: SearchTarget;
  splitDividerDragging: boolean;
  splitDividerMaxValue: number;
  splitDividerMinValue: number;
  splitDividerValue: number;
  splitWorkspaceStyle?: CSSProperties;
  text: string;
  workspaceRef: RefObject<HTMLElement | null>;
  onBookmarksChange: (bookmarks: MarkdownBookmark[]) => void;
  onEditorHistoryStateChange: (historyState: { canUndo: boolean; canRedo: boolean }) => void;
  onEditorScroll: () => void;
  onEditorScrollRatioChange: (ratio: number) => void;
  onEditorSelectionActionPositionChange: (position: MarkdownSelectionActionPosition | null) => void;
  onEditorSelectionChange: (selection?: LiveSelection) => void;
  onLineAction: (request: MarkdownLineActionRequest) => void;
  onOpenComment: (commentId: string) => void;
  onPreviewKeyUp: () => void;
  onPreviewMouseUp: () => void;
  onPreviewScroll: () => void;
  onPreviewTouchEnd: () => void;
  onPreviewSearchMatchCountChange: (count: number) => void;
  onResetSplitRatio: () => void;
  onSplitDividerKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSplitDividerPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onTextChange: (nextValue: string | null, change?: TextChange) => void;
};

export function TabulaDocumentSurface({
  activeBookmarks,
  activeCommentAnchors,
  activeFile,
  activeLineNumbers,
  activeLineWrapping,
  activePreviewCommentAnchors,
  activePreviewLineAnnotations,
  activeSearchMatchIndex,
  collaborationBinding,
  documentSurface,
  editorRef,
  editorSurfaceRef,
  focusedCommentId,
  isLive,
  language,
  largeDocumentMode,
  previewBody,
  previewBodyStartOffset,
  previewBodyTextChange,
  previewMetadata,
  previewRef,
  previewSurfaceRef,
  searchMatches,
  searchOpen,
  searchOptions,
  searchQuery,
  searchTarget,
  splitDividerDragging,
  splitDividerMaxValue,
  splitDividerMinValue,
  splitDividerValue,
  splitWorkspaceStyle,
  text,
  workspaceRef,
  onBookmarksChange,
  onEditorHistoryStateChange,
  onEditorScroll,
  onEditorScrollRatioChange,
  onEditorSelectionActionPositionChange,
  onEditorSelectionChange,
  onLineAction,
  onOpenComment,
  onPreviewKeyUp,
  onPreviewMouseUp,
  onPreviewScroll,
  onPreviewTouchEnd,
  onPreviewSearchMatchCountChange,
  onResetSplitRatio,
  onSplitDividerKeyDown,
  onSplitDividerPointerCancel,
  onSplitDividerPointerDown,
  onSplitDividerPointerMove,
  onSplitDividerPointerUp,
  onTextChange,
}: TabulaDocumentSurfaceProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  const shouldRenderPreview = documentSurface.documentControls.activeViewMode !== "edit";
  const [MarkdownPreview, setMarkdownPreview] = useState<MarkdownPreviewComponent | null>(
    getLoadedMarkdownPreview,
  );
  const ResolvedMarkdownPreview = MarkdownPreview ?? getLoadedMarkdownPreview();
  useEffect(() => {
    if (!shouldRenderPreview || ResolvedMarkdownPreview) return;
    let cancelled = false;
    void loadMarkdownPreview()
      .then((component) => {
        if (!cancelled) setMarkdownPreview(() => component);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ResolvedMarkdownPreview, shouldRenderPreview]);
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
    if (!edit) return;

    const applied =
      editorRef.current?.applyLocalTextPatches([edit.patch], edit.selection, {
        focus: false,
        isolateHistory: true,
      }) ?? false;
    if (applied) return;

    const patch = edit.patch;
    onTextChange(`${text.slice(0, patch.from)}${patch.insert}${text.slice(patch.to)}`, {
      patches: [patch],
    });
  }, [editorRef, onTextChange, text]);

  return (
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
        <ResizeHandle
          className="split-resize-handle"
          dragging={splitDividerDragging}
          label={copy.resizeSplitView}
          minimum={splitDividerMinValue}
          maximum={splitDividerMaxValue}
          value={splitDividerValue}
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
          {ResolvedMarkdownPreview ? (
            <ResolvedMarkdownPreview
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
          ) : null}
        </article>
      )}
    </section>
  );
}
