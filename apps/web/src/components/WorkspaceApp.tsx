import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DocumentWorkbench } from "./DocumentWorkbench";
import { WorkspaceEmptySurface } from "./WorkspaceEmptySurface";
import { WorkspaceMenuSurface } from "./WorkspaceMenuSurface";
import { WorkspaceOverlaySurface } from "./WorkspaceOverlaySurface";
import { WorkspaceProjectContext } from "./WorkspaceProjectContext";
import { WorkspaceTopChrome } from "./WorkspaceTopChrome";
import { buildDocumentSurface } from "../documentSurfaceModel";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import { getShortcutLabels } from "../keyboardShortcuts";
import { createHelpMarkdown } from "../helpMarkdown";
import { useAppToast } from "../hooks/useAppToast";
import { useDocumentWorkbenchRuntime } from "../hooks/useDocumentWorkbenchRuntime";
import { useEventCallback } from "../hooks/useEventCallback";
import { useFileComments } from "../hooks/useFileComments";
import { useWorkspaceDocumentRuntime } from "../hooks/useWorkspaceDocumentRuntime";
import { useWorkspaceFiles } from "../hooks/useWorkspaceFiles";
import { useWorkspaceIoRuntime } from "../hooks/useWorkspaceIoRuntime";
import { useWorkspacePersistenceRuntime } from "../hooks/useWorkspacePersistenceRuntime";
import { useWorkspaceActiveFileEditor } from "../hooks/useWorkspaceActiveFileEditor";
import { useWorkspaceChromeController } from "../hooks/useWorkspaceChromeController";
import { useWorkspaceCommentActions } from "../hooks/useWorkspaceCommentActions";
import { useWorkspaceFileActions } from "../hooks/useWorkspaceFileActions";
import { useWorkspaceIdentity } from "../hooks/useWorkspaceIdentity";
import { useWorkspaceKeyboardShortcuts } from "../hooks/useWorkspaceKeyboardShortcuts";
import { useWorkspaceMenuRuntime } from "../hooks/useWorkspaceMenuRuntime";
import { useWorkspacePreferences } from "../hooks/useWorkspacePreferences";
import { useWorkspaceProjectContextRuntime } from "../hooks/useWorkspaceProjectContextRuntime";
import { useWorkspaceRouteRuntime } from "../hooks/useWorkspaceRouteRuntime";
import { useWorkspaceShareRuntime } from "../hooks/useWorkspaceShareRuntime";
import { useWorkspaceCollaborationRuntime } from "../hooks/useWorkspaceCollaborationRuntime";
import { useWorkspaceTopChromeRuntime } from "../hooks/useWorkspaceTopChromeRuntime";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import {
  createWorkspaceFile,
  readInitialWorkspaceSnapshot,
  randomId,
  README_FILE_ID,
  type WorkspaceState,
} from "../workspaceStorage";

