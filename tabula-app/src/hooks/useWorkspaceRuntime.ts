import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createHelpMarkdown } from "../helpMarkdown";
import { getShortcutLabels } from "../keyboardShortcuts";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import {
  createRoomActor,
  createWorkspaceRoomState,
  type RoomEvent,
  type TextChange,
  type WorkspaceRoomDocument,
  type WorkspaceRoomState,
} from "@tabula-md/tabula";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import { reconcileWorkspaceRoomState } from "../collaboration/workspaceRoomStateMerge";
import {
  createWorkspaceFile,
  isEmptyGeneratedLivePlaceholder,
  randomId,
  readInitialWorkspaceSnapshot,
  README_FILE_ID,
  syncUrlForFile,
  type FileViewMode,
  type WorkspaceState,
} from "../workspaceStorage";
import {
  getWorkspaceChromeCopy,
  getWorkspaceMenuCopy,
} from "../workspaceLocale";
import { createWorkspaceRuntimeView } from "../workspaceRuntimeView";
import {
  getWorkspaceStoreActiveFile,
  getWorkspaceStoreSnapshot,
} from "../stores/workspaceStore";
import { useAppToast } from "./useAppToast";
import { useDocumentSurfaceRuntime } from "./useDocumentSurfaceRuntime";
import { useEventCallback } from "./useEventCallback";
import { useFileComments } from "./useFileComments";
import { useSelectionActionDismissal } from "./useSelectionActionDismissal";
import { useWorkspaceEditorDocumentRuntimeOwner } from "./editorDocumentRuntimeOwner";
import { useWorkspaceActiveFileEditor } from "./useWorkspaceActiveFileEditor";
import { useWorkspaceChromeController } from "./useWorkspaceChromeController";
import { useWorkspaceCollaborationRuntime } from "./useWorkspaceCollaborationRuntime";
import { useWorkspaceCommentActions } from "./useWorkspaceCommentActions";
import { useWorkspaceDocumentRuntime } from "./useWorkspaceDocumentRuntime";
import { useWorkspaceFileActions } from "./useWorkspaceFileActions";
import { useWorkspaceFiles } from "./useWorkspaceFiles";
import { useWorkspaceIdentity } from "./useWorkspaceIdentity";
import { useWorkspaceIoRuntime } from "./useWorkspaceIoRuntime";
import { useWorkspaceKeyboardShortcuts } from "./useWorkspaceKeyboardShortcuts";
import { useWorkspaceMenuRuntime } from "./useWorkspaceMenuRuntime";
import { useWorkspacePersistenceRuntime } from "./useWorkspacePersistenceRuntime";
import { useWorkspacePreferences } from "./useWorkspacePreferences";
import { useWorkspaceProjectContextRuntime } from "./useWorkspaceProjectContextRuntime";
import { useWorkspaceRouteRuntime } from "./useWorkspaceRouteRuntime";
import { useWorkspaceShareRuntime } from "./useWorkspaceShareRuntime";
import { useWorkspaceTopChromeRuntime } from "./useWorkspaceTopChromeRuntime";

