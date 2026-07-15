import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getShortcutPlatform } from "../keyboardShortcuts";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import {
  type TextChange,
  type WorkspaceRoomComment,
  type WorkspaceRoomSnapshot,
  type WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import { loadMarkdownPreview } from "../preview/markdownPreviewLoader";
import {
  clearWorkspaceDocumentBodies,
  materializeWorkspaceRoomSnapshot,
  projectWorkspaceRoomComments,
  projectWorkspaceRoomStructure,
} from "../collaboration/workspaceRoomProjection";
import {
  readRoomViewState,
  restoreRoomWorkspaceView,
  writeRoomViewState,
} from "../collaboration/roomViewState";
import {
  createStarterWorkspaceState,
  createRoomWorkspaceState,
  createWorkspaceFile,
  randomId,
  readInitialWorkspaceSnapshot,
  README_FILE_ID,
  WORKSPACE_ROOT_FOLDER_ID,
  syncUrlForLocalWorkspace,
  syncUrlForRoom,
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
import { getWorkspaceActionCopy } from "../workspaceActionLocale";
import {
  getWorkspaceStoreActiveFile,
  getWorkspaceStoreFolder,
  getWorkspaceStoreForMode,
  getWorkspaceStoreSnapshot,
  type DeletedWorkspaceFolderBundle,
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
import { useCollaborationPresenceRuntime } from "./useCollaborationPresenceRuntime";
import { useWorkspaceCommentActions } from "./useWorkspaceCommentActions";
import { useWorkspaceDocumentRuntime } from "./useWorkspaceDocumentRuntime";
import { useWorkspaceFileActions } from "./useWorkspaceFileActions";
import { useWorkspaceFolderActions } from "./useWorkspaceFolderActions";
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
import {
  getLiveRoomOpenState,
  LIVE_ROOM_OPEN_TIMEOUT_MS,
  type LiveRoomOpenFailure,
} from "../liveRoomOpenState";
import { readIndexedDbWorkspace } from "../workspaceIndexedDb";
import { clientErrorReporter } from "../observability/clientErrorReporting";
import { useParticipantFollowController } from "./useParticipantFollowController";
import { createActiveRoomDocumentProjectionStore } from "../collaboration/runtime/ActiveRoomDocumentProjectionStore";
import {
  createLocalWorkspaceSession,
  createRoomWorkspaceSession,
} from "../workspace/session/WorkspaceSession";
import {
  createWorkspaceSessionHost,
  type WorkspaceSessionHost,
} from "../workspace/session/WorkspaceSessionHost";
import type { WorkspaceInfoDialogKind } from "../components/WorkspaceInfoDialog";

export function useWorkspaceRuntime() {
  const [initialWorkspaceSnapshot] = useState(() =>
    readInitialWorkspaceSnapshot(),
  );
  const initialWorkspace = initialWorkspaceSnapshot.workspace;
  const restoredRoomViewsRef = useRef(new Set<string>());
  const workspaceSessionHostRef = useRef<WorkspaceSessionHost | null>(null);
  if (!workspaceSessionHostRef.current) {
    const initialRoom = initialWorkspaceSnapshot.source === "room"
      ? initialWorkspaceSnapshot.room
      : null;
    workspaceSessionHostRef.current = createWorkspaceSessionHost(
      initialRoom ? createRoomWorkspaceSession(initialRoom) : createLocalWorkspaceSession(),
    );
  }
  const workspaceSessionHost = workspaceSessionHostRef.current;
  const workspaceSession = useSyncExternalStore(
    workspaceSessionHost.subscribe,
    workspaceSessionHost.getSnapshot,
    workspaceSessionHost.getSnapshot,
  );
  const activeRoomSession = workspaceSession.mode === "room" ? workspaceSession : null;
  const activeRoom = activeRoomSession?.room ?? null;
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
  } = useWorkspaceFiles({
    initialFiles: initialWorkspace.files,
    initialFolders: initialWorkspace.folders,
    initialOpenFileIds: initialWorkspace.openFileIds,
    initialActiveFileId: initialWorkspace.activeFileId,
    readmeFileId: README_FILE_ID,
    createFile: createWorkspaceFile,
    store: workspaceSession.viewStore,
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
  const workspaceMenuCopy = getWorkspaceMenuCopy(workspacePreferences.language);
  const workspaceActionCopy = getWorkspaceActionCopy(workspacePreferences.language);
  const workspaceShareCopy = workspaceMenuCopy.share;
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const followState = useSyncExternalStore(
    workspaceSession.follow.subscribe,
    workspaceSession.follow.getSnapshot,
    workspaceSession.follow.getSnapshot,
  );
  const localPersistenceEnabled = workspaceSession.mode === "local";
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const editorDocumentRuntime = useWorkspaceEditorDocumentRuntimeOwner();
  const [roomDocumentProjectionStore] = useState(() =>
    createActiveRoomDocumentProjectionStore());
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement | null>(null);
  const [shortcutPlatform] = useState(() => getShortcutPlatform());
  const [infoDialog, setInfoDialog] = useState<WorkspaceInfoDialogKind | null>(null);
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
  const materializeRoomWorkspaceRef = useRef<() => WorkspaceRoomSnapshot | undefined>(() => undefined);
  const failedLiveRoomStartRef = useRef<string | null>(null);
  const [liveRoomOpenTimedOut, setLiveRoomOpenTimedOut] = useState(false);
  const [liveRoomOpenFailure, setLiveRoomOpenFailure] = useState<LiveRoomOpenFailure | null>(null);
  const syncedLiveRoomUrlRef = useRef<string | null>(null);
  const persistenceErrorShownRef = useRef(false);
  const activeRoomId = activeRoom?.roomId;
  const activeRoomDocument = activeRoom ? activeFile : undefined;
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
    isRoomSession: Boolean(activeRoom),
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
    showToast(workspaceActionCopy.commentDeleted, "neutral", {
      actionLabel: workspaceActionCopy.undo,
      onAction: () => {
        if (restoreFileComment(deletedComment)) showToast(workspaceActionCopy.commentRestored);
      },
    });
  });
  const getActiveFileSnapshot = useEventCallback(() => {
    const latestActiveFile = getWorkspaceStoreActiveFile(workspaceSession.mode) ?? activeFile;
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
    const workspaceSnapshot = getWorkspaceStoreSnapshot(workspaceSession.mode);
    const activeFileSnapshot = getActiveFileSnapshot();
    const roomSnapshot = activeRoom ? materializeRoomWorkspaceRef.current() : undefined;
    if (roomSnapshot) {
      const materializedWorkspace = materializeWorkspaceRoomSnapshot({
        createFile: createWorkspaceFile,
        snapshot: roomSnapshot,
        workspaceSnapshot: {
          ...workspaceSnapshot,
          folders,
          files: workspaceSnapshot.files,
        },
      });
      return {
        ...materializedWorkspace,
        commentsByFileId: projectWorkspaceRoomComments(roomSnapshot.commentsByFileId),
      };
    }
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
    showToast(workspaceActionCopy.browserSaveFailed, "error");
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
    isRoomSession: Boolean(activeRoom),
    roomDocumentProjectionStore,
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
    selectionActionPosition,
    setCopiedFileId,
    setSelectionActionPosition,
  });
  const openInfoDialog = useEventCallback((kind: WorkspaceInfoDialogKind) => {
    closeFloatingChrome();
    setInfoDialog(kind);
  });
  const openAbout = useEventCallback(() => openInfoDialog("about"));
  const openHelp = useEventCallback(() => openInfoDialog("help"));
  const mergeWorkspaceRoomStructure = useEventCallback((
    snapshot: WorkspaceRoomStructureSnapshot,
  ) => {
    if (activeRoomId && snapshot.roomId !== activeRoomId) return;
    const workspaceSnapshot = {
      ...getWorkspaceStoreSnapshot("room"),
      folders,
    };
    const previousRoomFiles = workspaceSnapshot.files;
    const previousRoomFilesById = new Map(previousRoomFiles.map((file) => [file.id, file]));
    const nextDocumentNodes = snapshot.nodes.filter((node) => node.type === "document");
    const nextDocumentIds = new Set(nextDocumentNodes.map((node) => node.id));
    const addedDocuments = nextDocumentNodes.filter((node) => !previousRoomFilesById.has(node.id));
    const deletedDocuments = previousRoomFiles.filter((file) => !nextDocumentIds.has(file.id));
    const renamedDocuments = nextDocumentNodes.filter((node) => {
      const previous = previousRoomFilesById.get(node.id);
      return previous && previous.title !== node.title;
    });
    const previousRoomFolderSignature = workspaceSnapshot.folders
      .filter((folder) => folder.id !== snapshot.rootId)
      .map((folder) => [folder.id, folder.title, folder.parentId, folder.order ?? 0])
      .sort(([firstId], [secondId]) => String(firstId).localeCompare(String(secondId)));
    const nextRoomFolderSignature = snapshot.nodes
      .filter((node) => node.type === "folder" && node.id !== snapshot.rootId)
      .map((node) => [node.id, node.title, node.parentId, node.order ?? 0])
      .sort(([firstId], [secondId]) => String(firstId).localeCompare(String(secondId)));
    const foldersChanged = JSON.stringify(previousRoomFolderSignature) !== JSON.stringify(nextRoomFolderSignature);
    let nextWorkspace = projectWorkspaceRoomStructure({
      createFile: createWorkspaceFile,
      snapshot,
      workspaceSnapshot,
    });
    if (!restoredRoomViewsRef.current.has(snapshot.roomId)) {
      const roomViewState = readRoomViewState(snapshot.roomId);
      nextWorkspace = restoreRoomWorkspaceView(nextWorkspace, roomViewState);
      restoredRoomViewsRef.current.add(snapshot.roomId);
      if (roomViewState) {
        setRightPanelView(roomViewState.rightPanelView);
        setRightPanelOpen(roomViewState.rightPanelOpen);
      }
    }
    replaceWorkspace(nextWorkspace);
    const deletedActiveFile = deletedDocuments.find((file) => file.id === workspaceSnapshot.activeFileId);
    if (deletedActiveFile) {
      const nextActiveTitle = nextWorkspace.files.find(
        (file) => file.id === nextWorkspace.activeFileId,
      )?.title;
      showToast(
        nextActiveTitle
          ? `Another participant deleted ${deletedActiveFile.title}. Opened ${nextActiveTitle}.`
          : `Another participant deleted ${deletedActiveFile.title} from the room.`,
      );
    } else if (addedDocuments.length === 1 && deletedDocuments.length === 0 && renamedDocuments.length === 0) {
      const addedDocument = addedDocuments[0];
      showToast(workspaceActionCopy.documentAdded(addedDocument.title), "neutral", {
        actionLabel: "Open",
        onAction: () => selectWorkspaceFileAction(addedDocument.id),
      });
    } else if (renamedDocuments.length === 1 && addedDocuments.length === 0 && deletedDocuments.length === 0) {
      const renamedDocument = renamedDocuments[0];
      showToast(workspaceActionCopy.documentRenamed(
        previousRoomFilesById.get(renamedDocument.id)?.title ?? renamedDocument.title,
        renamedDocument.title,
      ));
    } else if (addedDocuments.length || deletedDocuments.length || renamedDocuments.length || foldersChanged) {
      showToast(workspaceActionCopy.sharedWorkspaceUpdated);
    }
  });
  useEffect(() => {
    if (!activeRoomId) return;
    writeRoomViewState(activeRoomId, {
      activeDocumentId: activeFileId || undefined,
      openDocumentIds: openFileIds,
      rightPanelOpen,
      rightPanelView,
    });
  }, [activeFileId, activeRoomId, files, openFileIds, rightPanelOpen, rightPanelView]);
  const sessionStartDocuments = useMemo(
    () => activeRoom ? [] : files.map((file) => ({
          id: file.id,
          title: file.title,
          text: file.text,
          parentId: file.parentId,
          order: file.order,
        })),
    [activeRoom, files],
  );
  const sessionStartFolders = useMemo(
    () => activeRoom ? [] : folders,
    [activeRoom, folders],
  );
  const sessionStartComments = useMemo<Record<string, WorkspaceRoomComment[]>>(() => {
    const documentIds = new Set(sessionStartDocuments.map((document) => document.id));
    return Object.fromEntries(
      Object.entries(commentsByFileId)
        .filter(([fileId]) => documentIds.has(fileId))
        .map(([fileId, comments]) => [fileId, comments.map((comment) => ({
          ...comment,
          fileId,
          resolved: comment.resolved ?? false,
          replies: comment.replies ?? [],
        }))]),
    );
  }, [commentsByFileId, sessionStartDocuments]);
  const replaceActiveRoomComments = useEventCallback((
    documentId: string | undefined,
    comments: readonly WorkspaceRoomComment[],
  ) => {
    replaceCommentsByFileId(
      documentId
        ? projectWorkspaceRoomComments({ [documentId]: [...comments] })
        : {},
      { preserveInteraction: true },
    );
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
    statusLabel,
    startSession: startCollaborationSession,
    applyLocalText,
    activeDocumentProjection,
    activeDocumentComments,
    createDocument: createRoomDocument,
    createFolder: createRoomFolder,
    renameNode: renameRoomNode,
    moveNode: moveRoomNode,
    deleteNode: deleteRoomNode,
    setFollowingActor: setRoomFollowingActor,
    setViewport: setRoomViewport,
    editorBinding,
    materializeWorkspace: materializeRoomWorkspace,
    materializeDocument: materializeRoomDocument,
    materializeDocumentComments: materializeRoomDocumentComments,
    structureSnapshot: roomStructureSnapshot,
    upsertComment: upsertRoomComment,
    deleteComment: deleteRoomComment,
    setCommentResolved: setRoomCommentResolved,
    addCommentReply: addRoomCommentReply,
    resetCollaborationState,
    retryConnection: retryCollaborationConnection,
  } = useWorkspaceCollaborationRuntime({
    session: activeRoomSession,
    activeDocument: activeFile,
    editorPresenceEnabled:
      Boolean(activeRoomDocument) &&
      activeViewMode !== "preview" &&
      followState.status === "idle",
    getActiveFileSnapshot: getCollaborationSessionFileSnapshot,
    identity,
    workspaceDocuments: sessionStartDocuments,
    workspaceFolders: sessionStartFolders,
    commentsByFileId: sessionStartComments,
    onOpenFailure: setLiveRoomOpenFailure,
    onCapacityExceeded: handleRoomCapacityExceeded,
  });
  materializeRoomWorkspaceRef.current = materializeRoomWorkspace;
  useEffect(() => {
    if (!activeRoomId || !roomStructureSnapshot || roomStructureSnapshot.roomId !== activeRoomId) return;
    mergeWorkspaceRoomStructure(roomStructureSnapshot);
  }, [activeRoomId, mergeWorkspaceRoomStructure, roomStructureSnapshot]);
  useEffect(() => {
    if (!activeRoomId) return;
    replaceActiveRoomComments(activeRoomDocument?.id, activeDocumentComments);
  }, [activeDocumentComments, activeRoomDocument?.id, activeRoomId, replaceActiveRoomComments]);
  const presenceIdentity = useCollaborationPresenceRuntime({
    activeDocumentId: activeRoomDocument?.id,
    activeSelection: activeRoomDocument ? activeSelection : undefined,
    fileTitle: activeRoomDocument?.title,
    identity,
    isLive,
    roomId: activeRoomId,
  });
  useEffect(() => {
    if (activeRoomDocument && activeDocumentProjection !== null) {
      if (roomDocumentProjectionStore.set(activeRoomDocument.id, activeDocumentProjection)) {
        bumpVisibleTextRevision();
      }
      return;
    }
    if (!activeRoomDocument && roomDocumentProjectionStore.clear()) {
      bumpVisibleTextRevision();
    }
  }, [activeDocumentProjection, activeRoomDocument?.id, roomDocumentProjectionStore]);
  const publishCurrentRoomViewport = useEventCallback(() => {
    const viewport = editorRef.current?.getViewport();
    setRoomViewport(
      viewport && activeRoomDocument
        ? { documentId: activeRoomDocument.id, ...viewport }
        : null,
    );
  });
  useEffect(() => {
    if (!editorBinding || !activeRoomDocument || activeViewMode === "preview") {
      setRoomViewport(null);
      return;
    }
    const frame = window.requestAnimationFrame(publishCurrentRoomViewport);
    return () => window.cancelAnimationFrame(frame);
  }, [activeRoomDocument?.id, activeViewMode, editorBinding?.documentId]);
  const {
    stopFollowing,
    stopFollowingForLocalNavigation,
    toggleFollowing,
  } = useParticipantFollowController({
    activeDocumentId: activeFileId,
    collaborators,
    editorRef,
    files,
    followState,
    identityId: identity.id,
    isLive,
    roomId: activeRoomId,
    selectDocument: selectWorkspaceFileAction,
    startFollowState: workspaceSession.follow.start,
    stopFollowState: workspaceSession.follow.stop,
    setFollowingActor: setRoomFollowingActor,
    showError: (message) => showToast(message, "error"),
    showNotice: showToast,
  });
  const publishRoomDocument = useEventCallback((file: WorkspaceFile) =>
    !activeRoom || createRoomDocument({
      id: file.id,
      title: file.title,
      markdown: file.text,
      parentId: file.parentId ?? WORKSPACE_ROOT_FOLDER_ID,
      order: file.order,
    }));
  const publishRoomDocumentProjection = useEventCallback((file: WorkspaceFile) => {
    if (!publishRoomDocument(file)) return false;
    return true;
  });
  const restoreRoomDocument = useEventCallback((file: WorkspaceFile, comments: FileComment[]) => {
    if (!publishRoomDocument(file)) return false;
    for (const comment of comments) {
      upsertRoomComment({
        ...comment,
        fileId: file.id,
        resolved: comment.resolved ?? false,
        replies: comment.replies ?? [],
      });
    }
    return true;
  });
  const publishRoomFolder = useEventCallback((folder: (typeof folders)[number]) =>
    !activeRoom || createRoomFolder({
      id: folder.id,
      title: folder.title,
      parentId: folder.parentId ?? WORKSPACE_ROOT_FOLDER_ID,
      order: folder.order,
    }));
  const restoreRoomFolderBundle = useEventCallback((bundle: DeletedWorkspaceFolderBundle) => {
    const restoredFolders = bundle.folders.map(({ item }) => item);
    const restoredFolderIds = new Set(restoredFolders.map((folder) => folder.id));
    const foldersById = new Map(restoredFolders.map((folder) => [folder.id, folder]));
    const getDepth = (folderId: string) => {
      let depth = 0;
      let current = foldersById.get(folderId);
      const visited = new Set<string>();
      while (current && restoredFolderIds.has(current.parentId ?? "")) {
        if (visited.has(current.id)) return Number.POSITIVE_INFINITY;
        visited.add(current.id);
        depth += 1;
        current = foldersById.get(current.parentId ?? "");
      }
      return depth;
    };
    for (const folder of [...restoredFolders].sort((first, second) => getDepth(first.id) - getDepth(second.id))) {
      if (!publishRoomFolder(folder)) return false;
    }
    for (const { item: file } of bundle.files) {
      if (!publishRoomDocument(file)) return false;
    }
    return true;
  });
  const addRoomAwareFileFromContent = useEventCallback((
    title: string,
    fileText: string,
    viewMode?: FileViewMode,
    overrides?: Partial<WorkspaceFile>,
  ) => {
    const nextFile = addFileFromContent(
      title,
      activeRoom ? "" : fileText,
      viewMode,
      overrides,
    );
    if (activeRoom && !publishRoomDocument({ ...nextFile, text: fileText })) {
      deleteWorkspaceFileAction(nextFile.id);
      showToast(workspaceActionCopy.importRoomFailed, "error");
      return nextFile;
    }
    return nextFile;
  });
  useEffect(() => {
    const isSharedRoomFile = (fileId: string) =>
      Boolean(activeRoomId && files.some((file) => file.id === fileId));
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
    isRoomSession: Boolean(activeRoom),
    editorDocumentRuntime,
    editorRef,
    onPendingTextChange: () => stopFollowing("local-edit"),
    onTextPatches: mapFileCommentAnchors,
    onVisibleTextChange: bumpVisibleTextRevision,
    setActiveFileBookmarks,
    setActiveFileText,
    setFileText,
  });
  const handleUserWorkspaceBoundary = useEventCallback(() => {
    stopFollowing("local-navigation");
    flushPendingEditorCommit();
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
      room: activeRoom,
      activeText: text,
      commentsByFileId,
      copy: workspaceShareCopy,
      files,
      folders,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary: handleUserWorkspaceBoundary,
      resetCollaborationState,
      retryCollaborationConnection,
      setCopiedFileId,
      showToast,
      startCollaborationSession,
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
    roomDocumentProjectionStore.clear();
    workspaceSessionHost.openLocal();
    setLiveRoomOpenFailure(null);
    syncUrlForLocalWorkspace("replace");
    void readIndexedDbWorkspace()
      .then((storedWorkspace) => {
        const nextStoredWorkspace = storedWorkspace ?? createStarterWorkspaceState();
        getWorkspaceStoreForMode("local").getState().replaceWorkspace(nextStoredWorkspace);
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

      setLiveRoomOpenFailure(null);
      const roomWorkspace = {
        ...getWorkspaceStoreSnapshot("local"),
        folders,
      };
      roomDocumentProjectionStore.prime(roomWorkspace.files);
      getWorkspaceStoreForMode("room").getState().replaceWorkspace(
        clearWorkspaceDocumentBodies(roomWorkspace),
      );
      workspaceSessionHost.openRoom(
        { roomId: startedSession.roomId, shareUrl: startedSession.shareUrl },
        startedSession.bootstrap,
      );
    } catch (error) {
      roomDocumentProjectionStore.clear();
      clientErrorReporter.report({
        feature: "collaboration",
        operation: "start-session",
        error,
      });
      setTopPopover(null);
      showToast(workspaceShareCopy.live.unavailable, "error");
    }
  });
  const stopSessionWithPendingCommit = useEventCallback(() => {
    flushPendingEditorCommit();
    const localWorkspace = getWorkspaceSnapshot();
    getWorkspaceStoreForMode("local").getState().replaceWorkspace(localWorkspace);
    stopSession();
    resetCollaborationState("idle");
    roomDocumentProjectionStore.clear();
    syncUrlForLocalWorkspace("replace");
    workspaceSessionHost.openLocal();
    setLiveRoomOpenFailure(null);
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
    showToast(workspaceShareCopy.live.unavailable, "error");
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
    if (!activeRoom) {
      syncedLiveRoomUrlRef.current = null;
      return;
    }
    if (connectionStatus !== "connected") {
      return;
    }
    if (syncedLiveRoomUrlRef.current === activeRoom.roomId) {
      return;
    }

    syncedLiveRoomUrlRef.current = activeRoom.roomId;
    syncUrlForRoom(activeRoom);
  }, [activeRoom, activeRoomId, connectionStatus]);
  const handleRouteWorkspaceChange = useEventCallback(() => {
    setTopPopover(null);
    setCenterPopover(null);
    setCopiedFileId(null);
  });
  const activateRoomWorkspace = useEventCallback((room: LocationRoom) => {
    restoredRoomViewsRef.current.delete(room.roomId);
    setLiveRoomOpenFailure(null);
    roomDocumentProjectionStore.clear();
    getWorkspaceStoreForMode("room").getState().replaceWorkspace(createRoomWorkspaceState());
    workspaceSessionHost.openRoom(room);
  });
  useWorkspaceRouteRuntime({
    activateRoomWorkspace,
    isRoomSession: Boolean(activeRoom),
    onBeforeWorkspaceBoundary: handleUserWorkspaceBoundary,
    onRouteWorkspaceChange: handleRouteWorkspaceChange,
    onLeaveRoom: openLocalWorkspaceAfterRoomFailure,
  });

  useSelectionActionDismissal({
    selectionActionPosition,
    setSelectionActionPosition,
  });

  const {
    closeJsonShareImport,
    closeWorkspaceFolderImport,
    copyFile,
    downloadProjectArchive,
    emptyDropActive,
    handleEmptyWorkspaceDragLeave,
    handleEmptyWorkspaceDragOver,
    handleEmptyWorkspaceDrop,
    handleImportInputChange,
    handleWorkspaceImportInputChange,
    jsonShareImport,
    workspaceFolderImport,
    replaceWorkspaceWithFolder,
    replaceWorkspaceWithJsonShare,
  } = useWorkspaceIoRuntime({
    activeFile,
    isRoomSession: Boolean(activeRoom),
    activeFileId,
    addFileFromContent: addRoomAwareFileFromContent,
    clearFileHistory,
    closeFloatingChrome,
    commentsByFileId,
    editorRef,
    files,
    folders,
    getActiveFileSnapshot,
    getWorkspaceSnapshot,
    openFileIds,
    onBeforeWorkspaceBoundary: handleUserWorkspaceBoundary,
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
    renameWorkspaceFileAction,
    duplicateFile,
    deleteFile,
    closeFile,
    selectAdjacentFile,
  } = useWorkspaceFileActions({
    activeFile,
    isRoomSession: Boolean(activeRoom),
    activeFileId,
    addWorkspaceFileAction,
    closeFloatingChrome,
    closeWorkspaceFileAction,
    commentsByFileId,
    deleteWorkspaceFileAction,
    duplicateWorkspaceFile: (fileId) => {
      if (!activeRoom) return duplicateWorkspaceFile(fileId);
      const sourceText = materializeRoomDocument(fileId);
      if (sourceText === null) {
        showToast(workspaceActionCopy.duplicateNotReady, "error");
        return undefined;
      }
      const duplicatedFile = duplicateWorkspaceFile(fileId);
      if (!duplicatedFile) return undefined;
      return { ...duplicatedFile, text: sourceText };
    },
    files,
    historyByFileId,
    onFileCreated: publishRoomDocumentProjection,
    onFileDeleted: (file) => !activeRoom || deleteRoomNode(file.id),
    onFileRenamed: renameRoomNode,
    onFileRestored: restoreRoomDocument,
    readFileText: activeRoom ? materializeRoomDocument : undefined,
    readFileComments: activeRoom
      ? (fileId) => projectWorkspaceRoomComments({
          [fileId]: [...materializeRoomDocumentComments(fileId)],
        })[fileId] ?? []
      : undefined,
    openFileIds,
    onBeforeWorkspaceBoundary: handleUserWorkspaceBoundary,
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
    copy: workspaceActionCopy,
  });
  const {
    addWorkspaceFolder,
    deleteWorkspaceFolder,
    moveWorkspaceFile,
    moveWorkspaceFolder,
    renameWorkspaceFolder,
  } = useWorkspaceFolderActions({
    activeRoom: Boolean(activeRoom),
    copy: workspaceActionCopy,
    files,
    folders,
    historyByFileId,
    addFolder: addWorkspaceFolderAction,
    deleteFolder: deleteWorkspaceFolderAction,
    deleteCommentsForFiles,
    deleteRoomNode,
    materializeRoomWorkspace,
    moveFile: moveFileToFolder,
    moveFolder,
    moveRoomNode,
    publishRoomFolder,
    readFolder: (folderId) => getWorkspaceStoreFolder(folderId, workspaceSession.mode),
    renameFolder,
    renameRoomNode,
    restoreCommentsForFiles,
    restoreFolder: restoreWorkspaceFolderAction,
    restoreRoomFolderBundle,
    setHistoryByFileId,
    showToast,
    upsertRoomComment,
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
    onBeforeCreateComment: handleUserWorkspaceBoundary,
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
    copy: workspaceActionCopy,
  });
  const clearLocalWorkspace = useEventCallback(() => {
    if (activeRoom) return;
    handleUserWorkspaceBoundary();
    const starterWorkspace = createStarterWorkspaceState();
    replaceWorkspace(starterWorkspace);
    replaceCommentsByFileId({});
    clearFileHistory();
    localWorkspacePersistence.persistNow(starterWorkspace);
    closeFloatingChrome();
    syncUrlForLocalWorkspace("replace");
    showToast(workspaceMenuCopy.clearWorkspace.cleared);
  });
  const { menuSurfaceProps } = useWorkspaceMenuRuntime({
    importInputRef,
    workspaceImportInputRef,
    isOpen: workspaceMenuOpen,
    onAddFile: addFile,
    canClearWorkspace: !activeRoom,
    onClearWorkspace: clearLocalWorkspace,
    onCloseChrome: closeFloatingChrome,
    onImportFileChange: handleImportInputChange,
    onImportWorkspaceChange: handleWorkspaceImportInputChange,
    onOpenAbout: openAbout,
    onOpenHelp: openHelp,
    preferences: workspacePreferences,
    preferencesOpen,
    setPreferences: setWorkspacePreferences,
    setPreferencesOpen,
    setTopPopover,
  });
  const handleStableLineAnnotationAction = useEventCallback(
    handleLineAnnotationAction,
  );
  const openStableCommentMarker = useEventCallback(openCommentMarker);
  const { sidePanelProps } =
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
      onDeleteFolder: deleteWorkspaceFolder,
      onDuplicateFile: duplicateFile,
      onCopyFile: copyFile,
      onGoToComment: goToFileComment,
      onIdentityNameChange: updateIdentityName,
      onIdentityNameCommit: normalizeIdentityName,
      onImportFile: () => importInputRef.current?.click(),
      onNewFile: addFile,
      onNewFolder: addWorkspaceFolder,
      onRenameFile: renameWorkspaceFileAction,
      onRenameFolder: renameWorkspaceFolder,
      onMoveFileToFolder: moveWorkspaceFile,
      onMoveFolder: moveWorkspaceFolder,
      onReplyDraftChange: updateCommentReplyDraft,
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
    followState,
    identity: presenceIdentity,
    isLive: isLiveChromeVisible,
    isLiveConnected,
    jsonShare,
    language: workspacePreferences.language,
    openFiles,
    room: activeRoom,
    rightPanelOpen,
    startSessionUnavailableReason: canStartSession
      ? ""
      : workspaceShareCopy.live.unavailable,
    topPopover,
    workspaceMenuOpen,
    onAddFile: addFile,
    onChangeUserName: updateIdentityName,
    onCloseFile: closeFile,
    onShareLoadError: () => {
      setTopPopover(null);
      showToast(getWorkspaceMenuCopy(workspacePreferences.language).share.loadError, "error");
    },
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
    onToggleFollowing: toggleFollowing,
    onToggleWorkspaceMenu: toggleWorkspaceMenu,
    setCenterPopover,
    setPreferencesOpen,
    setTopPopover,
    setWorkspaceMenuOpen,
  });
  const { documentSurface, documentWorkbenchRuntime } =
    useDocumentSurfaceRuntime({
      activeDocument,
      activeLineNumbers,
      activeLineWrapping,
      activeSyncScrolling: workspacePreferences.syncScrolling,
      activeViewMode,
      editorRef,
      selectedCharacterCount,
      searchOpen,
      selectionActionPosition,
      shareOpen,
      splitDividerDragging,
      onSetActiveFileLineNumbers: setActiveFileLineNumbers,
      onSetActiveFileLineWrapping: setActiveFileLineWrapping,
      onSetActiveFileReadingWidth: setActiveFileReadingWidth,
      onSetActiveFileViewMode: setActiveFileViewMode,
      onSetSyncScrolling: setSyncScrollingPreference,
      setCenterPopover,
      setTopPopover,
    });
  const viewModeRequestRef = useRef(0);
  const setViewModeWithPendingCommit = useEventCallback((viewMode: FileViewMode) => {
    const requestId = viewModeRequestRef.current + 1;
    viewModeRequestRef.current = requestId;
    const applyViewMode = () => {
      if (viewModeRequestRef.current !== requestId) return;
      flushPendingEditorCommit();
      documentWorkbenchRuntime.onSetViewMode(viewMode);
    };
    if (viewMode === "edit") {
      applyViewMode();
      return;
    }
    void loadMarkdownPreview().then(applyViewMode).catch(() => undefined);
  });
  useWorkspaceKeyboardShortcuts({
    importInputRef,
    addFile,
    closeFloatingChrome,
    openFilesPanel,
    openHelp,
    openDocumentSearch: openSearchFromCurrentSelection,
    selectAdjacentFile,
    setActiveFileViewMode: setViewModeWithPendingCommit,
    setCenterPopover,
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
      onOpenWorkspace: () => workspaceImportInputRef.current?.click(),
      onOpenHelp: openHelp,
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
      infoDialog,
      jsonShareImport,
      workspaceFolderImport,
      language: workspacePreferences.language,
      shortcutPlatform,
      toast,
      onCloseInfoDialog: () => setInfoDialog(null),
      onCloseWorkspaceFolderImport: closeWorkspaceFolderImport,
      onDismissToast: dismissToast,
      onPauseToast: pauseToast,
      onResumeToast: resumeToast,
      onCloseJsonShareImport: closeJsonShareImport,
      onReplaceWorkspaceWithJsonShare: replaceWorkspaceWithJsonShare,
      onReplaceWorkspaceWithFolder: replaceWorkspaceWithFolder,
    },
    sidePanelProps,
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
      documentSearch: {
        searchInputRef,
        searchQuery,
        replaceQuery,
        searchMatchCount,
        searchError,
        searchOptions,
        activeSearchMatchIndex,
        replaceAvailable,
        target: searchTarget,
        onSearchQueryChange: setSearchQuery,
        onReplaceQueryChange: setReplaceQuery,
        onToggleSearchOption: toggleSearchOption,
        onGoToSearchMatch: goToSearchMatch,
        onSelectAllSearchMatches: selectAllSearchMatches,
        onReplaceCurrentMatch: replaceCurrentMatch,
        onReplaceAllMatches: replaceAllMatches,
        onCloseSearch: () => setSearchOpen(false),
      },
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
      searchMatches,
      searchOpen,
      searchQuery,
      searchOptions,
      searchTarget,
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
      onEditorHistoryStateChange: handleEditorHistoryStateChange,
      onEditorScroll: () => {
        stopFollowingForLocalNavigation();
        handleEditorSurfaceScroll();
        publishCurrentRoomViewport();
      },
      onEditorScrollRatioChange: (ratio) => {
        stopFollowingForLocalNavigation();
        handleEditorScrollRatioChange(ratio);
        publishCurrentRoomViewport();
      },
      onEditorSelectionActionPositionChange:
        handleEditorSelectionActionPositionChange,
      onEditorSelectionChange: (selection) => {
        stopFollowingForLocalNavigation();
        handleEditorSelectionChange(selection);
      },
      onFormat: (command) => {
        stopFollowing("local-edit");
        documentWorkbenchRuntime.onFormat(command);
      },
      onLineAction: handleStableLineAnnotationAction,
      onOpenComment: openStableCommentMarker,
      onOpenSelectionComment: openSelectionComment,
      onPreviewKeyUp: syncPreviewSelection,
      onPreviewMouseUp: syncPreviewSelection,
      onPreviewScroll: () => {
        stopFollowing("local-navigation");
        handlePreviewScroll();
      },
      onPreviewTouchEnd: syncPreviewSelection,
      onRedo: () => {
        stopFollowing("local-edit");
        redoActiveFile();
      },
      onResetSplitRatio: resetSplitRatio,
      onPreviewSearchMatchCountChange,
      onSetReadingWidth: documentWorkbenchRuntime.onSetReadingWidth,
      onSetViewMode: (viewMode) => {
        stopFollowing("local-navigation");
        setViewModeWithPendingCommit(viewMode);
      },
      onSplitDividerKeyDown: handleSplitDividerKeyDown,
      onSplitDividerPointerCancel: endSplitDividerDrag,
      onSplitDividerPointerDown: handleSplitDividerPointerDown,
      onSplitDividerPointerMove: handleSplitDividerPointerMove,
      onSplitDividerPointerUp: endSplitDividerDrag,
      onTextChange: (nextText, change) => {
        stopFollowing("local-edit");
        handleTextChange(nextText, change);
      },
      onToggleLineNumbers: documentWorkbenchRuntime.onToggleLineNumbers,
      onToggleSearch: () => {
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
        openSearchFromCurrentSelection();
      },
      onToggleLineWrapping: documentWorkbenchRuntime.onToggleLineWrapping,
      onToggleSyncScrolling: documentWorkbenchRuntime.onToggleSyncScrolling,
      onToggleViewOptions: documentWorkbenchRuntime.onToggleViewOptions,
      onUndo: () => {
        stopFollowing("local-edit");
        undoActiveFile();
      },
    },
    rightPanelOpen,
  });
}
