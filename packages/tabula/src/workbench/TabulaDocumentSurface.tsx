import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getLineNumberForOffset,
  getLineStartOffset,
  hasLongMarkdownLine,
  toggleMarkdownTaskOnLine,
} from "@tabula-md/tabula";
import type {
  CollaborationLiveSelection,
  DocumentSurfaceModel,
  TextChange,
} from "@tabula-md/tabula";
import type { CollabEditorBinding } from "../../../../tabula-app/src/collaboration/liveCollaboration";
import type { SearchMatch, SearchOptions } from "../../../../tabula-app/src/editor/editorSearchModel";
import type { SearchTarget } from "../../../../tabula-app/src/editor/useEditorSearchController";
import type { WorkspaceLanguage } from "../../../../tabula-app/src/workspace/state/useWorkspacePreferences";
import type {
  MarkdownBookmark,
  MarkdownCommentAnchor,
  MarkdownEditorHandle,
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "../../../../tabula-app/src/document/markdownEditorTypes";
import type { MarkdownPreviewHandle } from "../../../../tabula-app/src/preview/previewSyncTypes";
import type { FileBookmark, WorkspaceFile } from "../../../../tabula-app/src/workspace/workspaceStorage";
import { MarkdownEditor } from "../../../../tabula-app/src/document/MarkdownEditor";
import { ResizeHandle } from "../../../../tabula-app/src/ui/ResizeHandle";
import {
  type MarkdownPreviewCommentAnchor,
  type MarkdownPreviewLineActionRequest,
  type MarkdownPreviewLineAnnotation,
  type MarkdownPreviewMetadata,
  type MarkdownPreviewProps,
} from "../../../../tabula-app/src/preview/markdownPreviewTypes";
import {
  getLoadedMarkdownPreview,
  loadMarkdownPreview,
  type MarkdownPreviewComponent,
} from "../../../../tabula-app/src/preview/markdownPreviewLoader";
import { getWorkspaceSurfaceCopy } from "../../../../tabula-app/src/workspace/workspaceSurfaceLocale";

const LONG_LINE_RECHECK_DELAY_MS = 240;
const WORKSPACE_FADE_REVEAL_DISTANCE_PX = 64;
const WORKSPACE_FADE_TRAVEL_PX = 108;

const useWorkspaceScrollFade = (workspaceRef: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return undefined;

    let animationFrame = 0;
    const update = () => {
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      const remainingScroll = Math.max(0, maxScrollTop - element.scrollTop);
      const topProgress = Math.min(
        1,
        Math.max(0, element.scrollTop) / WORKSPACE_FADE_REVEAL_DISTANCE_PX,
      );
      const bottomProgress = Math.min(
        1,
        remainingScroll / WORKSPACE_FADE_REVEAL_DISTANCE_PX,
      );
      element.style.setProperty(
        "--workspace-top-fade-shift",
        `${topProgress * WORKSPACE_FADE_TRAVEL_PX}px`,
      );
      element.style.setProperty(
        "--workspace-bottom-fade-shift",
        `${bottomProgress * WORKSPACE_FADE_TRAVEL_PX}px`,
      );
    };
    const scheduleUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        update();
      });
    };

    scheduleUpdate();
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(element);
    Array.from(element.children).forEach((child) => resizeObserver.observe(child));
    element.addEventListener("scroll", scheduleUpdate, { passive: true });

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      element.removeEventListener("scroll", scheduleUpdate);
      element.style.removeProperty("--workspace-top-fade-shift");
      element.style.removeProperty("--workspace-bottom-fade-shift");
    };
  }, [workspaceRef]);
};

const useLongLineWrappingSuspension = (
  fileId: string,
  lineWrapping: boolean,
  text: string,
) => {
  const activeFileIdRef = useRef(fileId);
  const [hasLongLine, setHasLongLine] = useState(() => lineWrapping && hasLongMarkdownLine(text));

  useEffect(() => {
    if (!lineWrapping) {
      activeFileIdRef.current = fileId;
      setHasLongLine(false);
      return undefined;
    }

    if (activeFileIdRef.current !== fileId) {
      activeFileIdRef.current = fileId;
      setHasLongLine(hasLongMarkdownLine(text));
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setHasLongLine(hasLongMarkdownLine(text));
    }, LONG_LINE_RECHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [fileId, lineWrapping, text]);

  return lineWrapping && hasLongLine;
};

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
  commentsEnabled?: boolean;
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
  onEditorSelectionChange: (selection?: CollaborationLiveSelection) => void;
  onLineAction: (request: MarkdownLineActionRequest) => void;
  onOpenComment: (commentId: string) => void;
  onOpenWorkspaceLink?: MarkdownPreviewProps["onOpenWorkspaceLink"];
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
  resolveWorkspaceDocument?: MarkdownPreviewProps["resolveWorkspaceDocument"];
  resolveWorkspaceLink?: MarkdownPreviewProps["resolveWorkspaceLink"];
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
  commentsEnabled = true,
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
  onOpenWorkspaceLink,
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
  resolveWorkspaceDocument,
  resolveWorkspaceLink,
}: TabulaDocumentSurfaceProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  const shouldRenderPreview =
    documentSurface.documentControls.activeViewMode === "split" ||
    documentSurface.documentControls.activeViewMode === "preview";
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
  const suspendLineWrappingForLongLine = useLongLineWrappingSuspension(
    activeFile.id,
    activeLineWrapping,
    text,
  );
  const effectiveLineWrapping = activeLineWrapping && !suspendLineWrappingForLongLine;
  const isSourceSearchActive = searchOpen && searchTarget === "source";
  const isPreviewSearchActive = searchOpen && searchTarget === "preview";
  useWorkspaceScrollFade(workspaceRef);
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
          lineNumbers={
            activeLineNumbers &&
            documentSurface.documentControls.activeViewMode !== "visual"
          }
          visualEditing={documentSurface.documentControls.activeViewMode === "visual"}
          bookmarks={activeBookmarks}
          commentAnchors={activeCommentAnchors}
          commentsEnabled={commentsEnabled}
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
              commentsEnabled={commentsEnabled}
              searchQuery={isPreviewSearchActive ? searchQuery : ""}
              searchOptions={searchOptions}
              activeSearchMatchIndex={isPreviewSearchActive ? activeSearchMatchIndex : -1}
              suspendLineMeasurement={splitDividerDragging}
              onSearchMatchCountChange={onPreviewSearchMatchCountChange}
              onLineAction={onLineAction as (request: MarkdownPreviewLineActionRequest) => void}
              onOpenComment={onOpenComment}
              onOpenWorkspaceLink={onOpenWorkspaceLink}
              sourceDocumentId={activeFile.id}
              resolveWorkspaceDocument={resolveWorkspaceDocument}
              resolveWorkspaceLink={resolveWorkspaceLink}
              onToggleTaskLine={handlePreviewTaskToggle}
            />
          ) : null}
        </article>
      )}
    </section>
  );
}