export function useWorkspaceRuntime() {
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
  const setSyncScrollingPreference = useEventCallback((syncScrolling: boolean) => {
    setWorkspacePreferences((currentPreferences) => ({
      ...currentPreferences,
      syncScrolling,
    }));
  });
  const workspaceChromeCopy = getWorkspaceChromeCopy(
    workspacePreferences.language,
  );
  const workspaceShareCopy = getWorkspaceMenuCopy(
    workspacePreferences.language,
  ).share;
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const editorDocumentRuntime = useWorkspaceEditorDocumentRuntimeOwner();
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement | null>(null);
  const [shortcutLabels] = useState(() => getShortcutLabels());
  const { toast, showToast } = useAppToast();
  const { identity, updateIdentityName, normalizeIdentityName } =
    useWorkspaceIdentity();
  const [shareExcludedFileIds, setShareExcludedFileIds] = useState<string[]>([]);
  const failedLiveRoomStartRef = useRef<string | null>(null);
  const syncedLiveRoomUrlRef = useRef<string | null>(null);
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
  const getActiveFileSnapshot = useEventCallback(() => {
    const latestActiveFile = getWorkspaceStoreActiveFile() ?? activeFile;
    return latestActiveFile
      ? {
          ...latestActiveFile,
          text: editorDocumentRuntime.getLatestFileText(
            latestActiveFile.id,
            latestActiveFile.text,
          ),
        }
      : undefined;
  });
  const getWorkspaceSnapshot = useEventCallback((): WorkspaceState => {
    const workspaceSnapshot = getWorkspaceStoreSnapshot();
    const activeFileSnapshot = getActiveFileSnapshot();
    return {
      ...workspaceSnapshot,
      files: activeFileSnapshot
        ? workspaceSnapshot.files.map((file) =>
            file.id === activeFileSnapshot.id ? activeFileSnapshot : file,
          )
        : workspaceSnapshot.files,
      commentsByFileId,
    };
  });
  const [visibleTextRevision, setVisibleTextRevision] = useState(0);
  const [visibleTextChange, setVisibleTextChange] = useState<TextChange | null>(null);
  const bumpVisibleTextRevision = useEventCallback((change?: TextChange) => {
    setVisibleTextChange(change ?? null);
    setVisibleTextRevision((currentRevision) => currentRevision + 1);
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
    previewBodyTextChange,
    previewSurfaceRef,
    queueEditorFocus,
    queueEditorTextRange,
    renderedPreview,
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
    selectedMarkdownText,
    selectionActionPosition,
    setActiveFileViewMode,
    setActiveSelection,
    setSearchOpen,
    setSearchQuery,
    setReplaceQuery,
    toggleSearchOption,
    selectAllSearchMatches,
    openSearchFromCurrentSelection,
    onPreviewSearchMatchCountChange,
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
    replaceAllMatches,
    replaceCurrentMatch,
  } = useWorkspaceDocumentRuntime({
    activeFile,
    editorDocumentRuntime,
    editorRef,
    previewRef,
    syncScrollingEnabled: workspacePreferences.syncScrolling,
    visibleTextChange,
    visibleTextRevision,
    onCommitActiveFileSplitRatio: commitActiveFileSplitRatio,
    onSetWorkspaceFileViewMode: setWorkspaceFileViewMode,
  });
  const lastPublishedWorkspaceStateSignatureRef = useRef<string | null>(null);
  const suppressNextWorkspaceStatePublishRef = useRef(false);
  useEffect(() => {
    lastPublishedWorkspaceStateSignatureRef.current = null;
    suppressNextWorkspaceStatePublishRef.current = false;
  }, [activeFile?.roomId]);
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
    topPopover,
    setTopPopover,
    centerPopover,
    setCenterPopover,
    workspaceMenuOpen,
    setWorkspaceMenuOpen,
    preferencesOpen,
    setPreferencesOpen,
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
  const mergeWorkspaceRoomState = useEventCallback((workspace: WorkspaceRoomState) => {
    const nextWorkspace = reconcileWorkspaceRoomState({
      activeFile,
      createFile: createWorkspaceFile,
      workspace,
      workspaceSnapshot: getWorkspaceSnapshot(),
    });
    if (!nextWorkspace) {
      return;
    }

    suppressNextWorkspaceStatePublishRef.current = true;
    replaceWorkspace(nextWorkspace);
  });
  const handleRoomEvent = useEventCallback((event: RoomEvent) => {
    if (!activeFile?.roomId || event.roomId !== activeFile.roomId) {
      return;
    }

    if (event.type === "workspace.updated") {
      mergeWorkspaceRoomState(event.workspace);
    }
  });
  const workspaceShareDocuments = useMemo(
    () => {
      if (activeFile && isEmptyGeneratedLivePlaceholder(activeFile)) {
        return [
          {
            id: activeFile.id,
            title: activeFile.title,
            text: activeFile.text,
            parentId: activeFile.parentId,
          },
        ];
      }

      const shareCandidateFiles = activeFile?.roomId
        ? files.filter((file) => file.roomId === activeFile.roomId)
        : files.filter((file) => file.id === activeFile?.id || !shareExcludedFileIds.includes(file.id));

      return shareCandidateFiles
        .map((file) => ({
          id: file.id,
          title: file.title,
          text: file.text,
          parentId: file.parentId,
        }));
    },
    [activeFile, files, shareExcludedFileIds],
  );
  const workspaceShareTreeSignature = useMemo(
    () =>
      JSON.stringify(
        workspaceShareDocuments.map((document) => ({
          id: document.id,
          title: document.title,
          parentId: document.parentId ?? null,
        })),
      ),
    [workspaceShareDocuments],
  );
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
    publishRoomEvent,
    resetCollaborationState,
    retryConnection: retryCollaborationConnection,
  } = useWorkspaceCollaborationRuntime({
    activeFile,
    activeFileTitle,
    activeSelection,
    editorDocumentRuntime,
    editorRef,
    getActiveFileSnapshot,
    identity,
    workspaceDocuments: workspaceShareDocuments,
    setFileText,
    setFileCollaborationStatus,
    setFileCollaboratorCount,
    setFileRecoveryEvent,
    startFileCollaborationSession,
    onRoomEvent: handleRoomEvent,
  });
  const isLiveConnected = isLive && connectionStatus === "connected";
  const {
    canRedo,
    canUndo,
    clearFileHistory,
    editorHistoryState,
    handleEditorHistoryStateChange,
    handleTextChange,
    flushPendingEditorCommit,
    getLatestFileText,
    historyByFileId,
    redoActiveFile,
    setHistoryByFileId,
    undoActiveFile,
    updateActiveFileBookmarks,
  } = useWorkspaceActiveFileEditor({
    activeFile,
    applyLocalText,
    editorDocumentRuntime,
    editorRef,
    onVisibleTextChange: bumpVisibleTextRevision,
    setActiveFileBookmarks,
    setActiveFileText,
    setFileText,
  });
  const getWorkspaceRoomDocuments = useEventCallback((): WorkspaceRoomDocument[] => {
    const workspaceSnapshot = getWorkspaceSnapshot();
    const excludedFileIds = new Set(shareExcludedFileIds);
    return workspaceSnapshot.files
      .filter((file) =>
        activeFile?.roomId
          ? file.roomId === activeFile.roomId
          : !excludedFileIds.has(file.id),
      )
      .map((file) => ({
        id: file.id,
        title: file.title,
        markdown: getLatestFileText(file.id, file.text),
        parentId: file.parentId,
      }));
  });
  const toggleShareFileExcluded = useEventCallback((fileId: string) => {
    setShareExcludedFileIds((currentFileIds) => {
      const currentExcludedFileIds = new Set(currentFileIds);
      if (currentExcludedFileIds.has(fileId)) {
        return currentFileIds.filter((currentFileId) => currentFileId !== fileId);
      }

      const includedFileCount = files.filter(
        (file) => !currentExcludedFileIds.has(file.id),
      ).length;
      return includedFileCount <= 1 ? currentFileIds : [...currentFileIds, fileId];
    });
  });
  useEffect(() => {
    const existingFileIds = new Set(files.map((file) => file.id));
    setShareExcludedFileIds((currentFileIds) =>
      currentFileIds.filter((fileId) => existingFileIds.has(fileId)),
    );
  }, [files]);
  useEffect(() => {
    if (!activeFile?.roomId || connectionStatus !== "connected") {
      return;
    }

    let cancelled = false;
    const documents = getWorkspaceRoomDocuments();
    const publishSignature = JSON.stringify({
      roomId: activeFile.roomId,
      activeDocumentId: activeFile.id,
      actorId: presenceIdentity.id,
      tree: workspaceShareTreeSignature,
    });
    if (lastPublishedWorkspaceStateSignatureRef.current === publishSignature) {
      return;
    }
    lastPublishedWorkspaceStateSignatureRef.current = publishSignature;
    if (suppressNextWorkspaceStatePublishRef.current) {
      suppressNextWorkspaceStatePublishRef.current = false;
      return;
    }

    void createWorkspaceRoomState({
      activeDocumentId: activeFile.id,
      documents,
      nowIso: () => new Date().toISOString(),
      roomId: activeFile.roomId,
    }).then((workspace) => {
      if (cancelled) {
        return;
      }

      publishRoomEvent({
        id: randomId(),
        roomId: activeFile.roomId!,
        actorId: presenceIdentity.id,
        type: "workspace.updated",
        createdAt: new Date().toISOString(),
        actor: createRoomActor({
          id: presenceIdentity.id,
          kind: presenceIdentity.kind ?? "human",
          name: presenceIdentity.name,
          color: presenceIdentity.color,
          client: presenceIdentity.client ?? "tabula-md",
          capabilities: presenceIdentity.capabilities,
          joinedAt: presenceIdentity.joinedAt,
        }),
        workspace,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeFile?.id,
    activeFile?.roomId,
    connectionStatus,
    getWorkspaceRoomDocuments,
    presenceIdentity.id,
    publishRoomEvent,
    workspaceShareTreeSignature,
  ]);
  useWorkspacePersistenceRuntime({
    enabled: initialWorkspaceSnapshot.source === "starter",
    getWorkspaceSnapshot,
    initialWorkspace,
    onBeforePersist: flushPendingEditorCommit,
    workspace: workspacePersistenceSnapshot,
    replaceCommentsByFileId,
    replaceWorkspace,
  });
  const { copyShareUrl, jsonShare, startSession, stopSession } =
    useWorkspaceShareRuntime({
      activeFile,
      activeText: text,
      commentsByFileId,
      copy: workspaceShareCopy,
      files,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary: flushPendingEditorCommit,
      resetCollaborationState,
      retryCollaborationConnection,
      setCopiedFileId,
      showToast,
      startCollaborationSession,
      stopFileCollaborationSession,
    });
  const copyShareUrlWithPendingCommit = useEventCallback(() => {
    flushPendingEditorCommit();
    void copyShareUrl();
  });
  const startSessionWithPendingCommit = useEventCallback(() => {
    flushPendingEditorCommit();
    const startedSession = startSession();
    if (!startedSession) {
      return;
    }

    const excludedFileIds = new Set(shareExcludedFileIds);
    for (const file of files) {
      if (file.id === activeFile?.id || excludedFileIds.has(file.id)) {
        continue;
      }
      startFileCollaborationSession(file.id, startedSession.roomId, startedSession.shareUrl);
      setFileCollaborationStatus(file.id, "idle", { collaboratorCount: 0 });
    }
  });
  const stopSessionWithPendingCommit = useEventCallback(() => {
    const roomId = activeFile?.roomId;
    const workspaceRoomFileIds = roomId ? files.filter((file) => file.roomId === roomId).map((file) => file.id) : [];
    flushPendingEditorCommit();
    stopSession();
    for (const fileId of workspaceRoomFileIds) {
      if (fileId !== activeFile?.id) {
        stopFileCollaborationSession(fileId);
      }
    }
  });
  useEffect(() => {
    const roomId = activeFile?.roomId;
    if (!roomId || connectionStatus !== "failed") {
      return;
    }
    if (failedLiveRoomStartRef.current === roomId) {
      return;
    }

    failedLiveRoomStartRef.current = roomId;
    setTopPopover(null);
    showToast("Live collaboration isn’t available right now.", "error");
    stopSessionWithPendingCommit();
  }, [
    activeFile?.roomId,
    connectionStatus,
    setTopPopover,
    showToast,
    stopSessionWithPendingCommit,
  ]);
  useEffect(() => {
    if (connectionStatus === "connected" || !activeFile?.roomId) {
      failedLiveRoomStartRef.current = null;
    }
  }, [activeFile?.roomId, connectionStatus]);
  useEffect(() => {
    if (!activeFile?.roomId || !activeFile.shareUrl) {
      syncedLiveRoomUrlRef.current = null;
      return;
    }
    if (connectionStatus !== "connected") {
      return;
    }
    if (syncedLiveRoomUrlRef.current === activeFile.roomId) {
      return;
    }

    syncedLiveRoomUrlRef.current = activeFile.roomId;
    syncUrlForFile(activeFile);
  }, [activeFile, activeFile?.roomId, activeFile?.shareUrl, connectionStatus]);
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
    onBeforeWorkspaceBoundary: flushPendingEditorCommit,
    selectFile: selectWorkspaceFileAction,
    onRouteWorkspaceChange: handleRouteWorkspaceChange,
  });

  useSelectionActionDismissal({
    selectionActionPosition,
    setSelectionActionPosition,
  });

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
    getActiveFileSnapshot,
    getWorkspaceSnapshot,
    openFileIds,
    onBeforeWorkspaceBoundary: flushPendingEditorCommit,
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
    onBeforeWorkspaceBoundary: flushPendingEditorCommit,
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
    commentsEnabled: isLiveConnected,
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
    largeDocumentMode: activeDocument.largeDocumentMode,
    onBeforeCreateComment: flushPendingEditorCommit,
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
      isLive: isLiveConnected,
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
      shareExcludedFileIds,
      setRightPanelOpen,
      setRightPanelView,
      text,
    });
  const { shareOpen, topChromeProps } = useWorkspaceTopChromeRuntime({
    activeFile,
    activeText: text,
    canStartSession,
    collaborators,
    copiedFileId,
    currentUserName: identity.name,
    files,
    getFileStatus,
    identity: presenceIdentity,
    isLive,
    isLiveConnected,
    jsonShare,
    language: workspacePreferences.language,
    openFiles,
    rightPanelOpen,
    shareExcludedFileIds,
    startSessionUnavailableReason,
    topPopover,
    workspaceMenuOpen,
    onAddFile: addFile,
    onChangeUserName: updateIdentityName,
    onCloseFile: closeFile,
    onCommitUserName: normalizeIdentityName,
    onCopyShareUrl: copyShareUrlWithPendingCommit,
    onDownloadProjectArchive: downloadProjectArchive,
    onReorderFiles: reorderFiles,
    onRenameFile: renameWorkspaceFileAction,
    onSelectFile: selectFile,
    onStartSession: startSessionWithPendingCommit,
    onStopSession: stopSessionWithPendingCommit,
    onRetrySession: retryCollaborationConnection,
    onToggleRightPanel: toggleRightPanel,
    onToggleShareFileExcluded: toggleShareFileExcluded,
    onToggleWorkspaceMenu: toggleWorkspaceMenu,
    setCenterPopover,
    setPreferencesOpen,
    setTopPopover,
    setWorkspaceMenuOpen,
  });
  useWorkspaceKeyboardShortcuts({
    importInputRef,
    addFile,
    closeFloatingChrome,
    openFilesPanel,
    openHelpFile,
    openDocumentSearch: openSearchFromCurrentSelection,
    selectAdjacentFile,
    setActiveFileViewMode,
    setCenterPopover,
  });

  const { documentSurface, documentWorkbenchRuntime } =
    useDocumentSurfaceRuntime({
      activeDocument,
      activeLineNumbers,
      activeLineWrapping,
      activeOpenComments,
      activeSyncScrolling: workspacePreferences.syncScrolling,
      activeViewMode,
      editorRef,
      focusedCommentId,
      isLive,
      searchOpen,
      selectedCharacterCount,
      selectionActionPosition,
      shareOpen,
      splitDividerDragging,
      onOpenCommentsPanel: openCommentsPanel,
      onSetActiveFileLineNumbers: setActiveFileLineNumbers,
      onSetActiveFileLineWrapping: setActiveFileLineWrapping,
      onSetActiveFileReadingWidth: setActiveFileReadingWidth,
      onSetActiveFileViewMode: setActiveFileViewMode,
      onSetSyncScrolling: setSyncScrollingPreference,
      setCenterPopover,
      setSearchOpen,
      setTopPopover,
    });
  const setViewModeWithPendingCommit = useEventCallback((viewMode: FileViewMode) => {
    flushPendingEditorCommit();
    documentWorkbenchRuntime.onSetViewMode(viewMode);
  });

  return createWorkspaceRuntimeView({
    activeFile,
    documentSurface,
    emptySurfaceProps: {
      alternateShortcutModifier: shortcutLabels.alternate,
      dropActive: emptyDropActive,
      language: workspacePreferences.language,
      primaryShortcutModifier: shortcutLabels.primary,
      workspaceRef,
      onBrowseFiles: openFilesPanel,
      onDragLeave: handleEmptyWorkspaceDragLeave,
      onDragOver: handleEmptyWorkspaceDragOver,
      onDrop: handleEmptyWorkspaceDrop,
      onNewFile: addFile,
      onOpenFile: () => importInputRef.current?.click(),
      onOpenHelp: openHelpFile,
    },
    menuSurfaceProps,
    overlayProps: {
      jsonShareImport,
      toast,
      onCloseJsonShareImport: closeJsonShareImport,
      onReplaceWorkspaceWithJsonShare: replaceWorkspaceWithJsonShare,
    },
    projectContextProps,
    topChromeProps,
    workbenchProps: {
      activeBookmarks,
      activeCommentAnchors,
      activeFile,
      activeFileTitle,
      activeLineNumbers,
      activeLineWrapping,
      activeSyncScrolling: workspacePreferences.syncScrolling,
      activePreviewCommentAnchors,
      activePreviewLineAnnotations,
      activeSearchMatchIndex,
      canRedo,
      canUndo,
      centerPopover,
      collaborators,
      cursorPositionLabel,
      documentSurface,
      editorHistoryCanRedo: editorHistoryState.canRedo,
      editorHistoryCanUndo: editorHistoryState.canUndo,
      editorRef,
      editorSurfaceRef,
      focusedCommentId,
      isLive,
      language: workspacePreferences.language,
      previewBody: renderedPreview.body,
      previewBodyStartOffset,
      previewBodyTextChange,
      previewMetadata: parsedMarkdown.attributes,
      previewRef,
      previewSurfaceRef,
      largeDocumentMode: activeDocument.largeDocumentMode,
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
      selectionActionPosition,
      splitDividerDragging,
      splitDividerMaxValue,
      splitDividerMinValue,
      splitDividerValue,
      splitWorkspaceStyle,
      statusLabel,
      text,
      toolbarLabel: workspaceChromeCopy.documentControls.documentToolbar,
      workspaceRef,
      onBookmarksChange: updateActiveFileBookmarks,
      onCloseSearch: documentWorkbenchRuntime.onCloseSearch,
      onCopyFile: copyCurrentFile,
      onEditorHistoryStateChange: handleEditorHistoryStateChange,
      onEditorScroll: handleEditorSurfaceScroll,
      onEditorScrollRatioChange: handleEditorScrollRatioChange,
      onEditorSelectionActionPositionChange:
        handleEditorSelectionActionPositionChange,
      onEditorSelectionChange: handleEditorSelectionChange,
      onFormat: documentWorkbenchRuntime.onFormat,
      onGoToSearchMatch: goToSearchMatch,
      onLineAction: handleStableLineAnnotationAction,
      onOpenComment: openStableCommentMarker,
      onOpenComments: documentWorkbenchRuntime.onOpenComments,
      onOpenSelectionComment: openSelectionComment,
      onPreviewKeyUp: syncPreviewSelection,
      onPreviewMouseUp: syncPreviewSelection,
      onPreviewScroll: handlePreviewScroll,
      onPreviewTouchEnd: syncPreviewSelection,
      onRedo: redoActiveFile,
      onReplaceAllMatches: replaceAllMatches,
      onReplaceCurrentMatch: replaceCurrentMatch,
      onResetSplitRatio: resetSplitRatio,
      onReplaceQueryChange: setReplaceQuery,
      onSearchQueryChange: setSearchQuery,
      onPreviewSearchMatchCountChange,
      onSelectAllSearchMatches: selectAllSearchMatches,
      onToggleSearchOption: toggleSearchOption,
      onSetReadingWidth: documentWorkbenchRuntime.onSetReadingWidth,
      onSetViewMode: setViewModeWithPendingCommit,
      onSplitDividerKeyDown: handleSplitDividerKeyDown,
      onSplitDividerPointerCancel: endSplitDividerDrag,
      onSplitDividerPointerDown: handleSplitDividerPointerDown,
      onSplitDividerPointerMove: handleSplitDividerPointerMove,
      onSplitDividerPointerUp: endSplitDividerDrag,
      onTextChange: handleTextChange,
      onToggleLineNumbers: documentWorkbenchRuntime.onToggleLineNumbers,
      onToggleLineWrapping: documentWorkbenchRuntime.onToggleLineWrapping,
      onToggleSearch: documentWorkbenchRuntime.onToggleSearch,
      onToggleSyncScrolling: documentWorkbenchRuntime.onToggleSyncScrolling,
      onToggleViewOptions: documentWorkbenchRuntime.onToggleViewOptions,
      onUndo: undoActiveFile,
    },
    rightPanelOpen,
  });
}
