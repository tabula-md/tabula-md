import { useRef, type RefObject } from "react";
import { createEditingActivationTracker, productAnalytics } from "../observability/productAnalytics";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import type { useWorkspaceCommentActions } from "../comments/useWorkspaceCommentActions";
import type { useWorkspaceActiveFileEditor } from "./useWorkspaceActiveFileEditor";
import type { useWorkspaceDocumentRuntime } from "./useWorkspaceDocumentRuntime";
import type { useDocumentSurfaceController } from "./useDocumentSurfaceController";
import type { MarkdownEditorHandle } from "./markdownEditorTypes";
import type { useWorkspaceRoomController } from "../workspace/useWorkspaceRoomController";
import type { useWorkspacePersistenceRuntime } from "../workspace/persistence/useWorkspacePersistenceRuntime";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type { WorkspaceFile } from "../workspace/workspaceStorage";
import type { CenterPopover } from "../ui/uiTypes";

type DocumentRuntime = ReturnType<typeof useWorkspaceDocumentRuntime>;
type ActiveFileEditor = ReturnType<typeof useWorkspaceActiveFileEditor>;
type CommentActions = ReturnType<typeof useWorkspaceCommentActions>;
type DocumentSurfaceController = ReturnType<typeof useDocumentSurfaceController>;
type RoomController = ReturnType<typeof useWorkspaceRoomController>;
type WorkspacePersistence = ReturnType<typeof useWorkspacePersistenceRuntime>;

type UseWorkspaceWorkbenchSurfaceControllerOptions = {
  activeFile?: WorkspaceFile;
  activeSyncScrolling: boolean;
  centerPopover: CenterPopover;
  comments: CommentActions;
  document: DocumentRuntime;
  editor: ActiveFileEditor;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  focusedCommentId: string | null;
  language: WorkspaceLanguage;
  onSetViewMode: (viewMode: WorkspaceFile["viewMode"]) => void;
  persistence: Pick<WorkspacePersistence, "persistedRevision">;
  previewRef: RefObject<MarkdownPreviewHandle | null>;
  room: Pick<
    RoomController,
    | "editorBinding"
    | "isLive"
    | "publishCurrentRoomViewport"
    | "statusLabel"
    | "stopFollowing"
    | "stopFollowingForLocalNavigation"
  >;
  surface: DocumentSurfaceController;
  toolbarLabel: string;
};

