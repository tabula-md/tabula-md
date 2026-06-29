import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MessageSquarePlus } from "lucide-react";
import { AppToast } from "./components/AppToast";
import { EmptyFileState } from "./components/EmptyFileState";
import { FileTabs } from "./components/FileTabs";
import { FileSearchBar, FileToolbar } from "./components/FileToolbar";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownSelectionActionPosition,
} from "./components/MarkdownEditor";
import { MarkdownFormattingToolbar } from "./components/MarkdownFormattingToolbar";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { RightPanel } from "./components/RightPanel";
import { ShareControls } from "./components/ShareControls";
import { StatusBar } from "./components/StatusBar";
import { TopChrome } from "./components/TopChrome";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { JsonShareImportDialog } from "./components/JsonShareImportDialog";
import { PublishedSnapshotRoute } from "./components/PublishedSnapshotRoute";
import { getPublishRoute } from "./publish";
import {
  getLineStartOffset,
  getOutlineHeadings,
  getPreviewBody,
  parseFrontmatter,
  type MarkdownHeading,
} from "./markdown";
import type { MarkdownFormatCommand } from "./markdownFormatting";
import { getShortcutLabels } from "./keyboardShortcuts";
import { createHelpMarkdown } from "./helpMarkdown";
import { useCollaborationRoom } from "./hooks/useCollaborationRoom";
import { useAppToast } from "./hooks/useAppToast";
import { useEditorSearchController } from "./hooks/useEditorSearchController";
import { useEventCallback } from "./hooks/useEventCallback";
import { useFileComments } from "./hooks/useFileComments";
import { useMarkdownFiles } from "./hooks/useMarkdownFiles";
import { useProjectIoController } from "./hooks/useProjectIoController";
import { useIndexedDbWorkspaceHydration } from "./hooks/useIndexedDbWorkspaceHydration";
import { useJsonShareImportController } from "./hooks/useJsonShareImportController";
import { useJsonShareController } from "./hooks/useJsonShareController";
import { useQueuedWorkspacePersistence } from "./hooks/useQueuedWorkspacePersistence";
import { useSelectionCommentController } from "./hooks/useSelectionCommentController";
import { useSplitViewController } from "./hooks/useSplitViewController";
import { useWorkspaceActiveFileEditor } from "./hooks/useWorkspaceActiveFileEditor";
import { useWorkspaceChromeController } from "./hooks/useWorkspaceChromeController";
import { useWorkspaceCommentActions } from "./hooks/useWorkspaceCommentActions";
import { useWorkspaceFileActions } from "./hooks/useWorkspaceFileActions";
import { useWorkspaceIdentity } from "./hooks/useWorkspaceIdentity";
import { useWorkspaceKeyboardShortcuts } from "./hooks/useWorkspaceKeyboardShortcuts";
import { useWorkspaceLiveRoomController } from "./hooks/useWorkspaceLiveRoomController";
import { useWorkspacePreferences } from "./hooks/useWorkspacePreferences";
import { useWorkspaceScrollSync } from "./hooks/useWorkspaceScrollSync";
import {
  getActiveWorkspaceStatus,
  getMarkdownWordCount,
  getWorkspaceFileSearchText,
  getWorkspaceFileStatus,
  getWorkspaceStatusLabel,
} from "./workspaceViewModel";
import {
  clampSplitEditorRatio,
  createMarkdownFile,
  DEFAULT_SPLIT_EDITOR_RATIO,
  getRoomFromLocation,
  isUsableLiveRoomFile,
  readInitialWorkspaceSnapshot,
  randomId,
  README_FILE_ID,
  syncUrlForFile,
  type LocationRoom,
  type MarkdownFile,
  type WorkspaceState,
} from "./workspaceStorage";
import type { TextChange } from "./textPatches";

const getFloatingPopoverStyle = (
  position: MarkdownSelectionActionPosition,
  options: { width: number; yOffset: number },
): CSSProperties => {
  const viewportWidth = window.innerWidth || 1024;
  const left = Math.max(12, Math.min(position.clientX, viewportWidth - options.width - 12));
  const top = Math.max(72, position.clientY + options.yOffset);
  return {
    left,
    top,
  };
};

