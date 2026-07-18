import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildDocumentSurface,
  createActiveDocumentRuntime,
  getPreviewLineAnnotations,
  toggleLineBookmarkInList,
  type FileViewMode,
} from "@tabula-md/tabula";
import { DocumentControls } from "../../../../tabula-app/src/document/DocumentControls";
import { useSplitPreviewFollow } from "../../../../tabula-app/src/document/useSplitPreviewFollow";
import { useSplitViewController } from "../../../../tabula-app/src/document/useSplitViewController";
import type { WorkspaceLanguage } from "../../../../tabula-app/src/workspace/state/useWorkspacePreferences";
import type {
  MarkdownBookmark,
  MarkdownEditorHandle,
} from "../../../../tabula-app/src/document/markdownEditorTypes";
import type { MarkdownPreviewHandle } from "../../../../tabula-app/src/preview/previewSyncTypes";
import type { CenterPopover } from "../../../../tabula-app/src/ui/uiTypes";
import type { FileBookmark } from "../../../../tabula-app/src/workspace/workspaceStorage";
import { TabulaDocumentSurface } from "./TabulaDocumentSurface";

export type TabulaEmbeddedDocumentWorkbenchProps = {
  documentId: string;
  markdown: string;
  title: string;
  language?: WorkspaceLanguage;
  initialViewMode?: FileViewMode;
  onMarkdownChange: (markdown: string) => void;
  onSelectedTextChange?: (selectedText: string) => void;
  onViewModeChange?: (viewMode: FileViewMode) => void;
};

