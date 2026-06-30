import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EmptyFileState } from "./EmptyFileState";
import { DocumentWorkbench } from "./DocumentWorkbench";
import { WorkspaceMenuSurface } from "./WorkspaceMenuSurface";
import { WorkspaceOverlaySurface } from "./WorkspaceOverlaySurface";
import { WorkspaceProjectContext } from "./WorkspaceProjectContext";
import { WorkspaceTopChrome } from "./WorkspaceTopChrome";
import { buildDocumentSurface } from "../documentSurfaceModel";
import {
  getLineStartOffset,
  type MarkdownHeading,
} from "../markdown";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import type { MarkdownFormatCommand } from "../markdownFormatting";
import { getShortcutLabels } from "../keyboardShortcuts";
import { createHelpMarkdown } from "../helpMarkdown";
import { useActiveDocumentRuntime } from "../hooks/useActiveDocumentRuntime";
import { useAppToast } from "../hooks/useAppToast";
import { useEditorSearchController } from "../hooks/useEditorSearchController";
import { useEventCallback } from "../hooks/useEventCallback";
import { useFileComments } from "../hooks/useFileComments";
import { useWorkspaceFiles } from "../hooks/useWorkspaceFiles";
import { useWorkspaceIoRuntime } from "../hooks/useWorkspaceIoRuntime";
import { useWorkspacePersistenceRuntime } from "../hooks/useWorkspacePersistenceRuntime";
import { useSelectionCommentController } from "../hooks/useSelectionCommentController";
import { useSplitViewController } from "../hooks/useSplitViewController";
import { useWorkspaceActiveFileEditor } from "../hooks/useWorkspaceActiveFileEditor";
import { useWorkspaceChromeController } from "../hooks/useWorkspaceChromeController";
import { useWorkspaceCommentActions } from "../hooks/useWorkspaceCommentActions";
import { useWorkspaceFileActions } from "../hooks/useWorkspaceFileActions";
import { useWorkspaceIdentity } from "../hooks/useWorkspaceIdentity";
import { useWorkspaceKeyboardShortcuts } from "../hooks/useWorkspaceKeyboardShortcuts";
import { useWorkspacePreferences } from "../hooks/useWorkspacePreferences";
import { useWorkspaceRouteRuntime } from "../hooks/useWorkspaceRouteRuntime";
import { useWorkspaceScrollSync } from "../hooks/useWorkspaceScrollSync";
import { useWorkspaceShareRuntime } from "../hooks/useWorkspaceShareRuntime";
import { useWorkspaceCollaborationRuntime } from "../hooks/useWorkspaceCollaborationRuntime";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import { getWorkspaceFileStatus } from "../workspaceViewModel";
import {
  createWorkspaceFile,
  readInitialWorkspaceSnapshot,
  randomId,
  README_FILE_ID,
  type WorkspaceFile,
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
  const [rightFileQuery, setRightFileQuery] = useState("");
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
  const activeDocument = useActiveDocumentRuntime(activeFile);
  const text = activeDocument.text;
  const activeViewMode = activeDocument.viewMode;
  const activeSplitRatio = activeDocument.splitRatio;
  const activeLineWrapping = activeDocument.lineWrapping;
  const activeLineNumbers = activeDocument.lineNumbers;
  const activeBookmarks = activeDocument.bookmarks;
  const activeFileTitle = activeDocument.title;
  const parsedMarkdown = activeDocument.parsedMarkdown;
  const renderedPreview = activeDocument.renderedPreview;
  const previewBodyStartOffset = activeDocument.previewBodyStartOffset;
  const workspacePersistenceSnapshot = useMemo<WorkspaceState>(
    () => ({
      files,
      openFileIds,
      activeFileId,
      commentsByFileId,
    }),
    [activeFileId, commentsByFileId, files, openFileIds],
  );
  const {
    workspaceRef,
    editorSurfaceRef,
    previewSurfaceRef,
    setActiveFileViewMode,
    queueEditorFocus,
    queueEditorTextRange,
    handleEditorScrollRatioChange,
    handleEditorSurfaceScroll,
    handlePreviewScroll,
  } = useWorkspaceScrollSync({
    activeFileId: activeFile?.id,
    activeViewMode,
    editorRef,
    onSetActiveFileViewMode: setWorkspaceFileViewMode,
  });
  const {
    splitDividerDragging,
    splitDividerMinValue,
    splitDividerMaxValue,
    splitDividerValue,
    splitWorkspaceStyle,
    resetSplitRatio,
    handleSplitDividerKeyDown,
    handleSplitDividerPointerDown,
    handleSplitDividerPointerMove,
    endSplitDividerDrag,
  } = useSplitViewController({
    activeViewMode,
    activeSplitRatio,
    workspaceRef,
    editorSurfaceRef,
    onSetSplitRatio: commitActiveFileSplitRatio,
  });
  const focusTextRange = (start: number, end = start) => {
    if (activeViewMode === "preview") {
      setActiveFileViewMode("edit", {
        preserveScroll: false,
        focusEditor: false,
      });
    }

    queueEditorTextRange(start, end);
  };
  const {
    searchInputRef,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchMatches,
    activeSearchMatchIndex,
    goToSearchMatch,
  } = useEditorSearchController({
    activeFileId: activeFile?.id,
    editorRef,
    text,
    onFocusTextRange: focusTextRange,
  });
  const {
    activeSelection,
    selectedMarkdownText,
    selectedCharacterCount,
    selectedLineCount,
    cursorPositionLabel,
    selectionActionPosition,
    setActiveSelection,
    setSelectionActionPosition,
    suppressSelectionActionPositionRef,
    handleEditorSelectionChange,
    handleEditorSelectionActionPositionChange,
    clearPreviewSelection,
    syncPreviewSelection,
    getSelectedMarkdownExcerpt,
    getSelectedMarkdownAnchor,
  } = useSelectionCommentController({
    activeFileId: activeFile?.id,
    activeViewMode,
    editorRef,
    previewBodyStartOffset,
    previewSurfaceRef,
    text,
  });
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
  useEffect(() => {
    if (!isLive && rightPanelView === "comments") {
      setRightPanelView("files");
    }
  }, [isLive, rightPanelView, setRightPanelView]);

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
  const copied = copiedFileId === activeFile?.id;
  const shareOpen = topPopover === "share";
  const outlineHeadings = activeDocument.outlineHeadings;

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

  const goToOutlineHeading = (
    heading: MarkdownHeading,
    headingIndex: number,
  ) => {
    if (activeViewMode === "preview") {
      const renderedHeadings = Array.from(
        previewSurfaceRef.current?.querySelectorAll("h1, h2, h3") ?? [],
      ).filter((heading) => !heading.closest(".frontmatter-view"));
      const renderedHeading = renderedHeadings[headingIndex];
      renderedHeading?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }

    const bodyStartOffset = text.indexOf(parsedMarkdown.body);
    const targetOffset =
      (bodyStartOffset === -1 ? 0 : bodyStartOffset) +
      getLineStartOffset(parsedMarkdown.body, heading.sourceLineIndex);
    focusTextRange(
      targetOffset,
      targetOffset + heading.text.length + heading.depth + 1,
    );
  };

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
  const handleStableLineAnnotationAction = useEventCallback(
    handleLineAnnotationAction,
  );
  const openStableCommentMarker = useEventCallback(openCommentMarker);

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

  const getFileStatus = (file: WorkspaceFile) =>
    getWorkspaceFileStatus({
      file,
      activeFileId: activeFile?.id,
      activeConnectionStatus: connectionStatus,
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

  const formatMarkdown = (command: MarkdownFormatCommand) => {
    if (activeViewMode === "preview") {
      return;
    }

    setTopPopover(null);
    setCenterPopover(null);
    editorRef.current?.format(command);
  };

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
        <WorkspaceMenuSurface
          isOpen={workspaceMenuOpen}
          preferencesOpen={preferencesOpen}
          canExportCurrentFile={Boolean(activeFile)}
          theme={workspacePreferences.theme}
          language={workspacePreferences.language}
          importInputRef={importInputRef}
          workspaceImportInputRef={workspaceImportInputRef}
          onImportFileChange={handleImportInputChange}
          onImportProjectChange={handleProjectImportInputChange}
          onCloseChrome={closeFloatingChrome}
          onTogglePreferences={() => {
            setPreferencesOpen((isOpen) => !isOpen);
            setTopPopover(null);
          }}
          onChangeTheme={(theme) =>
            setWorkspacePreferences((currentPreferences) => ({
              ...currentPreferences,
              theme,
            }))
          }
          onChangeLanguage={(language) =>
            setWorkspacePreferences((currentPreferences) => ({
              ...currentPreferences,
              language,
            }))
          }
          onAddFile={addFile}
          onDownloadFile={downloadCurrentFile}
          onDownloadProject={downloadProject}
          onOpenCollaboration={() => openSharePanel("share-link")}
          onOpenAbout={openAboutFile}
          onOpenHelp={openHelpFile}
        />

        <section className={documentSurface.centerWorkbenchClassName}>
          <WorkspaceTopChrome
            activeFile={activeFile}
            activeFileTitle={activeFileTitle}
            activeText={text}
            canStartSession={canStartSession}
            collaborators={collaborators}
            copied={copied}
            currentUserName={identity.name}
            files={files}
            getFileStatus={getFileStatus}
            identity={presenceIdentity}
            isLive={isLive}
            jsonShare={jsonShare}
            language={workspacePreferences.language}
            openFiles={openFiles}
            rightPanelOpen={rightPanelOpen}
            shareOpen={shareOpen}
            sharePanelTarget={sharePanelTarget}
            startSessionUnavailableReason={startSessionUnavailableReason}
            workspaceMenuOpen={workspaceMenuOpen}
            onAddFile={addFile}
            onChangeUserName={updateIdentityName}
            onChromeInteraction={() => {
              setTopPopover(null);
              setCenterPopover(null);
            }}
            onCloseFile={closeFile}
            onCloseShare={() => {
              setTopPopover(null);
              setSharePanelTarget(undefined);
            }}
            onCommitUserName={normalizeIdentityName}
            onCopyFile={copyCurrentFile}
            onCopyShareUrl={copyShareUrl}
            onDownloadFile={downloadCurrentFile}
            onDownloadProjectArchive={downloadProjectArchive}
            onReorderFiles={reorderFiles}
            onRenameFile={renameWorkspaceFileAction}
            onSelectFile={selectFile}
            onStartSession={startSession}
            onStopSession={stopSession}
            onToggleWorkspaceMenu={toggleWorkspaceMenu}
            onToggleRightPanel={toggleRightPanel}
            onToggleShare={() => {
              setSharePanelTarget(undefined);
              setTopPopover(shareOpen ? null : "share");
              setCenterPopover(null);
              setWorkspaceMenuOpen(false);
              setPreferencesOpen(false);
            }}
          />

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
                onCloseSearch={() => setSearchOpen(false)}
                onCopyFile={copyCurrentFile}
                onEditorHistoryStateChange={handleEditorHistoryStateChange}
                onEditorScroll={handleEditorSurfaceScroll}
                onEditorScrollRatioChange={handleEditorScrollRatioChange}
                onEditorSelectionActionPositionChange={
                  handleEditorSelectionActionPositionChange
                }
                onEditorSelectionChange={handleEditorSelectionChange}
                onFormat={formatMarkdown}
                onGoToSearchMatch={goToSearchMatch}
                onLineAction={handleStableLineAnnotationAction}
                onOpenComment={openStableCommentMarker}
                onOpenComments={() =>
                  openCommentsPanel(focusedCommentId ?? activeOpenComments[0]?.id)
                }
                onOpenSelectionComment={openSelectionComment}
                onPreviewKeyUp={syncPreviewSelection}
                onPreviewMouseUp={syncPreviewSelection}
                onPreviewScroll={handlePreviewScroll}
                onPreviewTouchEnd={syncPreviewSelection}
                onRedo={redoActiveFile}
                onResetSplitRatio={resetSplitRatio}
                onSearchQueryChange={setSearchQuery}
                onSetReadingWidth={(nextReadingWidth) => {
                  setActiveFileReadingWidth(nextReadingWidth);
                  setCenterPopover(null);
                }}
                onSetViewMode={(nextViewMode) => {
                  setActiveFileViewMode(nextViewMode);
                  setCenterPopover(null);
                }}
                onSplitDividerKeyDown={handleSplitDividerKeyDown}
                onSplitDividerPointerCancel={endSplitDividerDrag}
                onSplitDividerPointerDown={handleSplitDividerPointerDown}
                onSplitDividerPointerMove={handleSplitDividerPointerMove}
                onSplitDividerPointerUp={endSplitDividerDrag}
                onTextChange={handleTextChange}
                onToggleLineNumbers={() => {
                  setActiveFileLineNumbers(!activeLineNumbers);
                  setCenterPopover(null);
                }}
                onToggleLineWrapping={() => {
                  setActiveFileLineWrapping(!activeLineWrapping);
                  setCenterPopover(null);
                }}
                onToggleSearch={() => {
                  setSearchOpen((current) => !current);
                  setCenterPopover(null);
                  setTopPopover(null);
                }}
                onToggleViewOptions={() => {
                  setCenterPopover((current) =>
                    current === "view" ? null : "view",
                  );
                  setTopPopover(null);
                }}
                onUndo={undoActiveFile}
              />
            ) : (
              <section
                className={`workspace empty-workspace ${emptyDropActive ? "drop-active" : ""}`}
                ref={workspaceRef}
                onDragOver={handleEmptyWorkspaceDragOver}
                onDragLeave={handleEmptyWorkspaceDragLeave}
                onDrop={handleEmptyWorkspaceDrop}
              >
                <EmptyFileState
                  language={workspacePreferences.language}
                  onNewFile={addFile}
                  onOpenFile={() => importInputRef.current?.click()}
                  onBrowseFiles={openFilesPanel}
                  onOpenHelp={openHelpFile}
                  primaryShortcutModifier={shortcutLabels.primary}
                  alternateShortcutModifier={shortcutLabels.alternate}
                />
              </section>
            )}
          </section>
        </section>

        <WorkspaceProjectContext
          isOpen={rightPanelOpen}
          view={rightPanelView}
          isLive={isLive}
          files={files}
          openFileIds={openFileIds}
          activeFileId={activeFile?.id}
          activeFileTitle={activeFileTitle}
          fileQuery={rightFileQuery}
          outlineHeadings={outlineHeadings}
          commentsByFileId={commentsByFileId}
          commentDraft={commentDraft}
          identityName={identity.name}
          selectedText={selectedMarkdownText}
          selectedCharacterCount={selectedCharacterCount}
          commentInputRef={commentInputRef}
          activeCommentId={focusedCommentId}
          activeReplyCommentId={activeReplyCommentId}
          replyDraftByCommentId={replyDraftByCommentId}
          getFileStatus={getFileStatus}
          onSetView={setRightPanelView}
          onClose={() => setRightPanelOpen(false)}
          onFileQueryChange={setRightFileQuery}
          onNewFile={addFile}
          onImportFile={() => importInputRef.current?.click()}
          onSelectFile={selectFile}
          onCloseFile={closeFile}
          onRenameFile={renameWorkspaceFileAction}
          onDuplicateFile={duplicateFile}
          onDeleteFile={deleteFile}
          onGoToOutlineHeading={goToOutlineHeading}
          onCommentDraftChange={setCommentDraft}
          onIdentityNameChange={updateIdentityName}
          onIdentityNameCommit={normalizeIdentityName}
          onAddComment={addFileComment}
          onGoToComment={goToFileComment}
          onStartCommentReply={startCommentReply}
          onCancelCommentReply={cancelCommentReply}
          onReplyDraftChange={updateCommentReplyDraft}
          onAddCommentReply={addFileCommentReply}
          onToggleCommentResolved={toggleFileCommentResolved}
          onDeleteComment={deleteFileComment}
          formatCommentDate={formatCommentDate}
        />
      </section>
    </main>
  );
}
