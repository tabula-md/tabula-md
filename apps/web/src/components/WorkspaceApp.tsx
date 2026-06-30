import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MessageSquarePlus } from "lucide-react";
import { AppToast } from "./AppToast";
import { EmptyFileState } from "./EmptyFileState";
import { FileTabs } from "./FileTabs";
import { DocumentSearchBar, DocumentControls } from "./DocumentControls";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownSelectionActionPosition,
} from "./MarkdownEditor";
import { FormattingToolbar } from "./FormattingToolbar";
import { MarkdownPreview } from "./MarkdownPreview";
import { RightPanel } from "./RightPanel";
import { ShareControls } from "./ShareControls";
import { StatusBar } from "./StatusBar";
import { TopChrome } from "./TopChrome";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { JsonShareImportDialog } from "./JsonShareImportDialog";
import { buildDocumentSurface } from "../documentSurfaceModel";
import {
  getLineStartOffset,
  type MarkdownHeading,
} from "../markdown";
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
import {
  getWorkspaceFileSearchText,
  getWorkspaceFileStatus,
} from "../workspaceViewModel";
import {
  createWorkspaceFile,
  readInitialWorkspaceSnapshot,
  randomId,
  README_FILE_ID,
  type WorkspaceFile,
  type WorkspaceState,
} from "../workspaceStorage";

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
  const showFormattingToolbar = documentSurface.showFormattingToolbar;

  const fileTabsNode = (
    <FileTabs
      files={openFiles}
      activeFile={activeFile}
      activeCollaboratorCount={collaborators.length}
      getFileStatus={getFileStatus}
      onAddFile={addFile}
      onSelectFile={selectFile}
      onRenameFile={renameWorkspaceFileAction}
      onCloseFile={closeFile}
      onReorderFiles={reorderFiles}
      onChromeInteraction={() => {
        setTopPopover(null);
        setCenterPopover(null);
      }}
    />
  );

  const shareControlsNode = activeFile ? (
    <ShareControls
      activeFile={activeFile}
      files={files}
      activeFileTitle={activeFileTitle}
      language={workspacePreferences.language}
      currentUserName={identity.name}
      canStartSession={canStartSession}
      isLive={isLive}
      shareOpen={shareOpen}
      sharePanelTarget={sharePanelTarget}
      copied={copied}
      jsonShare={jsonShare}
      startSessionUnavailableReason={startSessionUnavailableReason}
      onToggleShare={() => {
        setSharePanelTarget(undefined);
        setTopPopover(shareOpen ? null : "share");
        setCenterPopover(null);
        setWorkspaceMenuOpen(false);
        setPreferencesOpen(false);
      }}
      onCloseShare={() => {
        setTopPopover(null);
        setSharePanelTarget(undefined);
      }}
      onStartSession={startSession}
      onCopyShareUrl={copyShareUrl}
      onCopyFile={copyCurrentFile}
      onDownloadFile={downloadCurrentFile}
      onDownloadProjectArchive={downloadProjectArchive}
      onChangeUserName={updateIdentityName}
      onCommitUserName={normalizeIdentityName}
      onStopSession={stopSession}
    />
  ) : null;

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
      {toast && (
        <AppToast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      )}
      {jsonShareImport && (
        <JsonShareImportDialog
          status={jsonShareImport.status}
          fileCount={
            jsonShareImport.status === "ready"
              ? jsonShareImport.workspace.files.length
              : undefined
          }
          errorMessage={
            jsonShareImport.status === "error"
              ? jsonShareImport.errorMessage
              : undefined
          }
          onCancel={closeJsonShareImport}
          onReplace={() => {
            if (jsonShareImport.status === "ready") {
              replaceWorkspaceWithJsonShare(jsonShareImport.workspace);
            }
          }}
        />
      )}
      <input
        ref={importInputRef}
        className="workspace-file-input"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={handleImportInputChange}
        aria-label="Import file"
      />
      <input
        ref={workspaceImportInputRef}
        className="workspace-file-input"
        type="file"
        accept=".json,application/json"
        onChange={handleProjectImportInputChange}
        aria-label="Import project file"
      />
      <section
        className={`main-panel ${rightPanelOpen ? "right-panel-open" : ""}`}
      >
        <WorkspaceMenu
          isOpen={workspaceMenuOpen}
          preferencesOpen={preferencesOpen}
          canExportCurrentFile={Boolean(activeFile)}
          theme={workspacePreferences.theme}
          language={workspacePreferences.language}
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
          onOpenFile={() => {
            closeFloatingChrome();
            importInputRef.current?.click();
          }}
          onImportProject={() => {
            closeFloatingChrome();
            workspaceImportInputRef.current?.click();
          }}
          onDownloadFile={() => {
            downloadCurrentFile();
            closeFloatingChrome();
          }}
          onDownloadProject={() => {
            downloadProject();
            closeFloatingChrome();
          }}
          onOpenCollaboration={() => openSharePanel("share-link")}
          onOpenAbout={openAboutFile}
          onOpenHelp={openHelpFile}
        />

        <section className={documentSurface.centerWorkbenchClassName}>
          <TopChrome
            workspaceMenuOpen={workspaceMenuOpen}
            rightPanelOpen={rightPanelOpen}
            isLive={isLive}
            language={workspacePreferences.language}
            identity={presenceIdentity}
            collaborators={collaborators}
            activeText={text}
            fileTabs={fileTabsNode}
            shareControls={shareControlsNode}
            onToggleWorkspaceMenu={toggleWorkspaceMenu}
            onToggleRightPanel={toggleRightPanel}
          />

          <section className={documentSurface.fileShellClassName}>
            {activeFile ? (
              <>
                <section
                  className={documentSurface.documentToolbarClassName}
                  aria-label={workspaceChromeCopy.documentControls.documentToolbar}
                >
                  {showFormattingToolbar && (
                    <FormattingToolbar
                      className={documentSurface.formattingToolbarClassName}
                      canUndo={canUndo || editorHistoryState.canUndo}
                      canRedo={canRedo || editorHistoryState.canRedo}
                      onFormat={formatMarkdown}
                      onUndo={undoActiveFile}
                      onRedo={redoActiveFile}
                    />
                  )}

                  <DocumentControls
                    activeViewMode={documentSurface.documentControls.activeViewMode}
                    activeReadingWidth={documentSurface.documentControls.activeReadingWidth}
                    activeLineWrapping={documentSurface.documentControls.activeLineWrapping}
                    activeLineNumbers={documentSurface.documentControls.activeLineNumbers}
                    canCopyFile={documentSurface.documentControls.canCopyFile}
                    centerPopover={centerPopover}
                    language={workspacePreferences.language}
                    searchOpen={searchOpen}
                    onCopyFile={copyCurrentFile}
                    onSetViewMode={(nextViewMode) => {
                      setActiveFileViewMode(nextViewMode);
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
                    onSetReadingWidth={(nextReadingWidth) => {
                      setActiveFileReadingWidth(nextReadingWidth);
                      setCenterPopover(null);
                    }}
                    onToggleLineWrapping={() => {
                      setActiveFileLineWrapping(!activeLineWrapping);
                      setCenterPopover(null);
                    }}
                    onToggleLineNumbers={() => {
                      setActiveFileLineNumbers(!activeLineNumbers);
                      setCenterPopover(null);
                    }}
                  />
                </section>

                {searchOpen && (
                  <DocumentSearchBar
                    searchInputRef={searchInputRef}
                    searchQuery={searchQuery}
                    searchMatches={searchMatches}
                    activeSearchMatchIndex={activeSearchMatchIndex}
                    language={workspacePreferences.language}
                    onSearchQueryChange={setSearchQuery}
                    onGoToSearchMatch={goToSearchMatch}
                    onCloseSearch={() => setSearchOpen(false)}
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
                    onScroll={handleEditorSurfaceScroll}
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
                      activeSearchMatchIndex={
                        searchOpen ? activeSearchMatchIndex : -1
                      }
                      onChange={handleTextChange}
                      onBookmarksChange={updateActiveFileBookmarks}
                      onHistoryStateChange={handleEditorHistoryStateChange}
                      onOpenLineActions={handleStableLineAnnotationAction}
                      onOpenComment={openStableCommentMarker}
                      onSelectionChange={handleEditorSelectionChange}
                      onSelectionActionPositionChange={
                        handleEditorSelectionActionPositionChange
                      }
                      onScrollRatioChange={handleEditorScrollRatioChange}
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
                      onDoubleClick={resetSplitRatio}
                      onKeyDown={handleSplitDividerKeyDown}
                      onPointerCancel={endSplitDividerDrag}
                      onPointerDown={handleSplitDividerPointerDown}
                      onPointerMove={handleSplitDividerPointerMove}
                      onPointerUp={endSplitDividerDrag}
                    />
                  )}

                  <article
                    className="preview-surface"
                    ref={previewSurfaceRef}
                    onKeyUp={syncPreviewSelection}
                    onMouseUp={syncPreviewSelection}
                    onScroll={handlePreviewScroll}
                    onTouchEnd={syncPreviewSelection}
                  >
                    <MarkdownPreview
                      metadata={parsedMarkdown.attributes}
                      body={renderedPreview.body}
                      commentAnchors={isLive ? activePreviewCommentAnchors : []}
                      lineAnnotations={activePreviewLineAnnotations}
                      activeCommentId={focusedCommentId}
                      commentsEnabled={isLive}
                      suspendLineMeasurement={splitDividerDragging}
                      onLineAction={handleStableLineAnnotationAction}
                      onOpenComment={openStableCommentMarker}
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
                      onClick={openSelectionComment}
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
                  language={workspacePreferences.language}
                  statusLabel={statusLabel}
                  wordCount={documentSurface.statusBar.wordCount}
                  commentCount={documentSurface.statusBar.commentCount}
                  cursorPositionLabel={cursorPositionLabel}
                  selectedCharacterCount={selectedCharacterCount}
                  selectedLineCount={selectedLineCount}
                  onOpenComments={() =>
                    openCommentsPanel(
                      focusedCommentId ?? activeOpenComments[0]?.id,
                    )
                  }
                />
              </>
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

        {rightPanelOpen && (
          <RightPanel
            isOpen={rightPanelOpen}
            view={rightPanelView}
            commentsEnabled={isLive}
            files={files}
            openFileIds={openFileIds}
            activeFileId={activeFile?.id ?? ""}
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
            getFileSearchText={getWorkspaceFileSearchText}
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
        )}
      </section>
    </main>
  );
}