export function WorkspaceApp() {
  const [initialWorkspaceSnapshot] = useState(() =>
    readInitialWorkspaceSnapshot(),
  );
  const initialWorkspace = initialWorkspaceSnapshot.workspace;
  const {
    files,
    openFiles,
    openFileIds,
    activeFileId,
    activeFile,
    selectFile: selectWorkspaceFileAction,
    addFile: addWorkspaceFileAction,
    addFileFromContent,
    activateRoomFile,
    duplicateFile: duplicateWorkspaceFile,
    renameFile,
    closeFile: closeWorkspaceFileAction,
    deleteFile: deleteWorkspaceFileAction,
    replaceWorkspace,
    restoreFile,
    upsertHelpFile,
    reorderFiles,
    selectAdjacentFile: selectAdjacentWorkspaceFileAction,
    setActiveFileBookmarks,
    setActiveFileText,
    setActiveFileViewMode: setWorkspaceFileViewMode,
    setActiveFileReadingWidth,
    setActiveFileLineWrapping,
    setActiveFileLineNumbers,
    commitActiveFileSplitRatio,
    setFileText,
    setFileCollaborationStatus,
    setFileCollaboratorCount,
    setFileRoomMeta,
    setFileRecoveryEvent,
    startFileCollaborationSession,
    stopFileCollaborationSession,
  } = useWorkspaceFiles({
    initialFiles: initialWorkspace.files,
    initialOpenFileIds: initialWorkspace.openFileIds,
    initialActiveFileId: initialWorkspace.activeFileId,
    readmeFileId: README_FILE_ID,
    createFile: createWorkspaceFile,
  });
  const [workspacePreferences, setWorkspacePreferences] =
    useWorkspacePreferences();
  const workspaceChromeCopy = getWorkspaceChromeCopy(
    workspacePreferences.language,
  );
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement | null>(null);
  const [shortcutLabels] = useState(() => getShortcutLabels());
  const { toast, showToast } = useAppToast();
  const { identity, updateIdentityName, normalizeIdentityName } =
    useWorkspaceIdentity();
  const {
    commentsByFileId,
    commentDraft,
    activeReplyCommentId,
    replyDraftByCommentId,
    focusedCommentId,
    activeFileComments,
    activeOpenComments,
    setCommentDraft,
    setFocusedCommentId,
    replaceCommentsByFileId,
    addFileComment: createFileComment,
    deleteFileComment,
    toggleFileCommentResolved,
    startCommentReply: beginCommentReply,
    cancelCommentReply,
    updateCommentReplyDraft,
    addFileCommentReply,
  } = useFileComments({
    initialCommentsByFileId: initialWorkspace.commentsByFileId,
    activeFileId: activeFile?.id ?? "",
    files,
    identity,
    createId: randomId,
  });
  const {
    activeDocument,
    activeBookmarks,
    activeFileTitle,
    activeLineNumbers,
    activeLineWrapping,
    activeSearchMatchIndex,
    activeSelection,
    activeViewMode,
    clearPreviewSelection,
    cursorPositionLabel,
    editorSurfaceRef,
    endSplitDividerDrag,
    focusTextRange,
    getSelectedMarkdownAnchor,
    getSelectedMarkdownExcerpt,
    goToSearchMatch,
    handleEditorScrollRatioChange,
    handleEditorSelectionActionPositionChange,
    handleEditorSelectionChange,
    handleEditorSurfaceScroll,
    handlePreviewScroll,
    handleSplitDividerKeyDown,
    handleSplitDividerPointerDown,
    handleSplitDividerPointerMove,
    outlineHeadings,
    parsedMarkdown,
    previewBodyStartOffset,
    previewSurfaceRef,
    queueEditorFocus,
    queueEditorTextRange,
    renderedPreview,
    searchInputRef,
    searchMatches,
    searchOpen,
    searchQuery,
    selectedCharacterCount,
    selectedLineCount,
    selectedMarkdownText,
    selectionActionPosition,
    setActiveFileViewMode,
    setActiveSelection,
    setSearchOpen,
    setSearchQuery,
    setSelectionActionPosition,
    splitDividerDragging,
    splitDividerMaxValue,
    splitDividerMinValue,
    splitDividerValue,
    splitWorkspaceStyle,
    suppressSelectionActionPositionRef,
    syncPreviewSelection,
    text,
    workspaceRef,
    resetSplitRatio,
  } = useWorkspaceDocumentRuntime({
    activeFile,
    editorRef,
    onCommitActiveFileSplitRatio: commitActiveFileSplitRatio,
    onSetWorkspaceFileViewMode: setWorkspaceFileViewMode,
  });
  const workspacePersistenceSnapshot = useMemo<WorkspaceState>(
    () => ({
      files,
      openFileIds,
      activeFileId,
      commentsByFileId,
    }),
    [activeFileId, commentsByFileId, files, openFileIds],
  );
  useWorkspacePersistenceRuntime({
    enabled: initialWorkspaceSnapshot.source === "starter",
    initialWorkspace,
    workspace: workspacePersistenceSnapshot,
    replaceCommentsByFileId,
    replaceWorkspace,
  });
  const {
    topPopover,
    setTopPopover,
    centerPopover,
    setCenterPopover,
    workspaceMenuOpen,
    setWorkspaceMenuOpen,
    preferencesOpen,
    setPreferencesOpen,
    sharePanelTarget,
    setSharePanelTarget,
    rightPanelOpen,
    setRightPanelOpen,
    rightPanelView,
    setRightPanelView,
    closeFloatingChrome,
    openFilesPanel,
    openSharePanel,
    toggleWorkspaceMenu,
    toggleRightPanel,
  } = useWorkspaceChromeController({
    hasActiveFile: Boolean(activeFile),
    selectionActionPosition,
    setCopiedFileId,
    setSelectionActionPosition,
  });
  const {
    canStartSession,
    collaborators,
    connectionStatus,
    isLive,
    presenceIdentity,
    startSessionUnavailableReason,
    statusLabel,
    startSession: startCollaborationSession,
    applyLocalText,
    resetCollaborationState,
  } = useWorkspaceCollaborationRuntime({
    activeFile: activeFile,
    activeFileTitle,
    activeSelection,
    editorRef,
    identity,
    setFileText,
    setFileCollaborationStatus,
    setFileCollaboratorCount,
    setFileRoomMeta,
    setFileRecoveryEvent,
    startFileCollaborationSession,
  });
  const {
    canRedo,
    canUndo,
    clearFileHistory,
    editorHistoryState,
    handleEditorHistoryStateChange,
    handleTextChange,
    historyByFileId,
    redoActiveFile,
    setHistoryByFileId,
    undoActiveFile,
    updateActiveFileBookmarks,
  } = useWorkspaceActiveFileEditor({
    activeFile,
    applyLocalText,
    editorRef,
    setActiveFileBookmarks,
    setActiveFileText,
  });

  const { copyShareUrl, jsonShare, startSession, stopSession } =
    useWorkspaceShareRuntime({
      activeFile,
      commentsByFileId,
      resetCollaborationState,
      setCenterPopover,
      setCopiedFileId,
      showToast,
      startCollaborationSession,
      stopFileCollaborationSession,
    });

  const handleRouteWorkspaceChange = useEventCallback(() => {
    setTopPopover(null);
    setCenterPopover(null);
    setCopiedFileId(null);
  });
  useWorkspaceRouteRuntime({
    activeFile,
    activeFileId,
    activateRoomFile,
    files,
    selectFile: selectWorkspaceFileAction,
    onRouteWorkspaceChange: handleRouteWorkspaceChange,
  });

  useEffect(() => {
    if (!selectionActionPosition) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          ".selection-comment-popover, .cm-annotationGutter, .cm-comment-mark, .preview-comment-mark",
        )
      ) {
        return;
      }

      setSelectionActionPosition(null);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [selectionActionPosition]);

  const {
    closeJsonShareImport,
    copyCurrentFile,
    downloadCurrentFile,
    downloadProject,
    downloadProjectArchive,
    emptyDropActive,
    handleEmptyWorkspaceDragLeave,
    handleEmptyWorkspaceDragOver,
    handleEmptyWorkspaceDrop,
    handleImportInputChange,
    handleProjectImportInputChange,
    jsonShareImport,
    replaceWorkspaceWithJsonShare,
  } = useWorkspaceIoRuntime({
    activeFile,
    activeFileId,
    addFileFromContent,
    clearFileHistory,
    closeFloatingChrome,
    commentsByFileId,
    editorRef,
    files,
    openFileIds,
    preferences: workspacePreferences,
    replaceCommentsByFileId,
    replaceWorkspace,
    resetCollaborationState,
    showToast,
    workspaceSource: initialWorkspaceSnapshot.source,
  });

  const {
    selectFile,
    addFile,
    openAboutFile,
    openHelpFile,
    renameWorkspaceFileAction,
    duplicateFile,
    deleteFile,
    closeFile,
    selectAdjacentFile,
  } = useWorkspaceFileActions({
    activeFile,
    activeFileId,
    addFileFromContent,
    addWorkspaceFileAction,
    closeFloatingChrome,
    closeWorkspaceFileAction,
    commentsByFileId,
    deleteWorkspaceFileAction,
    duplicateWorkspaceFile,
    files,
    helpMarkdown: createHelpMarkdown(shortcutLabels),
    historyByFileId,
    openFileIds,
    preferences: workspacePreferences,
    queueEditorFocus,
    renameFile,
    replaceCommentsByFileId,
    resetCollaborationState,
    restoreFile,
    selectAdjacentWorkspaceFileAction,
    selectWorkspaceFileAction,
    setHistoryByFileId,
    showToast,
    upsertHelpFile,
  });
  const {
    activeCommentAnchors,
    activePreviewCommentAnchors,
    activePreviewLineAnnotations,
    addFileComment,
    formatCommentDate,
    goToFileComment,
    handleLineAnnotationAction,
    openCommentMarker,
    openCommentsPanel,
    openSelectionComment,
    startCommentReply,
  } = useWorkspaceCommentActions({
    activeBookmarks,
    activeFile,
    activeFileComments,
    activeOpenComments,
    activeViewMode,
    clearPreviewSelection,
    commentDraft,
    commentsEnabled: isLive,
    commentInputRef,
    createFileComment,
    createId: randomId,
    editorRef,
    files,
    focusedCommentId,
    getSelectedMarkdownAnchor,
    getSelectedMarkdownExcerpt,
    previewBody: renderedPreview.body,
    previewBodyStartOffset,
    previewSurfaceRef,
    selectFile,
    selectedCharacterCount,
    setActiveFileBookmarks,
    setActiveFileViewMode,
    setActiveSelection,
    setCenterPopover,
    setFocusedCommentId,
    setRightPanelOpen,
    setRightPanelView,
    setSelectionActionPosition,
    setTopPopover,
    showToast,
    startCommentReply: beginCommentReply,
    suppressSelectionActionPositionRef,
    queueEditorTextRange,
    text,
  });

  const { menuSurfaceProps } = useWorkspaceMenuRuntime({
    activeFile,
    importInputRef,
    isOpen: workspaceMenuOpen,
    onAddFile: addFile,
    onCloseChrome: closeFloatingChrome,
    onDownloadFile: downloadCurrentFile,
    onDownloadProject: downloadProject,
    onImportFileChange: handleImportInputChange,
    onImportProjectChange: handleProjectImportInputChange,
    onOpenAbout: openAboutFile,
    onOpenHelp: openHelpFile,
    openSharePanel,
    preferences: workspacePreferences,
    preferencesOpen,
    setPreferences: setWorkspacePreferences,
    setPreferencesOpen,
    setTopPopover,
    workspaceImportInputRef,
  });
  const handleStableLineAnnotationAction = useEventCallback(
    handleLineAnnotationAction,
  );
  const openStableCommentMarker = useEventCallback(openCommentMarker);

  const { getFileStatus, projectContextProps } =
    useWorkspaceProjectContextRuntime({
      activeCommentId: focusedCommentId,
      activeFile,
      activeFileTitle,
      activeReplyCommentId,
      activeViewMode,
      commentDraft,
      commentInputRef,
      commentsByFileId,
      connectionStatus,
      files,
      focusTextRange,
      formatCommentDate,
      identityName: identity.name,
      isLive,
      onAddComment: addFileComment,
      onAddCommentReply: addFileCommentReply,
      onCancelCommentReply: cancelCommentReply,
      onCloseFile: closeFile,
      onCommentDraftChange: setCommentDraft,
      onDeleteComment: deleteFileComment,
      onDeleteFile: deleteFile,
      onDuplicateFile: duplicateFile,
      onGoToComment: goToFileComment,
      onIdentityNameChange: updateIdentityName,
      onIdentityNameCommit: normalizeIdentityName,
      onImportFile: () => importInputRef.current?.click(),
      onNewFile: addFile,
      onRenameFile: renameWorkspaceFileAction,
      onReplyDraftChange: updateCommentReplyDraft,
      onSelectFile: selectFile,
      onStartCommentReply: startCommentReply,
      onToggleCommentResolved: toggleFileCommentResolved,
      openFileIds,
      outlineHeadings,
      parsedMarkdownBody: parsedMarkdown.body,
      previewSurfaceRef,
      replyDraftByCommentId,
      rightPanelOpen,
      rightPanelView,
      selectedCharacterCount,
      selectedText: selectedMarkdownText,
      setRightPanelOpen,
      setRightPanelView,
      text,
    });

  const { shareOpen, topChromeProps } = useWorkspaceTopChromeRuntime({
    activeFile,
    activeFileTitle,
    activeText: text,
    canStartSession,
    collaborators,
    copiedFileId,
    currentUserName: identity.name,
    files,
    getFileStatus,
    identity: presenceIdentity,
    isLive,
    jsonShare,
    language: workspacePreferences.language,
    openFiles,
    rightPanelOpen,
    sharePanelTarget,
    startSessionUnavailableReason,
    topPopover,
    workspaceMenuOpen,
    onAddFile: addFile,
    onChangeUserName: updateIdentityName,
    onCloseFile: closeFile,
    onCommitUserName: normalizeIdentityName,
    onCopyFile: copyCurrentFile,
    onCopyShareUrl: copyShareUrl,
    onDownloadFile: downloadCurrentFile,
    onDownloadProjectArchive: downloadProjectArchive,
    onReorderFiles: reorderFiles,
    onRenameFile: renameWorkspaceFileAction,
    onSelectFile: selectFile,
    onStartSession: startSession,
    onStopSession: stopSession,
    onToggleRightPanel: toggleRightPanel,
    onToggleWorkspaceMenu: toggleWorkspaceMenu,
    setCenterPopover,
    setPreferencesOpen,
    setSharePanelTarget,
    setTopPopover,
    setWorkspaceMenuOpen,
  });

  useWorkspaceKeyboardShortcuts({
    importInputRef,
    addFile,
    closeFloatingChrome,
    openFilesPanel,
    openHelpFile,
    selectAdjacentFile,
    setActiveFileViewMode,
    setCenterPopover,
  });

  const documentSurface = buildDocumentSurface({
    document: activeDocument,
    hasSelectionActionPosition: Boolean(selectionActionPosition),
    isLive,
    openCommentCount: activeOpenComments.length,
    searchOpen,
    selectedCharacterCount,
    shareOpen,
    splitDividerDragging,
  });

  const documentWorkbenchRuntime = useDocumentWorkbenchRuntime({
    activeLineNumbers,
    activeLineWrapping,
    activeOpenComments,
    activeViewMode,
    editorRef,
    focusedCommentId,
    onOpenCommentsPanel: openCommentsPanel,
    onSetActiveFileLineNumbers: setActiveFileLineNumbers,
    onSetActiveFileLineWrapping: setActiveFileLineWrapping,
    onSetActiveFileReadingWidth: setActiveFileReadingWidth,
    onSetActiveFileViewMode: setActiveFileViewMode,
    setCenterPopover,
    setSearchOpen,
    setTopPopover,
  });

  return (
    <main className="app-shell">
      <WorkspaceOverlaySurface
        jsonShareImport={jsonShareImport}
        toast={toast}
        onCloseJsonShareImport={closeJsonShareImport}
        onReplaceWorkspaceWithJsonShare={replaceWorkspaceWithJsonShare}
      />
      <section
        className={`main-panel ${rightPanelOpen ? "right-panel-open" : ""}`}
      >
        <WorkspaceMenuSurface {...menuSurfaceProps} />

        <section className={documentSurface.centerWorkbenchClassName}>
          <WorkspaceTopChrome {...topChromeProps} />

          <section className={documentSurface.fileShellClassName}>
            {activeFile ? (
              <DocumentWorkbench
                activeBookmarks={activeBookmarks}
                activeCommentAnchors={activeCommentAnchors}
                activeFile={activeFile}
                activeFileTitle={activeFileTitle}
                activeLineNumbers={activeLineNumbers}
                activeLineWrapping={activeLineWrapping}
                activePreviewCommentAnchors={activePreviewCommentAnchors}
                activePreviewLineAnnotations={activePreviewLineAnnotations}
                activeSearchMatchIndex={activeSearchMatchIndex}
                canRedo={canRedo}
                canUndo={canUndo}
                centerPopover={centerPopover}
                collaborators={collaborators}
                cursorPositionLabel={cursorPositionLabel}
                documentSurface={documentSurface}
                editorHistoryCanRedo={editorHistoryState.canRedo}
                editorHistoryCanUndo={editorHistoryState.canUndo}
                editorRef={editorRef}
                editorSurfaceRef={editorSurfaceRef}
                focusedCommentId={focusedCommentId}
                isLive={isLive}
                language={workspacePreferences.language}
                previewBody={renderedPreview.body}
                previewMetadata={parsedMarkdown.attributes}
                previewSurfaceRef={previewSurfaceRef}
                searchInputRef={searchInputRef}
                searchMatches={searchMatches}
                searchOpen={searchOpen}
                searchQuery={searchQuery}
                selectedCharacterCount={selectedCharacterCount}
                selectedLineCount={selectedLineCount}
                selectionActionPosition={selectionActionPosition}
                splitDividerDragging={splitDividerDragging}
                splitDividerMaxValue={splitDividerMaxValue}
                splitDividerMinValue={splitDividerMinValue}
                splitDividerValue={splitDividerValue}
                splitWorkspaceStyle={splitWorkspaceStyle}
                statusLabel={statusLabel}
                text={text}
                toolbarLabel={workspaceChromeCopy.documentControls.documentToolbar}
                workspaceRef={workspaceRef}
                onBookmarksChange={updateActiveFileBookmarks}
                onCloseSearch={documentWorkbenchRuntime.onCloseSearch}
                onCopyFile={copyCurrentFile}
                onEditorHistoryStateChange={handleEditorHistoryStateChange}
                onEditorScroll={handleEditorSurfaceScroll}
                onEditorScrollRatioChange={handleEditorScrollRatioChange}
                onEditorSelectionActionPositionChange={
                  handleEditorSelectionActionPositionChange
                }
                onEditorSelectionChange={handleEditorSelectionChange}
                onFormat={documentWorkbenchRuntime.onFormat}
                onGoToSearchMatch={goToSearchMatch}
                onLineAction={handleStableLineAnnotationAction}
                onOpenComment={openStableCommentMarker}
                onOpenComments={documentWorkbenchRuntime.onOpenComments}
                onOpenSelectionComment={openSelectionComment}
                onPreviewKeyUp={syncPreviewSelection}
                onPreviewMouseUp={syncPreviewSelection}
                onPreviewScroll={handlePreviewScroll}
                onPreviewTouchEnd={syncPreviewSelection}
                onRedo={redoActiveFile}
                onResetSplitRatio={resetSplitRatio}
                onSearchQueryChange={setSearchQuery}
                onSetReadingWidth={documentWorkbenchRuntime.onSetReadingWidth}
                onSetViewMode={documentWorkbenchRuntime.onSetViewMode}
                onSplitDividerKeyDown={handleSplitDividerKeyDown}
                onSplitDividerPointerCancel={endSplitDividerDrag}
                onSplitDividerPointerDown={handleSplitDividerPointerDown}
                onSplitDividerPointerMove={handleSplitDividerPointerMove}
                onSplitDividerPointerUp={endSplitDividerDrag}
                onTextChange={handleTextChange}
                onToggleLineNumbers={documentWorkbenchRuntime.onToggleLineNumbers}
                onToggleLineWrapping={documentWorkbenchRuntime.onToggleLineWrapping}
                onToggleSearch={documentWorkbenchRuntime.onToggleSearch}
                onToggleViewOptions={documentWorkbenchRuntime.onToggleViewOptions}
                onUndo={undoActiveFile}
              />
            ) : (
              <WorkspaceEmptySurface
                alternateShortcutModifier={shortcutLabels.alternate}
                dropActive={emptyDropActive}
                language={workspacePreferences.language}
                primaryShortcutModifier={shortcutLabels.primary}
                workspaceRef={workspaceRef}
                onBrowseFiles={openFilesPanel}
                onDragLeave={handleEmptyWorkspaceDragLeave}
                onDragOver={handleEmptyWorkspaceDragOver}
                onDrop={handleEmptyWorkspaceDrop}
                onNewFile={addFile}
                onOpenFile={() => importInputRef.current?.click()}
                onOpenHelp={openHelpFile}
              />
            )}
          </section>
        </section>

        <WorkspaceProjectContext {...projectContextProps} />
      </section>
    </main>
  );
}