const createBookmarkId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `bookmark-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeBookmarks = (bookmarks: MarkdownBookmark[]): FileBookmark[] =>
  bookmarks.map((bookmark) => ({
    id: bookmark.id,
    position: bookmark.position,
    createdAt: bookmark.createdAt ?? new Date().toISOString(),
  }));

/**
 * A host-neutral Tabula document workbench for embedded surfaces such as an
 * MCP App. It shares the production Markdown editor, preview, view controls,
 * and split-resize behavior without assuming a browser workspace, comments,
 * or room lifecycle.
 */
export function TabulaEmbeddedDocumentWorkbench({
  documentId,
  markdown,
  title,
  language = "en",
  initialViewMode = "split",
  onMarkdownChange,
  onSelectedTextChange,
  onViewModeChange,
}: TabulaEmbeddedDocumentWorkbenchProps) {
  const workspaceRef = useRef<HTMLElement | null>(null);
  const editorSurfaceRef = useRef<HTMLElement | null>(null);
  const previewSurfaceRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const scrollSyncingRef = useRef(false);
  const [viewMode, setViewMode] = useState<FileViewMode>(initialViewMode);
  const [readingWidth, setReadingWidth] = useState<"narrow" | "standard" | "wide">("wide");
  const [lineWrapping, setLineWrapping] = useState(true);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [syncScrolling, setSyncScrolling] = useState(true);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [splitViewOptionsOpen, setSplitViewOptionsOpen] = useState<CenterPopover>(null);
  const [bookmarks, setBookmarks] = useState<FileBookmark[]>([]);

  useEffect(() => {
    setBookmarks([]);
  }, [documentId]);

  const activeDocument = useMemo(
    () =>
      createActiveDocumentRuntime({
        title,
        text: markdown,
        viewMode,
        readingWidth,
        splitRatio,
        lineWrapping,
        lineNumbers,
        bookmarks,
      }),
    [bookmarks, lineNumbers, lineWrapping, markdown, readingWidth, splitRatio, title, viewMode],
  );
  const documentSurface = useMemo(
    () =>
      buildDocumentSurface({
        document: activeDocument,
        hasSelectionActionPosition: false,
        searchOpen: false,
        selectedCharacterCount: 0,
        shareOpen: false,
        splitDividerDragging: false,
      }),
    [activeDocument],
  );
  const splitView = useSplitViewController({
    activeViewMode: viewMode,
    activeSplitRatio: splitRatio,
    workspaceRef,
    editorSurfaceRef,
    onSetSplitRatio: setSplitRatio,
  });
  const previewFollow = useSplitPreviewFollow({
    activeFileId: documentId,
    activeViewMode: viewMode,
    editorRef,
    previewFollowEnabled: syncScrolling,
    previewRef,
    scrollSyncingRef,
    splitDividerDragging: splitView.splitDividerDragging,
  });
  const previewLineAnnotations = useMemo(
    () =>
      getPreviewLineAnnotations({
        body: activeDocument.renderedPreview.body,
        bodyStartOffset: activeDocument.previewBodyStartOffset,
        bookmarks,
        commentAnchors: [],
      }),
    [activeDocument.previewBodyStartOffset, activeDocument.renderedPreview.body, bookmarks],
  );

  const setDocumentViewMode = (nextViewMode: FileViewMode) => {
    setViewMode(nextViewMode);
    onViewModeChange?.(nextViewMode);
  };

  return (
    <section className="tabula-embedded-workbench" data-tabula-document-workbench>
      <section className={documentSurface.fileShellClassName}>
        <section className={documentSurface.documentToolbarClassName} aria-label="Document controls">
          <DocumentControls
            activeViewMode={viewMode}
            activeReadingWidth={readingWidth}
            activeLineWrapping={lineWrapping}
            activeLineNumbers={lineNumbers}
            activeSyncScrolling={syncScrolling}
            centerPopover={splitViewOptionsOpen}
            language={language}
            searchOpen={false}
            showSearch={false}
            onSetViewMode={setDocumentViewMode}
            onPreparePreview={() => undefined}
            onToggleViewOptions={() =>
              setSplitViewOptionsOpen((currentPopover) =>
                currentPopover === "view" ? null : "view",
              )
            }
            onSetReadingWidth={setReadingWidth}
            onToggleSyncScrolling={() => setSyncScrolling((isEnabled) => !isEnabled)}
            onToggleLineWrapping={() => setLineWrapping((isEnabled) => !isEnabled)}
            onToggleLineNumbers={() => setLineNumbers((isEnabled) => !isEnabled)}
            onToggleSearch={() => undefined}
          />
        </section>

        <TabulaDocumentSurface
          activeBookmarks={bookmarks}
          activeCommentAnchors={[]}
          activeFile={{ id: documentId }}
          activeLineNumbers={lineNumbers}
          activeLineWrapping={lineWrapping}
          activePreviewCommentAnchors={[]}
          activePreviewLineAnnotations={previewLineAnnotations}
          activeSearchMatchIndex={-1}
          commentsEnabled={false}
          documentSurface={{
            ...documentSurface,
            workspaceClassName: splitView.splitDividerDragging
              ? `${documentSurface.workspaceClassName} split-resizing`
              : documentSurface.workspaceClassName,
          }}
          editorRef={editorRef}
          editorSurfaceRef={editorSurfaceRef}
          focusedCommentId={null}
          isLive={false}
          language={language}
          largeDocumentMode={activeDocument.largeDocumentMode}
          previewBody={activeDocument.renderedPreview.body}
          previewBodyStartOffset={activeDocument.previewBodyStartOffset}
          previewMetadata={activeDocument.parsedMarkdown.attributes}
          previewRef={previewRef}
          previewSurfaceRef={previewSurfaceRef}
          searchMatches={[]}
          searchOpen={false}
          searchOptions={{ caseSensitive: false, regexp: false, wholeWord: false }}
          searchQuery=""
          searchTarget="source"
          splitDividerDragging={splitView.splitDividerDragging}
          splitDividerMaxValue={splitView.splitDividerMaxValue}
          splitDividerMinValue={splitView.splitDividerMinValue}
          splitDividerValue={splitView.splitDividerValue}
          splitWorkspaceStyle={splitView.splitWorkspaceStyle}
          text={markdown}
          workspaceRef={workspaceRef}
          onBookmarksChange={(nextBookmarks) => setBookmarks(normalizeBookmarks(nextBookmarks))}
          onEditorHistoryStateChange={() => undefined}
          onEditorScroll={previewFollow.handleEditorSurfaceScroll}
          onEditorScrollRatioChange={previewFollow.handleEditorScrollRatioChange}
          onEditorSelectionActionPositionChange={() => undefined}
          onEditorSelectionChange={() =>
            onSelectedTextChange?.(editorRef.current?.getSelectedText() ?? "")
          }
          onLineAction={(request) => {
            setBookmarks((currentBookmarks) =>
              normalizeBookmarks(
                toggleLineBookmarkInList({
                  bookmarks: currentBookmarks,
                  createId: createBookmarkId,
                  lineStart: request.start,
                  lineEnd: request.end,
                  nowIso: new Date().toISOString(),
                }),
              ),
            );
          }}
          onOpenComment={() => undefined}
          onPreviewKeyUp={() => undefined}
          onPreviewMouseUp={() => undefined}
          onPreviewScroll={previewFollow.handlePreviewScroll}
          onPreviewTouchEnd={() => undefined}
          onPreviewSearchMatchCountChange={() => undefined}
          onResetSplitRatio={splitView.resetSplitRatio}
          onSplitDividerKeyDown={splitView.handleSplitDividerKeyDown}
          onSplitDividerPointerCancel={splitView.endSplitDividerDrag}
          onSplitDividerPointerDown={splitView.handleSplitDividerPointerDown}
          onSplitDividerPointerMove={splitView.handleSplitDividerPointerMove}
          onSplitDividerPointerUp={splitView.endSplitDividerDrag}
          onTextChange={(nextMarkdown) =>
            onMarkdownChange(nextMarkdown ?? editorRef.current?.getValue() ?? markdown)
          }
        />
      </section>
    </section>
  );
}