function WorkspaceApp() {
  const [initialWorkspaceSnapshot] = useState(() => readInitialWorkspaceSnapshot());
  const initialWorkspace = initialWorkspaceSnapshot.workspace;
  const {
    files,
    openFiles,
    openFileIds,
    activeFileId,
    activeFile,
    selectFile: selectMarkdownFile,
    addFile: addMarkdownFile,
    addFileFromContent,
    activateRoomFile,
    duplicateFile: duplicateMarkdownFile,
    renameFile,
    closeFile: closeMarkdownFile,
    deleteFile: deleteMarkdownFile,
    replaceWorkspace,
    restoreFile,
    upsertHelpFile,
    reorderFiles,
    selectAdjacentFile: selectAdjacentMarkdownFile,
    setActiveFileBookmarks,
    setActiveFileText,
    setActiveFileViewMode: setMarkdownFileViewMode,
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
  } = useMarkdownFiles({
    initialFiles: initialWorkspace.files,
    initialOpenFileIds: initialWorkspace.openFileIds,
    initialActiveFileId: initialWorkspace.activeFileId,
    readmeFileId: README_FILE_ID,
    createFile: createMarkdownFile,
  });
  const [workspacePreferences, setWorkspacePreferences] = useWorkspacePreferences();
  const [rightFileQuery, setRightFileQuery] = useState("");
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement | null>(null);
  const [shortcutLabels] = useState(() => getShortcutLabels());
  const { toast, showToast } = useAppToast();
  const { identity, updateIdentityName, normalizeIdentityName } = useWorkspaceIdentity();
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
  const jsonShare = useJsonShareController({
    activeFile,
    commentsByFileId,
    showToast,
  });
  const text = activeFile?.text ?? "";
  const activeViewMode = activeFile?.viewMode ?? "edit";
  const activeReadingWidth = activeFile?.readingWidth ?? "wide";
  const activeSplitRatio = clampSplitEditorRatio(activeFile?.splitRatio ?? DEFAULT_SPLIT_EDITOR_RATIO);
  const activeLineWrapping = activeFile?.lineWrapping ?? true;
  const activeLineNumbers = activeFile?.lineNumbers ?? true;
  const activeBookmarks = activeFile?.bookmarks ?? [];
  const parsedMarkdown = useMemo(() => parseFrontmatter(text), [text]);
  const renderedPreview = useMemo(() => getPreviewBody(parsedMarkdown.body), [parsedMarkdown.body]);
  const previewBodyStartOffset = useMemo(() => {
    const parsedBodyStartOffset = text.indexOf(parsedMarkdown.body);
    return (
      (parsedBodyStartOffset === -1 ? 0 : parsedBodyStartOffset) +
      getLineStartOffset(parsedMarkdown.body, renderedPreview.sourceLineOffset)
    );
  }, [parsedMarkdown.body, renderedPreview.sourceLineOffset, text]);
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
    onSetActiveFileViewMode: setMarkdownFileViewMode,
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
      setActiveFileViewMode("edit", { preserveScroll: false, focusEditor: false });
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
  const handleCollaborationRemoteTextChange = useEventCallback(
    (fileId: string, nextText: string, change?: TextChange) => {
      if (fileId !== activeFile?.id) {
        return;
      }

      editorRef.current?.applyRemoteTextChange(nextText, change?.patches);
    },
  );
  const indexedDbHydration = useIndexedDbWorkspaceHydration({
    enabled: initialWorkspaceSnapshot.source === "starter",
    initialWorkspace,
    workspace: workspacePersistenceSnapshot,
    replaceCommentsByFileId,
    replaceWorkspace,
  });
  useQueuedWorkspacePersistence(workspacePersistenceSnapshot, { enabled: !indexedDbHydration.deferPersistence });
  const {
    topPopover,
    setTopPopover,
    centerPopover,
    setCenterPopover,
    workspaceMenuOpen,
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
    startSessionUnavailableReason,
    startSession: startCollaborationSession,
    applyLocalText,
    resetCollaborationState,
  } = useCollaborationRoom({
    activeFile: activeFile,
    activeSelection,
    identity,
    setFileText,
    setFileCollaborationStatus,
    setFileCollaboratorCount,
    setFileRoomMeta,
    setFileRecoveryEvent,
    startFileCollaborationSession,
    onRemoteTextChange: handleCollaborationRemoteTextChange,
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
  const isLive = isUsableLiveRoomFile(activeFile);
  const activeStatus = getActiveWorkspaceStatus({ isLive, connectionStatus });
  useEffect(() => {
    if (!isLive && rightPanelView === "comments") {
      setRightPanelView("files");
    }
  }, [isLive, rightPanelView, setRightPanelView]);

  const { copyShareUrl, startSession, stopSession } = useWorkspaceLiveRoomController({
    activeFile,
    resetCollaborationState,
    setCenterPopover,
    setCopiedFileId,
    startCollaborationSession,
    stopFileCollaborationSession,
  });
  const copied = copiedFileId === activeFile?.id;
  const activeWordCount = getMarkdownWordCount(text);
  const shareOpen = topPopover === "share";
  const outlineHeadings = useMemo<MarkdownHeading[]>(
    () => getOutlineHeadings(renderedPreview),
    [renderedPreview],
  );

  const activateRoomFromLocation = (room: LocationRoom) => {
    activateRoomFile(room);
    setTopPopover(null);
    setCenterPopover(null);
    setCopiedFileId(null);
  };

  useEffect(() => {
    const handlePopState = () => {
      const room = getRoomFromLocation();
      if (room) {
        activateRoomFromLocation(room);
        return;
      }

      const currentFile = files.find((file) => file.id === activeFileId);
      if (!currentFile?.roomId) {
        return;
      }

      const localFile = files.find((file) => !file.roomId) ?? files[0];
      if (localFile) {
        selectMarkdownFile(localFile.id);
        setTopPopover(null);
        setCenterPopover(null);
        setCopiedFileId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeFileId, activateRoomFile, files, selectMarkdownFile]);

  useEffect(() => {
    if (!activeFile || activeFile.roomId || !getRoomFromLocation()) {
      return;
    }

    syncUrlForFile(undefined, "replace");
  }, [activeFile?.id, activeFile?.roomId]);

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
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [selectionActionPosition]);

  const goToOutlineHeading = (heading: MarkdownHeading, headingIndex: number) => {
    if (activeViewMode === "preview") {
      const renderedHeadings = Array.from(previewSurfaceRef.current?.querySelectorAll("h1, h2, h3") ?? []).filter(
        (heading) => !heading.closest(".frontmatter-view"),
      );
      const renderedHeading = renderedHeadings[headingIndex];
      renderedHeading?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }

    const bodyStartOffset = text.indexOf(parsedMarkdown.body);
    const targetOffset =
      (bodyStartOffset === -1 ? 0 : bodyStartOffset) +
      getLineStartOffset(parsedMarkdown.body, heading.sourceLineIndex);
    focusTextRange(targetOffset, targetOffset + heading.text.length + heading.depth + 1);
  };

  const {
    emptyDropActive,
    copyCurrentMarkdown,
    downloadCurrentMarkdownFile,
    downloadProject,
    downloadProjectArchive,
    handleImportInputChange,
    handleProjectImportInputChange,
    handleEmptyWorkspaceDragOver,
    handleEmptyWorkspaceDragLeave,
    handleEmptyWorkspaceDrop,
  } = useProjectIoController({
    activeFile,
    activeFileId,
    addFileFromContent,
    commentsByFileId,
    editorRef,
    files,
    openFileIds,
    preferences: workspacePreferences,
    replaceCommentsByFileId,
    replaceWorkspace,
    resetCollaborationState,
    showToast,
    clearFileHistory,
    onCloseChrome: closeFloatingChrome,
  });
  const {
    closeJsonShareImport,
    jsonShareImport,
    replaceWorkspaceWithJsonShare,
  } = useJsonShareImportController({
    clearFileHistory,
    closeFloatingChrome,
    commentsByFileId,
    files,
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
    renameMarkdownFile,
    duplicateFile,
    deleteFile,
    closeFile,
    selectAdjacentFile,
  } = useWorkspaceFileActions({
    activeFile,
    activeFileId,
    addFileFromContent,
    addMarkdownFile,
    closeFloatingChrome,
    closeMarkdownFile,
    commentsByFileId,
    deleteMarkdownFile,
    duplicateMarkdownFile,
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
    selectAdjacentMarkdownFile,
    selectMarkdownFile,
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
  const handleStableLineAnnotationAction = useEventCallback(handleLineAnnotationAction);
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

  const getFileStatus = (file: MarkdownFile) =>
    getWorkspaceFileStatus({
      file,
      activeFileId: activeFile?.id,
      activeConnectionStatus: connectionStatus,
  });
  const statusLabel = getWorkspaceStatusLabel(activeStatus);
  const activeFileTitle = activeFile?.title ?? "No file open";
  const activePresenceIdentity = useMemo(
    () =>
      isLive
        ? {
            ...identity,
            roomId: activeFile?.roomId,
            fileTitle: activeFileTitle,
            selection: activeSelection,
          }
        : identity,
    [activeFile?.roomId, activeFileTitle, activeSelection, identity, isLive],
  );
  const showFormattingToolbar = Boolean(activeFile && activeViewMode !== "preview");
  const showSelectionCommentPopover = Boolean(isLive && activeFile && selectedCharacterCount > 0 && selectionActionPosition);

  const fileTabsNode = (
    <FileTabs
      files={openFiles}
      activeFile={activeFile}
      activeCollaboratorCount={collaborators.length}
      getFileStatus={getFileStatus}
      onAddFile={addFile}
      onSelectFile={selectFile}
      onRenameFile={renameMarkdownFile}
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
      }}
      onCloseShare={() => {
        setTopPopover(null);
        setSharePanelTarget(undefined);
      }}
      onStartSession={startSession}
      onCopyShareUrl={copyShareUrl}
      onCopyMarkdown={copyCurrentMarkdown}
      onDownloadMarkdown={downloadCurrentMarkdownFile}
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
          fileCount={jsonShareImport.status === "ready" ? jsonShareImport.workspace.files.length : undefined}
          errorMessage={jsonShareImport.status === "error" ? jsonShareImport.errorMessage : undefined}
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
        aria-label="Import Markdown file"
      />
      <input
        ref={workspaceImportInputRef}
        className="workspace-file-input"
        type="file"
        accept=".json,application/json"
        onChange={handleProjectImportInputChange}
        aria-label="Import project file"
      />
      <section className={`main-panel ${rightPanelOpen ? "right-panel-open" : ""}`}>
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
          onChangeTheme={(theme) => setWorkspacePreferences((currentPreferences) => ({ ...currentPreferences, theme }))}
          onChangeLanguage={(language) =>
            setWorkspacePreferences((currentPreferences) => ({ ...currentPreferences, language }))
          }
          onAddFile={addFile}
          onOpenMarkdownFile={() => {
            closeFloatingChrome();
            importInputRef.current?.click();
          }}
          onImportProject={() => {
            closeFloatingChrome();
            workspaceImportInputRef.current?.click();
          }}
          onDownloadMarkdown={() => {
            downloadCurrentMarkdownFile();
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

        <section
          className={`center-workbench ${
            activeFile ? `has-file view-${activeViewMode} reading-${activeReadingWidth}` : "empty"
          } ${activeFile ? (activeLineNumbers ? "line-numbers-on" : "line-numbers-off") : ""}`}
        >
          <TopChrome
            workspaceMenuOpen={workspaceMenuOpen}
            rightPanelOpen={rightPanelOpen}
            isLive={isLive}
            identity={activePresenceIdentity}
            collaborators={collaborators}
            activeText={text}
            fileTabs={fileTabsNode}
            shareControls={shareControlsNode}
            onToggleWorkspaceMenu={toggleWorkspaceMenu}
            onToggleRightPanel={toggleRightPanel}
          />

          <section
            className={`file-shell ${
              activeFile ? `view-${activeViewMode} reading-${activeReadingWidth}` : "empty"
            } ${activeFile ? (activeLineNumbers ? "line-numbers-on" : "line-numbers-off") : ""} ${
              showFormattingToolbar ? "with-format-toolbar" : ""
            } ${
              searchOpen ? "with-search-row" : ""
            } ${
              shareOpen ? "share-modal-open" : ""
            }`}
          >
            {activeFile ? (
              <>
                <section
                  className={`editor-control-row ${activeViewMode} reading-${activeReadingWidth} ${
                    showFormattingToolbar ? "with-formatting" : ""
                  }`}
                  aria-label="Editor controls"
                >
                  {showFormattingToolbar && (
                    <MarkdownFormattingToolbar
                      className={`${activeViewMode} reading-${activeReadingWidth}`}
                      onFormat={formatMarkdown}
                    />
                  )}

                  <FileToolbar
                    activeViewMode={activeViewMode}
                    activeReadingWidth={activeReadingWidth}
                    activeLineWrapping={activeLineWrapping}
                    activeLineNumbers={activeLineNumbers}
                    centerPopover={centerPopover}
                    searchOpen={searchOpen}
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
                      setCenterPopover((current) => (current === "view" ? null : "view"));
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
                  <FileSearchBar
                    searchInputRef={searchInputRef}
                    searchQuery={searchQuery}
                    searchMatches={searchMatches}
                    activeSearchMatchIndex={activeSearchMatchIndex}
                    onSearchQueryChange={setSearchQuery}
                    onGoToSearchMatch={goToSearchMatch}
                    onCloseSearch={() => setSearchOpen(false)}
                  />
                )}

                <section
                  className={`workspace ${activeViewMode} reading-${activeReadingWidth} ${
                    splitDividerDragging ? "split-resizing" : ""
                  }`}
                  ref={workspaceRef}
                  style={splitWorkspaceStyle}
                >
                  <article
                    className={`editor-surface ${activeLineNumbers ? "line-numbers-on" : "line-numbers-off"} ${
                      selectedCharacterCount > 0 ? "has-text-selection" : ""
                    }`}
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
                      activeSearchMatchIndex={searchOpen ? activeSearchMatchIndex : -1}
                      onChange={handleTextChange}
                      onBookmarksChange={updateActiveFileBookmarks}
                      onHistoryStateChange={handleEditorHistoryStateChange}
                      onOpenLineActions={handleStableLineAnnotationAction}
                      onOpenComment={openStableCommentMarker}
                      onSelectionChange={handleEditorSelectionChange}
                      onSelectionActionPositionChange={handleEditorSelectionActionPositionChange}
                      onScrollRatioChange={handleEditorScrollRatioChange}
                    />
                  </article>

                  {activeViewMode === "split" && !shareOpen && (
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

                {showSelectionCommentPopover && selectionActionPosition && (
                  <div
                    className="selection-comment-popover"
                    style={getFloatingPopoverStyle(selectionActionPosition, { width: 128, yOffset: 30 })}
                    role="toolbar"
                    aria-label="Selection actions"
                  >
                    <button className="selection-comment-button" type="button" onClick={openSelectionComment}>
                      <MessageSquarePlus size={15} />
                      <span>Add comment</span>
                    </button>
                  </div>
                )}

                <StatusBar
                  activeFileTitle={activeFileTitle}
                  canUndo={canUndo || editorHistoryState.canUndo}
                  canRedo={canRedo || editorHistoryState.canRedo}
                  isLive={isLive}
                  statusLabel={statusLabel}
                  wordCount={activeWordCount}
                  commentCount={isLive ? activeOpenComments.length : 0}
                  cursorPositionLabel={cursorPositionLabel}
                  selectedCharacterCount={selectedCharacterCount}
                  selectedLineCount={selectedLineCount}
                  onUndo={undoActiveFile}
                  onRedo={redoActiveFile}
                  onOpenComments={() => openCommentsPanel(focusedCommentId ?? activeOpenComments[0]?.id)}
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
                  onOpenMarkdown={() => importInputRef.current?.click()}
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
            onImportMarkdown={() => importInputRef.current?.click()}
            onSelectFile={selectFile}
            onCloseFile={closeFile}
            onRenameFile={renameMarkdownFile}
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

function App() {
  const publishRoute = getPublishRoute(window.location.pathname, window.location.search);
  if (publishRoute) {
    return <PublishedSnapshotRoute route={publishRoute} />;
  }

  return <WorkspaceApp />;
}

export default App;
