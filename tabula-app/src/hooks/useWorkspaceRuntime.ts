import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createHelpMarkdown } from "../helpMarkdown";
import { getShortcutPlatform } from "../keyboardShortcuts";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import type { TextChange } from "@tabula-md/tabula";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import {
  createRoomWorkspaceState,
  createWorkspaceFile,
  finalizeWorkspaceState,
  randomId,
  readInitialWorkspaceSnapshot,
  README_FILE_ID,
  WORKSPACE_ROOT_FOLDER_ID,
  syncUrlForFile,
  type FileViewMode,
  type FileComment,
  type FileCommentReply,
  type LocationRoom,
  type WorkspaceFile,
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
import { useWorkspaceRoomProjection } from "./useWorkspaceRoomProjection";
import {
  getLiveRoomOpenState,
  LIVE_ROOM_OPEN_TIMEOUT_MS,
  type LiveRoomOpenFailure,
} from "../liveRoomOpenState";
import { readIndexedDbWorkspace } from "../workspaceIndexedDb";
import { clientErrorReporter } from "../observability/clientErrorReporting";

const createRoomBootstrapFile = (room: LocationRoom): WorkspaceFile =>
  createWorkspaceFile(1, {
    id: `room-bootstrap-${room.roomId}`,
    title: "Workspace",
    text: "",
    roomId: room.roomId,
    shareUrl: room.shareUrl,
    connectionStatus: "connecting",
  });

export function useWorkspaceRuntime() {
  const [initialWorkspaceSnapshot] = useState(() =>
    readInitialWorkspaceSnapshot(),
  );
  const initialWorkspace = initialWorkspaceSnapshot.workspace;
  const {
    folders,
    files,
    openFiles,
    openFileIds,
    activeFileId,
    activeFile,
    selectFile: selectWorkspaceFileAction,
    addFolder: addWorkspaceFolderAction,
    addFile: addWorkspaceFileAction,
    addFileFromContent,
    duplicateFile: duplicateWorkspaceFile,
    renameFile,
    closeFile: closeWorkspaceFileAction,
    deleteFile: deleteWorkspaceFileAction,
    deleteFolder: deleteWorkspaceFolderAction,
    moveFileToFolder,
    moveFolder,
    renameFolder,
    replaceWorkspace,
    restoreFile,
    restoreFolder: restoreWorkspaceFolderAction,
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
    setFileRecoveryEvent,
    setFolderCollaborationRoom,
    startFileCollaborationSession,
    stopFileCollaborationSession,
  } = useWorkspaceFiles({
    initialFiles: initialWorkspace.files,
    initialFolders: initialWorkspace.folders,
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
  const [activeRoom, setActiveRoom] = useState<LocationRoom | null>(() =>
    initialWorkspaceSnapshot.source === "room" ? (initialWorkspaceSnapshot.room ?? null) : null,
  );
  const [localPersistenceEnabled, setLocalPersistenceEnabled] = useState(
    () => initialWorkspaceSnapshot.source !== "room",
  );
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const editorDocumentRuntime = useWorkspaceEditorDocumentRuntimeOwner();
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement | null>(null);
  const [shortcutPlatform] = useState(() => getShortcutPlatform());
  const { dismissToast, pauseToast, resumeToast, toast, showToast } = useAppToast();
  const { identity, updateIdentityName, normalizeIdentityName } =
    useWorkspaceIdentity();
  const roomCommentActionsRef = useRef<{
    created: (fileId: string, comment: FileComment) => void;
    deleted: (fileId: string, commentId: string) => void;
    resolved: (fileId: string, commentId: string, resolved: boolean) => void;
    replied: (fileId: string, commentId: string, reply: FileCommentReply) => void;
  }>({
    created: () => undefined,
    deleted: () => undefined,
    resolved: () => undefined,
    replied: () => undefined,
  });
  const failedLiveRoomStartRef = useRef<string | null>(null);
  const [liveRoomOpenTimedOut, setLiveRoomOpenTimedOut] = useState(false);
  const [liveRoomOpenFailure, setLiveRoomOpenFailure] = useState<LiveRoomOpenFailure | null>(null);
  const syncedLiveRoomUrlRef = useRef<string | null>(null);
  const persistenceErrorShownRef = useRef(false);
  const activeRoomId = activeRoom?.roomId ?? activeFile?.roomId;
  const activeRoomShareUrl = activeRoom?.shareUrl ?? activeFile?.shareUrl;
  const collaborationRoomFile = useMemo(() => {
    if (!activeRoom) return activeFile;
    if (activeFile?.roomId === activeRoom.roomId) return activeFile;
    return files.find((file) => file.roomId === activeRoom.roomId) ?? createRoomBootstrapFile(activeRoom);
  }, [activeFile, activeRoom, files]);
  const activeRoomDocument =
    activeFile?.roomId && activeFile.roomId === activeRoomId ? activeFile : undefined;
  useEffect(() => {
    if (activeFile?.roomId && activeFile.shareUrl) {
      if (activeRoom?.roomId !== activeFile.roomId || activeRoom.shareUrl !== activeFile.shareUrl) {
        setActiveRoom({ roomId: activeFile.roomId, shareUrl: activeFile.shareUrl });
      }
      return;
    }

  }, [activeFile?.roomId, activeFile?.shareUrl, activeFile?.id, activeRoom]);
  const {
    commentsByFileId,
    commentDraft,
    focusedCommentId,
    activeReplyCommentId,
    replyDraftByCommentId,
    activeFileComments,
    activeOpenComments,
    setCommentDraft,
    setFocusedCommentId,
    replaceCommentsByFileId,
    addFileComment: createFileComment,
    mapFileCommentAnchors,
    deleteFileComment,
    restoreFileComment,
    deleteCommentsForFiles,
    restoreCommentsForFiles,
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
    onCommentCreated: (fileId, comment) => roomCommentActionsRef.current.created(fileId, comment),
    onCommentDeleted: (fileId, commentId) => roomCommentActionsRef.current.deleted(fileId, commentId),
    onCommentResolved: (fileId, commentId, resolved) => roomCommentActionsRef.current.resolved(fileId, commentId, resolved),
    onCommentReplyCreated: (fileId, commentId, reply) => roomCommentActionsRef.current.replied(fileId, commentId, reply),
  });
  const deleteFileCommentWithUndo = useEventCallback((fileId: string, commentId: string) => {
    const deletedComment = deleteFileComment(fileId, commentId);
    if (!deletedComment) return;
    showToast("Comment deleted.", "neutral", {
      actionLabel: "Undo",
      onAction: () => {
        if (restoreFileComment(deletedComment)) showToast("Comment restored.");
      },
    });
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
  const getCollaborationSessionFileSnapshot = useEventCallback(() => {
    const activeSnapshot = getActiveFileSnapshot();
    return activeSnapshot ?? files[0];
  });
  const getWorkspaceSnapshot = useEventCallback((): WorkspaceState => {
    const workspaceSnapshot = getWorkspaceStoreSnapshot();
    const activeFileSnapshot = getActiveFileSnapshot();
    return {
      ...workspaceSnapshot,
      folders,
      files: activeFileSnapshot
        ? workspaceSnapshot.files.map((file) =>
            file.id === activeFileSnapshot.id ? activeFileSnapshot : file,
          )
        : workspaceSnapshot.files,
      commentsByFileId,
    };
  });
  const handlePersistenceError = useEventCallback((error: unknown) => {
    clientErrorReporter.report({
      feature: "workspace",
      operation: "persist",
      error,
    });
    if (persistenceErrorShownRef.current) return;
    persistenceErrorShownRef.current = true;
    showToast("Changes couldn’t be saved in this browser.", "error");
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
    selectionActionPosition,
    setActiveFileViewMode,
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
  const workspacePersistenceSnapshot = useMemo<WorkspaceState>(
    () => ({
      folders,
      files,
      openFileIds,
      activeFileId,
      commentsByFileId,
    }),
    [activeFileId, commentsByFileId, files, folders, openFileIds],
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
    toggleWorkspaceMenu,
    toggleRightPanel,
  } = useWorkspaceChromeController({
    hasActiveFile: Boolean(activeFile),
    selectionActionPosition,
    setCopiedFileId,
    setSelectionActionPosition,
  });
  const {
    mergeWorkspaceRoomComments,
    mergeWorkspaceRoomSnapshot,
    workspaceShareComments,
    workspaceShareDocuments,
    workspaceShareFolders,
  } = useWorkspaceRoomProjection({
    activeFile,
    activeFileId,
    activeRoom,
    activeRoomId,
    activeRoomShareUrl,
    commentsByFileId,
    files,
    folders,
    getWorkspaceSnapshot,
    openFileIds,
    replaceCommentsByFileId,
    replaceWorkspace,
    rightPanelOpen,
    rightPanelView,
    selectFile: selectWorkspaceFileAction,
    setActiveRoom,
    setRightPanelOpen,
    setRightPanelView,
    showToast,
  });
  const handleRoomCapacityExceeded = useEventCallback(() => {
    showToast(
      "This room has reached its collaboration limit. Export a copy and start a new session.",
      "error",
    );
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
    editorBinding,
    materializeWorkspace: materializeRoomWorkspace,
    upsertComment: upsertRoomComment,
    deleteComment: deleteRoomComment,
    setCommentResolved: setRoomCommentResolved,
    addCommentReply: addRoomCommentReply,
    resetCollaborationState,
    retryConnection: retryCollaborationConnection,
  } = useWorkspaceCollaborationRuntime({
    roomFile: collaborationRoomFile,
    activeDocument: activeRoomDocument,
    activeSelection: activeRoomDocument ? activeSelection : undefined,
    editorPresenceEnabled: Boolean(activeRoomDocument) && activeViewMode !== "preview",
    editorDocumentRuntime,
    getActiveFileSnapshot: getCollaborationSessionFileSnapshot,
    identity,
    workspaceDocuments: workspaceShareDocuments,
    workspaceFolders: workspaceShareFolders,
    commentsByFileId: workspaceShareComments,
    setFileText,
    setFileCollaborationStatus,
    setFileRecoveryEvent,
    startFileCollaborationSession,
    onWorkspaceChange: mergeWorkspaceRoomSnapshot,
    onCommentsChange: mergeWorkspaceRoomComments,
    onOpenFailure: setLiveRoomOpenFailure,
    onCapacityExceeded: handleRoomCapacityExceeded,
  });
  useEffect(() => {
    const isSharedRoomFile = (fileId: string) =>
      Boolean(activeRoomId && files.some((file) => file.id === fileId && file.roomId === activeRoomId));
    roomCommentActionsRef.current = {
      created: (fileId, comment) => {
        if (!isSharedRoomFile(fileId)) return;
        upsertRoomComment({
          ...comment,
          fileId,
          resolved: comment.resolved ?? false,
          replies: comment.replies ?? [],
        });
      },
      deleted: (fileId, commentId) => {
        if (isSharedRoomFile(fileId)) deleteRoomComment(commentId);
      },
      resolved: (fileId, commentId, resolved) => {
        if (isSharedRoomFile(fileId)) setRoomCommentResolved(commentId, resolved);
      },
      replied: (fileId, commentId, reply) => {
        if (isSharedRoomFile(fileId)) addRoomCommentReply(commentId, reply);
      },
    };
    return () => {
      roomCommentActionsRef.current = {
        created: () => undefined,
        deleted: () => undefined,
        resolved: () => undefined,
        replied: () => undefined,
      };
    };
  }, [activeRoomId, addRoomCommentReply, deleteRoomComment, files, setRoomCommentResolved, upsertRoomComment]);
  const isLiveConnected = isLive && connectionStatus === "connected";
  const isLiveChromeVisible = isLive && !liveRoomOpenFailure && !liveRoomOpenTimedOut;
  const {
    canRedo,
    canUndo,
    clearFileHistory,
    editorHistoryState,
    handleEditorHistoryStateChange,
    handleTextChange,
    flushPendingEditorCommit,
    historyByFileId,
    redoActiveFile,
    setHistoryByFileId,
    undoActiveFile,
    updateActiveFileBookmarks,
  } = useWorkspaceActiveFileEditor({
    activeFile,
    applyLocalText,
    collaborationBound: Boolean(editorBinding),
    editorDocumentRuntime,
    editorRef,
    onTextPatches: mapFileCommentAnchors,
    onVisibleTextChange: bumpVisibleTextRevision,
    setActiveFileBookmarks,
    setActiveFileText,
    setFileText,
  });
  const localWorkspacePersistence = useWorkspacePersistenceRuntime({
    enabled: localPersistenceEnabled,
    getWorkspaceSnapshot,
    initialWorkspace,
    onError: handlePersistenceError,
    onBeforePersist: flushPendingEditorCommit,
    workspace: workspacePersistenceSnapshot,
    replaceCommentsByFileId,
    replaceWorkspace,
  });
  const { copyShareUrl, jsonShare, startSession, stopSession } =
    useWorkspaceShareRuntime({
      activeFile,
      roomFile: collaborationRoomFile,
      activeText: text,
      commentsByFileId,
      copy: workspaceShareCopy,
      files,
      folders,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary: flushPendingEditorCommit,
      resetCollaborationState,
      retryCollaborationConnection,
      setCopiedFileId,
      showToast,
      startCollaborationSession,
      stopFileCollaborationSession,
    });
  useEffect(() => {
    if (!activeRoom || activeFile || connectionStatus !== "connected") {
      setLiveRoomOpenTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLiveRoomOpenTimedOut(true);
    }, LIVE_ROOM_OPEN_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeFile, activeRoom, connectionStatus]);
  const retryOpeningLiveRoom = useEventCallback(() => {
    setLiveRoomOpenTimedOut(false);
    setLiveRoomOpenFailure(null);
    retryCollaborationConnection();
  });
  const openLocalWorkspaceAfterRoomFailure = useEventCallback(() => {
    flushPendingEditorCommit();
    stopSession();
    resetCollaborationState("idle");
    setActiveRoom(null);
    setLiveRoomOpenFailure(null);
    setLocalPersistenceEnabled(true);
    syncUrlForFile(undefined, "replace");
    void readIndexedDbWorkspace()
      .then((storedWorkspace) => {
        const nextStoredWorkspace = storedWorkspace ?? finalizeWorkspaceState([], undefined, {}, { includeLocationRoom: false });
        replaceWorkspace(nextStoredWorkspace);
        replaceCommentsByFileId(nextStoredWorkspace.commentsByFileId);
      })
      .catch(handlePersistenceError);
  });
  const copyShareUrlWithPendingCommit = useEventCallback(() => {
    flushPendingEditorCommit();
    void copyShareUrl();
  });
  const startSessionWithPendingCommit = useEventCallback(async () => {
    flushPendingEditorCommit();
    try {
      const startedSession = await startSession();
      if (!startedSession) return;

      setLocalPersistenceEnabled(false);
      setLiveRoomOpenFailure(null);
      setActiveRoom(startedSession);
      for (const folder of workspaceShareFolders) {
        if (folder.id !== WORKSPACE_ROOT_FOLDER_ID) {
          setFolderCollaborationRoom(folder.id, startedSession.roomId);
        }
      }
      for (const file of files) {
        if (file.id === startedSession.fileId) continue;
        startFileCollaborationSession(file.id, startedSession.roomId, startedSession.shareUrl);
        setFileCollaborationStatus(file.id, "idle");
      }
    } catch (error) {
      clientErrorReporter.report({
        feature: "collaboration",
        operation: "start-session",
        error,
      });
      setTopPopover(null);
      showToast("Live collaboration isn’t available right now.", "error");
    }
  });
  const stopSessionWithPendingCommit = useEventCallback(() => {
    const roomId = activeFile?.roomId ?? activeRoom?.roomId;
    const workspaceRoomFileIds = roomId ? files.filter((file) => file.roomId === roomId).map((file) => file.id) : [];
    flushPendingEditorCommit();
    const roomSnapshot = materializeRoomWorkspace();
    if (roomSnapshot) mergeWorkspaceRoomSnapshot(roomSnapshot);
    stopSession();
    if (!activeFile?.roomId) {
      resetCollaborationState("idle");
      syncUrlForFile(undefined, "replace");
    }
    setActiveRoom(null);
    setLiveRoomOpenFailure(null);
    setLocalPersistenceEnabled(true);
    for (const fileId of workspaceRoomFileIds) {
      if (fileId !== activeFile?.id) {
        stopFileCollaborationSession(fileId);
      }
    }
    if (roomId) {
      for (const folder of folders) {
        if (folder.roomId === roomId) setFolderCollaborationRoom(folder.id);
      }
    }
  });
  useEffect(() => {
    const roomId = activeRoomId;
    if (!roomId || connectionStatus !== "failed") {
      return;
    }
    if (activeRoom && !activeFile) {
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
    activeRoomId,
    connectionStatus,
    setTopPopover,
    showToast,
    stopSessionWithPendingCommit,
  ]);
  useEffect(() => {
    if (connectionStatus === "connected" || !activeRoomId) {
      failedLiveRoomStartRef.current = null;
    }
  }, [activeRoomId, connectionStatus]);
  useEffect(() => {
    if (!activeRoomId || !activeRoomShareUrl || !collaborationRoomFile) {
      syncedLiveRoomUrlRef.current = null;
      return;
    }
    if (connectionStatus !== "connected") {
      return;
    }
    if (syncedLiveRoomUrlRef.current === activeRoomId) {
      return;
    }

    syncedLiveRoomUrlRef.current = activeRoomId;
    syncUrlForFile(collaborationRoomFile);
  }, [activeRoomId, activeRoomShareUrl, collaborationRoomFile, connectionStatus]);
  const handleRouteWorkspaceChange = useEventCallback(() => {
    setTopPopover(null);
    setCenterPopover(null);
    setCopiedFileId(null);
  });
  const activateRoomWorkspace = useEventCallback((room: LocationRoom) => {
    setLocalPersistenceEnabled(false);
    setLiveRoomOpenFailure(null);
    setActiveRoom(room);
    replaceWorkspace(createRoomWorkspaceState(room));
  });
  useWorkspaceRouteRuntime({
    activeFileId,
    activateRoomFile: activateRoomWorkspace,
    files,
    onBeforeWorkspaceBoundary: flushPendingEditorCommit,
    selectFile: selectWorkspaceFileAction,
    onRouteWorkspaceChange: handleRouteWorkspaceChange,
    onLeaveRoom: () => setActiveRoom(null),
  });

  useSelectionActionDismissal({
    selectionActionPosition,
    setSelectionActionPosition,
  });

  const {
    closeJsonShareImport,
    copyFile,
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
    roomFile: activeRoom ? collaborationRoomFile : undefined,
    activeFileId,
    addFileFromContent,
    clearFileHistory,
    closeFloatingChrome,
    commentsByFileId,
    editorRef,
    files,
    folders,
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
    roomFile: activeRoom ? collaborationRoomFile : undefined,
    activeFileId,
    addFileFromContent,
    addWorkspaceFileAction,
    closeFloatingChrome,
    closeWorkspaceFileAction,
    commentsByFileId,
    deleteWorkspaceFileAction,
    duplicateWorkspaceFile,
    files,
    helpMarkdown: createHelpMarkdown(shortcutPlatform),
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
  const addWorkspaceFolder = useEventCallback((parentId?: string) => {
    const folder = addWorkspaceFolderAction("New folder", parentId, activeRoomId);
    if (!folder) {
      showToast("Folders can be nested up to 32 levels.", "error");
      return;
    }
    return folder;
  });
  const {
    activeCommentAnchors,
    activePreviewCommentAnchors,
    activePreviewLineAnnotations,
    addFileComment,
    cancelSelectionComment,
    formatCommentDate,
    goToFileComment,
    handleLineAnnotationAction,
    openCommentMarker,
    openSelectionComment,
    pendingSelectionCommentText,
    selectionCommentPending,
    consumeSelectionCommentRequest,
    startCommentReply,
  } = useWorkspaceCommentActions({
    activeBookmarks,
    activeFile,
    activeFileComments,
    activeOpenComments,
    commentDraft,
    commentInputRef,
    createFileComment,
    createId: randomId,
    files,
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
    setCenterPopover,
    setFocusedCommentId,
    setRightPanelOpen,
    setRightPanelView,
    setSelectionActionPosition,
    setTopPopover,
    showToast,
    startCommentReply: beginCommentReply,
    queueEditorTextRange,
    text,
  });
  const { menuSurfaceProps } = useWorkspaceMenuRuntime({
    importInputRef,
    isOpen: workspaceMenuOpen,
    onAddFile: addFile,
    onCloseChrome: closeFloatingChrome,
    onImportFileChange: handleImportInputChange,
    onImportProjectChange: handleProjectImportInputChange,
    onOpenAbout: openAboutFile,
    onOpenHelp: openHelpFile,
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
  const { projectContextProps } =
    useWorkspaceProjectContextRuntime({
      activeCommentId: focusedCommentId,
      activeFile,
      activeFileTitle,
      activeReplyCommentId,
      activeSelection,
      activeViewMode,
      commentDraft,
      commentInputRef,
      commentsByFileId,
      files,
      folders,
      focusTextRange,
      formatCommentDate,
      identityName: identity.name,
      isLive: isLiveChromeVisible,
      language: workspacePreferences.language,
      onAddComment: addFileComment,
      onAddCommentReply: addFileCommentReply,
      onCancelSelectionComment: cancelSelectionComment,
      onCancelCommentReply: cancelCommentReply,
      onCommentDraftChange: setCommentDraft,
      onDeleteComment: deleteFileCommentWithUndo,
      onDeleteFile: deleteFile,
      onDeleteFolder: (folderId) => {
        const deletedBundle = deleteWorkspaceFolderAction(folderId);
        if (!deletedBundle) return;
        const deletedFileIds = new Set(deletedBundle.files.map(({ item }) => item.id));
        const deletedComments = deleteCommentsForFiles(deletedFileIds);
        const deletedHistory = Object.fromEntries(
          Object.entries(historyByFileId).filter(([fileId]) => deletedFileIds.has(fileId)),
        );
        setHistoryByFileId((currentHistory) =>
          Object.fromEntries(
            Object.entries(currentHistory).filter(([fileId]) => !deletedFileIds.has(fileId)),
          ),
        );
        const deletedActiveFile = deletedFileIds.has(deletedBundle.previousActiveFileId);
        if (deletedActiveFile) syncUrlForFile(getWorkspaceStoreActiveFile(), "replace");
        showToast("Folder deleted.", "neutral", {
          actionLabel: "Undo",
          onAction: () => {
            const restoredActiveFile = restoreWorkspaceFolderAction(deletedBundle);
            restoreCommentsForFiles(deletedComments);
            setHistoryByFileId((currentHistory) => ({
              ...currentHistory,
              ...deletedHistory,
            }));
            if (deletedActiveFile) syncUrlForFile(restoredActiveFile, "replace");
            showToast("Folder restored.");
          },
        });
      },
      onDuplicateFile: duplicateFile,
      onCopyFile: copyFile,
      onGoToComment: goToFileComment,
      onIdentityNameChange: updateIdentityName,
      onIdentityNameCommit: normalizeIdentityName,
      onImportFile: () => importInputRef.current?.click(),
      onNewFile: addFile,
      onNewFolder: addWorkspaceFolder,
      onRenameFile: renameWorkspaceFileAction,
      onRenameFolder: renameFolder,
      onMoveFileToFolder: (fileId, folderId) => {
        moveFileToFolder(fileId, folderId);
      },
      onMoveFolder: (folderId, parentId) => {
        if (!moveFolder(folderId, parentId)) {
          showToast("This folder can’t be moved there.", "error");
        }
      },
      onReplyDraftChange: updateCommentReplyDraft,
      onRequestTextSelection: () => setRightPanelOpen(false),
      onSelectFile: selectFile,
      onStartCommentReply: startCommentReply,
      onToggleCommentResolved: toggleFileCommentResolved,
      outlineHeadings,
      parsedMarkdownBody: parsedMarkdown.body,
      previewSurfaceRef,
      replyDraftByCommentId,
      rightPanelOpen,
      rightPanelView,
      selectedCharacterCount,
      pendingSelectionText: pendingSelectionCommentText,
      selectionCommentPending,
      onSelectionCommentRequestHandled: consumeSelectionCommentRequest,
      setRightPanelOpen,
      setRightPanelView,
      text,
    });
  const { shareOpen, topChromeProps } = useWorkspaceTopChromeRuntime({
    activeFile,
    activeText: text,
    canStartSession,
    collaborators,
    connectionStatus,
    copiedFileId,
    currentUserName: identity.name,
    files,
    folders,
    identity: presenceIdentity,
    isLive: isLiveChromeVisible,
    isLiveConnected,
    jsonShare,
    language: workspacePreferences.language,
    openFiles,
    roomFile: collaborationRoomFile,
    rightPanelOpen,
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
      activeSyncScrolling: workspacePreferences.syncScrolling,
      activeViewMode,
      editorRef,
      searchOpen,
      selectedCharacterCount,
      selectionActionPosition,
      shareOpen,
      splitDividerDragging,
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
      dropActive: emptyDropActive,
      language: workspacePreferences.language,
      shortcutPlatform,
      workspaceRef,
      onBrowseFiles: openFilesPanel,
      onDragLeave: handleEmptyWorkspaceDragLeave,
      onDragOver: handleEmptyWorkspaceDragOver,
      onDrop: handleEmptyWorkspaceDrop,
      onNewFile: addFile,
      onOpenFile: () => importInputRef.current?.click(),
      onOpenHelp: openHelpFile,
    },
    liveRoomLoadingProps: {
      language: workspacePreferences.language,
      onOpenLocalWorkspace: openLocalWorkspaceAfterRoomFailure,
      onRetry: retryOpeningLiveRoom,
    },
    localWorkspaceOpening: localPersistenceEnabled && localWorkspacePersistence.pending,
    liveRoomOpenState: getLiveRoomOpenState({
      connectionStatus,
      hasActiveFile: Boolean(activeFile),
      hasActiveRoom: Boolean(activeRoom),
      timedOut: liveRoomOpenTimedOut,
      failure: liveRoomOpenFailure,
    }),
    menuSurfaceProps,
    overlayProps: {
      jsonShareImport,
      language: workspacePreferences.language,
      toast,
      onDismissToast: dismissToast,
      onPauseToast: pauseToast,
      onResumeToast: resumeToast,
      onCloseJsonShareImport: closeJsonShareImport,
      onReplaceWorkspaceWithJsonShare: replaceWorkspaceWithJsonShare,
    },
    projectContextProps,
    topChromeProps,
    workbenchProps: {
      activeBookmarks,
      activeCommentAnchors,
      activeFile,
      activeLineNumbers,
      activeLineWrapping,
      activeSyncScrolling: workspacePreferences.syncScrolling,
      activePreviewCommentAnchors,
      activePreviewLineAnnotations,
      activeSearchMatchIndex,
      activeSelection,
      canRedo,
      canUndo,
      centerPopover,
      collaborationBinding: editorBinding,
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
      saveRevision: localWorkspacePersistence.persistedRevision,
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