export function useWorkspaceWorkbenchSurfaceController({
  activeFile,
  activeSyncScrolling,
  centerPopover,
  comments,
  document,
  editor,
  editorRef,
  focusedCommentId,
  language,
  onSetViewMode,
  persistence,
  previewRef,
  room,
  surface,
  toolbarLabel,
}: UseWorkspaceWorkbenchSurfaceControllerOptions) {
  const editingActivationTrackerRef = useRef(createEditingActivationTracker());
  const { documentWorkbenchController, documentSurface } = surface;

  return {
    workbenchProps: {
      activeBookmarks: document.activeBookmarks,
      activeCommentAnchors: comments.activeCommentAnchors,
      activeFile,
      activeLineNumbers: document.activeLineNumbers,
      activeLineWrapping: document.activeLineWrapping,
      activeSyncScrolling,
      activePreviewCommentAnchors: comments.activePreviewCommentAnchors,
      activePreviewLineAnnotations: comments.activePreviewLineAnnotations,
      activeSearchMatchIndex: document.activeSearchMatchIndex,
      activeSelection: document.activeSelection,
      canRedo: editor.canRedo,
      canUndo: editor.canUndo,
      centerPopover,
      collaborationBinding: room.editorBinding,
      cursorPositionLabel: document.cursorPositionLabel,
      documentSurface,
      documentSearch: {
        searchInputRef: document.searchInputRef,
        searchQuery: document.searchQuery,
        replaceQuery: document.replaceQuery,
        searchMatchCount: document.searchMatchCount,
        searchMatchesTruncated: document.searchMatchesTruncated,
        searchError: document.searchError,
        searchOptions: document.searchOptions,
        activeSearchMatchIndex: document.activeSearchMatchIndex,
        replaceAvailable: document.replaceAvailable,
        target: document.searchTarget,
        onSearchQueryChange: document.setSearchQuery,
        onReplaceQueryChange: document.setReplaceQuery,
        onToggleSearchOption: document.toggleSearchOption,
        onGoToSearchMatch: document.goToSearchMatch,
        onSelectAllSearchMatches: document.selectAllSearchMatches,
        onReplaceCurrentMatch: document.replaceCurrentMatch,
        onReplaceAllMatches: document.replaceAllMatches,
        onCloseSearch: () => document.setSearchOpen(false),
      },
      editorHistoryCanRedo: editor.editorHistoryState.canRedo,
      editorHistoryCanUndo: editor.editorHistoryState.canUndo,
      editorRef,
      editorSurfaceRef: document.editorSurfaceRef,
      focusedCommentId,
      isLive: room.isLive,
      language,
      previewBody: document.renderedPreview.body,
      previewBodyStartOffset: document.previewBodyStartOffset,
      previewBodyTextChange: document.previewBodyTextChange,
      previewMetadata: document.parsedMarkdown.attributes,
      previewRef,
      previewSurfaceRef: document.previewSurfaceRef,
      largeDocumentMode: document.activeDocument.largeDocumentMode,
      searchMatches: document.searchMatches,
      searchOpen: document.searchOpen,
      searchQuery: document.searchQuery,
      searchOptions: document.searchOptions,
      searchTarget: document.searchTarget,
      selectedCharacterCount: document.selectedCharacterCount,
      selectedLineCount: document.selectedLineCount,
      saveRevision: persistence.persistedRevision,
      selectionActionPosition: document.selectionActionPosition,
      splitDividerDragging: document.splitDividerDragging,
      splitDividerMaxValue: document.splitDividerMaxValue,
      splitDividerMinValue: document.splitDividerMinValue,
      splitDividerValue: document.splitDividerValue,
      splitWorkspaceStyle: document.splitWorkspaceStyle,
      statusLabel: room.statusLabel,
      text: document.text,
      toolbarLabel,
      workspaceRef: document.workspaceRef,
      onBookmarksChange: editor.updateActiveFileBookmarks,
      onEditorHistoryStateChange: editor.handleEditorHistoryStateChange,
      onEditorScroll: () => {
        room.stopFollowingForLocalNavigation();
        document.handleEditorSurfaceScroll();
        room.publishCurrentRoomViewport();
      },
      onEditorScrollRatioChange: (ratio: number) => {
        room.stopFollowingForLocalNavigation();
        document.handleEditorScrollRatioChange(ratio);
        room.publishCurrentRoomViewport();
      },
      onEditorSelectionActionPositionChange:
        document.handleEditorSelectionActionPositionChange,
      onEditorSelectionChange: (selection: Parameters<DocumentRuntime["handleEditorSelectionChange"]>[0]) => {
        room.stopFollowingForLocalNavigation();
        document.handleEditorSelectionChange(selection);
      },
      onFormat: (command: Parameters<typeof documentWorkbenchController.onFormat>[0]) => {
        room.stopFollowing("local-edit");
        documentWorkbenchController.onFormat(command);
      },
      onLineAction: comments.handleLineAnnotationAction,
      onOpenComment: comments.openCommentMarker,
      onOpenSelectionComment: comments.openSelectionComment,
      onPreviewKeyUp: document.syncPreviewSelection,
      onPreviewMouseUp: document.syncPreviewSelection,
      onPreviewScroll: () => {
        room.stopFollowing("local-navigation");
        document.handlePreviewScroll();
      },
      onPreviewTouchEnd: document.syncPreviewSelection,
      onRedo: () => {
        room.stopFollowing("local-edit");
        editor.redoActiveFile();
      },
      onResetSplitRatio: document.resetSplitRatio,
      onPreviewSearchMatchCountChange: document.onPreviewSearchMatchCountChange,
      onSetReadingWidth: documentWorkbenchController.onSetReadingWidth,
      onSetViewMode: (viewMode: WorkspaceFile["viewMode"]) => {
        room.stopFollowing("local-navigation");
        onSetViewMode(viewMode);
      },
      onSplitDividerKeyDown: document.handleSplitDividerKeyDown,
      onSplitDividerPointerCancel: document.endSplitDividerDrag,
      onSplitDividerPointerDown: document.handleSplitDividerPointerDown,
      onSplitDividerPointerMove: document.handleSplitDividerPointerMove,
      onSplitDividerPointerUp: document.endSplitDividerDrag,
      onTextChange: (
        nextText: Parameters<ActiveFileEditor["handleTextChange"]>[0],
        change?: Parameters<ActiveFileEditor["handleTextChange"]>[1],
      ) => {
        room.stopFollowing("local-edit");
        if (editingActivationTrackerRef.current.recordEdit()) {
          productAnalytics.report("edited_30_seconds");
        }
        editor.handleTextChange(nextText, change);
      },
      onToggleLineNumbers: documentWorkbenchController.onToggleLineNumbers,
      onToggleSearch: () => {
        if (document.searchOpen) {
          document.setSearchOpen(false);
          return;
        }
        document.openSearchFromCurrentSelection();
      },
      onToggleLineWrapping: documentWorkbenchController.onToggleLineWrapping,
      onToggleSyncScrolling: documentWorkbenchController.onToggleSyncScrolling,
      onToggleViewOptions: documentWorkbenchController.onToggleViewOptions,
      onUndo: () => {
        room.stopFollowing("local-edit");
        editor.undoActiveFile();
      },
    },
  };
}
