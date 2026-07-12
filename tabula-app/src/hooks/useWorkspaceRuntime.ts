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
  type TextChange,
  type WorkspaceRoomComment,
  type WorkspaceRoomSnapshot,
  type WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import {
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
  createRoomWorkspaceState,
  createWorkspaceFile,
  finalizeWorkspaceState,
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
import {
  getWorkspaceStoreActiveFile,
  getWorkspaceStoreFolder,
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
import {
  canFollowActor,
  IDLE_FOLLOW_STATE,
  type FollowState,
  type FollowStopReason,
} from "../collaboration/followModel";

export function useWorkspaceRuntime() {
  const [initialWorkspaceSnapshot] = useState(() =>
    readInitialWorkspaceSnapshot(),
  );
  const initialWorkspace = initialWorkspaceSnapshot.workspace;
  const restoredRoomViewsRef = useRef(new Set<string>());
  const followNavigationGenerationRef = useRef(0);
  const followNavigationInProgressRef = useRef(false);
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
  const [followState, setFollowState] = useState<FollowState>(IDLE_FOLLOW_STATE);
  const [localPersistenceEnabled, setLocalPersistenceEnabled] = useState(
    () => initialWorkspaceSnapshot.source !== "room",
  );
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const editorDocumentRuntime = useWorkspaceEditorDocumentRuntimeOwner();
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement | null>(null);
  const [shortcutLabels] = useState(() => getShortcutLabels());
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
  const mergeWorkspaceRoomStructure = useEventCallback((
    snapshot: WorkspaceRoomStructureSnapshot,
  ) => {
    if (activeRoomId && snapshot.roomId !== activeRoomId) return;
    const workspaceSnapshot = {
      ...getWorkspaceStoreSnapshot(),
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
      showToast(`${addedDocument.title} was added to the room.`, "neutral", {
        actionLabel: "Open",
        onAction: () => selectWorkspaceFileAction(addedDocument.id),
      });
    } else if (renamedDocuments.length === 1 && addedDocuments.length === 0 && deletedDocuments.length === 0) {
      const renamedDocument = renamedDocuments[0];
      showToast(`${previousRoomFilesById.get(renamedDocument.id)?.title} was renamed to ${renamedDocument.title}.`);
    } else if (addedDocuments.length || deletedDocuments.length || renamedDocuments.length || foldersChanged) {
      showToast("The shared workspace was updated.");
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
    startSessionUnavailableReason,
    statusLabel,
    startSession: startCollaborationSession,
    applyLocalText,
    activeDocumentText,
    activeDocumentComments,
    createDocument: createRoomDocument,
    createFolder: createRoomFolder,
    renameNode: renameRoomNode,
    moveNode: moveRoomNode,
    deleteNode: deleteRoomNode,
    replaceDocumentText: replaceRoomDocumentText,
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
    room: activeRoom,
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
    if (activeRoomDocument && activeDocumentText !== null) {
      if (editorDocumentRuntime.setAuthoritativeText(activeRoomDocument.id, activeDocumentText)) {
        bumpVisibleTextRevision();
      }
      return;
    }
    if (editorDocumentRuntime.clearAuthoritativeText()) bumpVisibleTextRevision();
  }, [activeDocumentText, activeRoomDocument?.id, editorDocumentRuntime]);
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
  const stopFollowing = useEventCallback((reason: FollowStopReason = "manual") => {
    if (followState.status === "idle") return;
    setFollowState(IDLE_FOLLOW_STATE);
    setRoomFollowingActor(null);
    if (reason === "target-left") showToast("The participant you were following left the room.");
    if (reason === "target-document-deleted") showToast("The followed document is no longer available.");
  });
  const runFollowNavigation = useEventCallback((navigate: () => void) => {
    const generation = followNavigationGenerationRef.current + 1;
    followNavigationGenerationRef.current = generation;
    followNavigationInProgressRef.current = true;
    navigate();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (followNavigationGenerationRef.current === generation) {
          followNavigationInProgressRef.current = false;
        }
      });
    });
  });
  const stopFollowingForLocalNavigation = useEventCallback(() => {
    if (followNavigationInProgressRef.current) return;
    stopFollowing("local-navigation");
  });
  const revealFollowTarget = useEventCallback((target: (typeof collaborators)[number]) => {
    const documentId = target.activeDocumentId ?? target.selection?.documentId;
    if (!documentId) return false;
    if (!activeRoomId || !files.some((file) => file.id === documentId)) return false;
    const selection = target.selection;
    runFollowNavigation(() => {
      if (activeFileId !== documentId) selectWorkspaceFileAction(documentId);
      const viewport = target.viewport;
      if (viewport?.documentId === documentId) {
        window.requestAnimationFrame(() =>
          editorRef.current?.revealViewport(viewport.position, viewport.offset));
      } else if (selection && (selection.documentId ?? documentId) === documentId) {
        window.requestAnimationFrame(() => editorRef.current?.revealRange(selection.from, selection.to));
      }
    });
    return true;
  });
  const toggleFollowing = useEventCallback((actorId: string) => {
    if (followState.status === "following" && followState.actorId === actorId) {
      stopFollowing("manual");
      return;
    }
    if (!canFollowActor({ actorId, collaborators, selfId: identity.id })) {
      showToast("This participant can’t be followed right now.", "error");
      return;
    }
    const target = collaborators.find((collaborator) => collaborator.id === actorId);
    if (!target || !revealFollowTarget(target)) {
      showToast("This participant’s location isn’t available yet.", "error");
      return;
    }
    setFollowState({ status: "following", actorId });
    setRoomFollowingActor(actorId);
  });
  useEffect(() => {
    if (followState.status !== "following") return;
    if (!isLive) {
      stopFollowing("manual");
      return;
    }
    const target = collaborators.find((collaborator) => collaborator.id === followState.actorId);
    if (!target) {
      stopFollowing("target-left");
      return;
    }
    if (!canFollowActor({ actorId: target.id, collaborators, selfId: identity.id })) {
      stopFollowing("cycle");
      return;
    }
    if (!revealFollowTarget(target)) stopFollowing("target-document-deleted");
  }, [collaborators, files, followState, identity.id, isLive]);
  useEffect(() => {
    if (followState.status !== "following") return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      stopFollowing("manual");
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [followState, stopFollowing]);
  const publishRoomDocument = useEventCallback((file: WorkspaceFile) =>
    !activeRoom || createRoomDocument({
      id: file.id,
      title: file.title,
      markdown: file.text,
      parentId: file.parentId ?? WORKSPACE_ROOT_FOLDER_ID,
      order: file.order,
    }));
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
    const nextFile = addFileFromContent(title, fileText, viewMode, overrides);
    if (activeRoom && !publishRoomDocument(nextFile)) {
      deleteWorkspaceFileAction(nextFile.id);
      showToast("This document couldn’t be imported into the live workspace.", "error");
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
    setActiveRoom(null);
    setLiveRoomOpenFailure(null);
    setLocalPersistenceEnabled(true);
    syncUrlForLocalWorkspace("replace");
    void readIndexedDbWorkspace()
      .then((storedWorkspace) => {
        const nextStoredWorkspace = storedWorkspace ?? finalizeWorkspaceState([]);
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
    flushPendingEditorCommit();
    const localWorkspace = getWorkspaceSnapshot();
    replaceWorkspace(localWorkspace);
    stopSession();
    resetCollaborationState("idle");
    syncUrlForLocalWorkspace("replace");
    setActiveRoom(null);
    setLiveRoomOpenFailure(null);
    setLocalPersistenceEnabled(true);
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
    setLocalPersistenceEnabled(false);
    setLiveRoomOpenFailure(null);
    setActiveRoom(room);
    replaceWorkspace(createRoomWorkspaceState());
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
    openAboutFile,
    openHelpFile,
    renameWorkspaceFileAction,
    duplicateFile,
    deleteFile,
    closeFile,
    selectAdjacentFile,
  } = useWorkspaceFileActions({
    activeFile,
    isRoomSession: Boolean(activeRoom),
    activeFileId,
    addFileFromContent,
    addWorkspaceFileAction,
    closeFloatingChrome,
    closeWorkspaceFileAction,
    commentsByFileId,
    deleteWorkspaceFileAction,
    duplicateWorkspaceFile: (fileId) => {
      if (!activeRoom) return duplicateWorkspaceFile(fileId);
      const sourceText = materializeRoomDocument(fileId);
      if (sourceText === null) {
        showToast("This document isn’t ready to duplicate yet.", "error");
        return undefined;
      }
      const duplicatedFile = duplicateWorkspaceFile(fileId);
      if (!duplicatedFile) return undefined;
      setFileText(duplicatedFile.id, sourceText);
      return { ...duplicatedFile, text: sourceText };
    },
    files,
    helpMarkdown: createHelpMarkdown(shortcutLabels),
    historyByFileId,
    onFileCreated: publishRoomDocument,
    onFileContentReplaced: (file) => !activeRoom || replaceRoomDocumentText(file.id, file.text),
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
    upsertHelpFile,
  });
  const addWorkspaceFolder = useEventCallback((parentId?: string) => {
    const folder = addWorkspaceFolderAction("New folder", parentId);
    if (!folder) {
      showToast("Folders can be nested up to 32 levels.", "error");
      return;
    }
    if (!publishRoomFolder(folder)) {
      deleteWorkspaceFolderAction(folder.id);
      showToast("This folder couldn’t be added to the live workspace.", "error");
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
        const roomSnapshot = activeRoom ? materializeRoomWorkspace() : undefined;
        if (activeRoom && !roomSnapshot) {
          showToast("This folder isn’t ready to delete yet.", "error");
          return;
        }
        if (activeRoom && !deleteRoomNode(folderId)) {
          showToast("This folder couldn’t be deleted from the live workspace.", "error");
          return;
        }
        const deletedBundle = deleteWorkspaceFolderAction(folderId);
        if (!deletedBundle) return;
        const restorableBundle = roomSnapshot
          ? {
              ...deletedBundle,
              files: deletedBundle.files.map(({ item, ...entry }) => ({
                ...entry,
                item: { ...item, text: roomSnapshot.documents[item.id] ?? "" },
              })),
            }
          : deletedBundle;
        const deletedFileIds = new Set(restorableBundle.files.map(({ item }) => item.id));
        const locallyDeletedComments = deleteCommentsForFiles(deletedFileIds);
        const deletedComments = roomSnapshot
          ? Object.fromEntries(
              Object.entries(projectWorkspaceRoomComments(roomSnapshot.commentsByFileId))
                .filter(([fileId]) => deletedFileIds.has(fileId)),
            )
          : locallyDeletedComments;
        const deletedHistory = Object.fromEntries(
          Object.entries(historyByFileId).filter(([fileId]) => deletedFileIds.has(fileId)),
        );
        setHistoryByFileId((currentHistory) =>
          Object.fromEntries(
            Object.entries(currentHistory).filter(([fileId]) => !deletedFileIds.has(fileId)),
          ),
        );
        showToast("Folder deleted.", "neutral", {
          actionLabel: "Undo",
          onAction: () => {
            restoreWorkspaceFolderAction(restorableBundle);
            if (!restoreRoomFolderBundle(restorableBundle)) {
              deleteRoomNode(folderId);
              deleteWorkspaceFolderAction(folderId);
              showToast("This folder couldn’t be restored to the live workspace.", "error");
              return;
            }
            restoreCommentsForFiles(deletedComments);
            for (const [fileId, comments] of Object.entries(deletedComments)) {
              for (const comment of comments) {
                upsertRoomComment({
                  ...comment,
                  fileId,
                  resolved: comment.resolved ?? false,
                  replies: comment.replies ?? [],
                });
              }
            }
            setHistoryByFileId((currentHistory) => ({
              ...currentHistory,
              ...deletedHistory,
            }));
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
      onRenameFolder: (folderId, title) => {
        const folder = folders.find((candidate) => candidate.id === folderId);
        if (!folder || !renameFolder(folderId, title)) return false;
        const currentFolder = getWorkspaceStoreFolder(folderId);
        if (activeRoom && currentFolder && !renameRoomNode(folderId, currentFolder.title)) {
          renameFolder(folderId, folder.title);
          return false;
        }
        return true;
      },
      onMoveFileToFolder: (fileId, folderId) => {
        const file = files.find((candidate) => candidate.id === fileId);
        const previousParentId = file?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
        if (!moveFileToFolder(fileId, folderId)) return;
        if (activeRoom && !moveRoomNode(fileId, folderId)) {
          moveFileToFolder(fileId, previousParentId);
          showToast("This document couldn’t be moved in the live workspace.", "error");
        }
      },
      onMoveFolder: (folderId, parentId) => {
        const folder = folders.find((candidate) => candidate.id === folderId);
        const previousParentId = folder?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
        if (!moveFolder(folderId, parentId)) {
          showToast("This folder can’t be moved there.", "error");
          return;
        }
        if (activeRoom && !moveRoomNode(folderId, parentId)) {
          moveFolder(folderId, previousParentId);
          showToast("This folder couldn’t be moved in the live workspace.", "error");
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
    followState,
    identity: presenceIdentity,
    isLive: isLiveChromeVisible,
    isLiveConnected,
    jsonShare,
    language: workspacePreferences.language,
    openFiles,
    room: activeRoom,
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
    onToggleFollowing: toggleFollowing,
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
      onGoToSearchMatch: goToSearchMatch,
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
      onReplaceAllMatches: replaceAllMatches,
      onReplaceCurrentMatch: replaceCurrentMatch,
      onResetSplitRatio: resetSplitRatio,
      onReplaceQueryChange: setReplaceQuery,
      onSearchQueryChange: setSearchQuery,
      onPreviewSearchMatchCountChange,
      onSelectAllSearchMatches: selectAllSearchMatches,
      onToggleSearchOption: toggleSearchOption,
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
      onToggleLineWrapping: documentWorkbenchRuntime.onToggleLineWrapping,
      onToggleSearch: documentWorkbenchRuntime.onToggleSearch,
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
