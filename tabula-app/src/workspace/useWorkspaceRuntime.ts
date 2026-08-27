import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getShortcutPlatform } from "./keyboardShortcuts";
import type { MarkdownEditorHandle } from "../document/markdownEditorTypes";
import {
  applyTextPatches,
  type TextChange,
  type WorkspaceKnowledgeLink,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceRoomSnapshot,
} from "@tabula-md/tabula";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import { loadMarkdownPreview } from "../preview/markdownPreviewLoader";
import {
  materializeWorkspaceRoomSnapshot,
  projectWorkspaceRoomComments,
} from "../collaboration/workspaceRoomProjection";
import {
  createWorkspaceFile,
  getWorkspacePresentation,
  randomId,
  readInitialWorkspaceSnapshot,
  README_FILE_ID,
  type FileViewMode,
  type WorkspaceState,
} from "./workspaceStorage";

import {
  getWorkspaceChromeCopy,
  getWorkspaceMenuCopy,
} from "./workspaceLocale";
import { createWorkspaceRuntimeFacade } from "./workspaceRuntimeFacade";
import { getWorkspaceActionCopy } from "./workspaceActionLocale";
import {
  getWorkspaceStoreActiveFile,
  getWorkspaceStoreFolder,
  getWorkspaceStoreSnapshot,
} from "./state/workspaceStore";
import { useAppToast } from "../ui/useAppToast";
import { useDocumentSurfaceController } from "../document/useDocumentSurfaceController";
import { useEventCallback } from "../shared/useEventCallback";
import { useFileComments } from "../comments/useFileComments";
import { useSelectionActionDismissal } from "../document/useSelectionActionDismissal";
import { useWorkspaceEditorDocumentRuntimeOwner } from "../document/editorDocumentRuntimeOwner";
import { useWorkspaceActiveFileEditor } from "../document/useWorkspaceActiveFileEditor";
import { useWorkspaceChromeController } from "./useWorkspaceChromeController";
import type { WorkspaceShellSize } from "./workspaceShellLayout";
import { useWorkspaceCommentActions } from "../comments/useWorkspaceCommentActions";
import { useWorkspaceDocumentRuntime } from "../document/useWorkspaceDocumentRuntime";
import { useWorkspaceFileActions } from "./useWorkspaceFileActions";
import { useWorkspaceFolderActions } from "./useWorkspaceFolderActions";
import { useWorkspaceFiles } from "./state/useWorkspaceFiles";
import { useWorkspaceIdentity } from "./state/useWorkspaceIdentity";
import { useWorkspaceIoController } from "./io/useWorkspaceIoController";
import { useWorkspaceKeyboardShortcuts } from "./useWorkspaceKeyboardShortcuts";
import { useWorkspaceMenuController } from "./useWorkspaceMenuController";
import { useWorkspacePersistenceRuntime } from "./persistence/useWorkspacePersistenceRuntime";
import { useWorkspacePreferences } from "./state/useWorkspacePreferences";
import { useWorkspaceRightPanelController } from "../right-panel/useWorkspaceRightPanelController";
import { useWorkspaceTopChromeController } from "./useWorkspaceTopChromeController";
import {
  getLiveRoomOpenState,
  type LiveRoomOpenFailure,
} from "../collaboration/liveRoomOpenState";
import { clientErrorReporter } from "../observability/clientErrorReporting";
import {
  productAnalytics,
} from "../observability/productAnalytics";
import { createActiveRoomDocumentProjectionStore } from "../collaboration/runtime/ActiveRoomDocumentProjectionStore";
import {
  createLocalWorkspaceSession,
  createRoomWorkspaceSession,
} from "./session/WorkspaceSession";
import {
  createWorkspaceSessionHost,
  type WorkspaceSessionHost,
} from "./session/WorkspaceSessionHost";
import type { WorkspaceInfoDialogKind } from "./components/WorkspaceInfoDialog";
import {
  useWorkspaceRoomController,
  type RoomCommentActions,
} from "./useWorkspaceRoomController";
import { useWorkspaceLiveSessionController } from "./useWorkspaceLiveSessionController";
import { useWorkspaceWorkbenchSurfaceController } from "../document/useWorkspaceWorkbenchSurfaceController";
import { getWorkspaceSurfaceCopy } from "./workspaceSurfaceLocale";
import { getAmbiguousWorkspaceLinkResolutionEdit } from "./workspaceLinkResolution";
import { useWorkspacePreviewNavigation } from "./useWorkspacePreviewNavigation";
import { useWorkspaceBoundaryController } from "./useWorkspaceBoundaryController";

const FRONTMATTER_SNAPSHOT_PATTERN =
  /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

const getFrontmatterSnapshot = (markdown: string) =>
  FRONTMATTER_SNAPSHOT_PATTERN.exec(markdown)?.[0] ?? "";

export function useWorkspaceRuntime(shellSize: WorkspaceShellSize) {
  const [initialWorkspaceSnapshot] = useState(() =>
    readInitialWorkspaceSnapshot(),
  );
  const initialWorkspace = initialWorkspaceSnapshot.workspace;
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
  const workspaceFiles = useWorkspaceFiles({
    initialFiles: initialWorkspace.files,
    initialFolders: initialWorkspace.folders,
    initialOpenFileIds: initialWorkspace.openFileIds,
    initialActiveFileId: initialWorkspace.activeFileId,
    readmeFileId: README_FILE_ID,
    createFile: createWorkspaceFile,
    store: workspaceSession.viewStore,
  });
  const {
    folders,
    files,
    openFiles,
    openFileIds,
    activeFileId,
    activeFile,
    lastClosedFile,
    selectFile: selectWorkspaceFileAction,
    addFolder: addWorkspaceFolderAction,
    addFile: addWorkspaceFileAction,
    duplicateFile: duplicateWorkspaceFile,
    renameFile,
    closeAllFiles: closeAllWorkspaceFilesAction,
    closeOtherFiles: closeOtherWorkspaceFilesAction,
    closeFile: closeWorkspaceFileAction,
    deleteFile: deleteWorkspaceFileAction,
    deleteFolder: deleteWorkspaceFolderAction,
    moveFileToFolder,
    moveFolder,
    renameFolder,
    renameWorkspace,
    replaceWorkspace,
    restoreFile,
    restoreFolder: restoreWorkspaceFolderAction,
    reopenLastClosedFile: reopenLastClosedWorkspaceFileAction,
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
  } = workspaceFiles;
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
  const [knowledgeBaseline, setKnowledgeBaseline] = useState<
    WorkspaceKnowledgeBaseline | undefined
  >(initialWorkspace.knowledgeBaseline);
  const localPersistenceEnabled = workspaceSession.mode === "local";
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const propertyAddRequestIdRef = useRef(0);
  const [propertyAddRequest, setPropertyAddRequest] = useState<{
    documentId: string;
    requestId: number;
  } | null>(null);
  const editorDocumentRuntime = useWorkspaceEditorDocumentRuntimeOwner();
  const [roomDocumentProjectionStore] = useState(() =>
    createActiveRoomDocumentProjectionStore());
  const hasConnectedFolderRef = useRef(false);
  const disconnectConnectedFolderRef = useRef<() => void>(() => undefined);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement | null>(null);
  const [shortcutPlatform] = useState(() => getShortcutPlatform());
  const [infoDialog, setInfoDialog] = useState<WorkspaceInfoDialogKind | null>(null);
  const { dismissToast, pauseToast, resumeToast, toast, showToast } = useAppToast();
  const { identity, updateIdentityName, normalizeIdentityName } =
    useWorkspaceIdentity();
  const roomCommentActionsRef = useRef<RoomCommentActions>({
    created: () => undefined,
    deleted: () => undefined,
    resolved: () => undefined,
    replied: () => undefined,
  });
  const materializeRoomWorkspaceRef = useRef<() => WorkspaceRoomSnapshot | undefined>(() => undefined);
  const [liveRoomOpenFailure, setLiveRoomOpenFailure] = useState<LiveRoomOpenFailure | null>(null);
  const persistenceErrorShownRef = useRef(false);
  const fileComments = useFileComments({
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
  } = fileComments;
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
  const addRootFile = useEventCallback(() => {
    const createdFile = addFile();
    if (createdFile) {
      productAnalytics.report("file_created_or_opened", {
        documentSource: "new_document",
      });
    }
    return createdFile;
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
        presentation: getWorkspacePresentation(materializedWorkspace.files.find(
          (file) => file.id === materializedWorkspace.activeFileId,
        )),
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
      presentation: getWorkspacePresentation(
        activeFileSnapshot ?? workspaceSnapshot.files.find((file) => file.id === workspaceSnapshot.activeFileId),
      ),
      ...(localPersistenceEnabled && knowledgeBaseline
        ? { knowledgeBaseline }
        : {}),
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
  const documentRuntime = useWorkspaceDocumentRuntime({
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
  const {
    activeDocument,
    activeBookmarks,
    activeFileTitle,
    activeLineNumbers,
    activeLineWrapping,
    activeSelection,
    activeViewMode,
    focusTextRange,
    getSelectedMarkdownAnchor,
    getSelectedMarkdownExcerpt,
    outlineHeadings,
    parsedMarkdown,
    previewBodyStartOffset,
    previewSurfaceRef,
    queueEditorFocus,
    queueEditorTextRange,
    renderedPreview,
    searchOpen,
    selectedCharacterCount,
    selectionActionPosition,
    setActiveFileViewMode,
    openSearchFromCurrentSelection,
    setSelectionActionPosition,
    splitDividerDragging,
    text,
    workspaceRef,
  } = documentRuntime;
  const workspaceChrome = useWorkspaceChromeController({
    shellSize,
    selectionActionPosition,
    setCopiedFileId,
    setSelectionActionPosition,
  });
  const workspacePersistenceSnapshot = useMemo<WorkspaceState>(
    () => ({
      folders,
      files,
      openFileIds,
      activeFileId,
      commentsByFileId,
      presentation: getWorkspacePresentation(activeFile),
      ...(knowledgeBaseline ? { knowledgeBaseline } : {}),
    }),
    [
      activeFileId,
      commentsByFileId,
      files,
      folders,
      knowledgeBaseline,
      openFileIds,
      activeFile,
    ],
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
    leftPanelOpen,
    setLeftPanelOpen,
    leftPanelView,
    setLeftPanelView,
    rightPanelOpen,
    setRightPanelOpen,
    rightPanelView,
    setRightPanelView,
    launcherOpen,
    setLauncherOpen,
    closeFloatingChrome,
    openFilesPanel,
    openLeftPanel,
    openRightPanel,
    toggleWorkspaceMenu,
    toggleLeftPanel,
    toggleRightPanel,
  } = workspaceChrome;
  const openInfoDialog = useEventCallback((kind: WorkspaceInfoDialogKind) => {
    closeFloatingChrome();
    setInfoDialog(kind);
  });
  const openAbout = useEventCallback(() => openInfoDialog("about"));
  const openHelp = useEventCallback(() => openInfoDialog("help"));
  const roomController = useWorkspaceRoomController({
    activeRoomSession,
    activeViewMode,
    bumpVisibleTextRevision,
    chrome: workspaceChrome,
    comments: fileComments,
    copy: workspaceActionCopy,
    editorRef,
    getCollaborationSessionFileSnapshot,
    identity,
    materializeRoomWorkspaceRef,
    onOpenFailure: setLiveRoomOpenFailure,
    roomCommentActionsRef,
    roomDocumentProjectionStore,
    showToast,
    workspace: workspaceFiles,
    workspaceSession,
  });
  const {
    collaborators,
    connectionStatus,
    durability: roomDurability,
    hydrationStatus,
    applyLocalText,
    renameNode: renameRoomNode,
    moveNode: moveRoomNode,
    deleteNode: deleteRoomNode,
    editorBinding,
    materializeWorkspace: materializeRoomWorkspace,
    materializeDocument: materializeRoomDocument,
    materializeDocumentComments: materializeRoomDocumentComments,
    upsertComment: upsertRoomComment,
    resetCollaborationState,
    retryConnection: retryCollaborationConnection,
    recoveryMode: roomRecoveryMode,
    addRoomAwareFileFromContent,
    followState,
    isLiveConnected,
    presenceIdentity,
    publishRoomDocumentProjection,
    publishRoomFolder,
    restoreRoomDocument,
    restoreRoomFolderBundle,
    stopFollowing,
    toggleFollowing,
  } = roomController;
  const activeFileEditor = useWorkspaceActiveFileEditor({
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
  const {
    clearFileHistory,
    flushPendingEditorCommit,
    getLatestFileText,
    historyByFileId,
    setHistoryByFileId,
    updateActiveFileText,
  } = activeFileEditor;
  const handleUserWorkspaceBoundary = useEventCallback(() => {
    stopFollowing("local-navigation");
    flushPendingEditorCommit();
  });
  const resolveAmbiguousWorkspaceLink = useEventCallback((
    link: WorkspaceKnowledgeLink,
    targetPath: string,
  ) => {
    if (!activeFile || activeFile.id !== link.sourceDocumentId) return false;
    handleUserWorkspaceBoundary();
    const currentText = getLatestFileText(activeFile.id, activeFile.text);
    const edit = getAmbiguousWorkspaceLinkResolutionEdit(
      currentText,
      link,
      targetPath,
    );
    if (!edit) return false;
    const patches = [edit.patch];
    const nextText = applyTextPatches(currentText, patches);
    if (nextText === null) return false;
    mapFileCommentAnchors(activeFile.id, patches, currentText.length);
    updateActiveFileText(nextText, { patches });
    focusTextRange(edit.selection.from, edit.selection.to);
    return true;
  });
  const localWorkspacePersistence = useWorkspacePersistenceRuntime({
    enabled: localPersistenceEnabled,
    getWorkspaceSnapshot,
    initialWorkspace,
    onError: handlePersistenceError,
    onBeforePersist: flushPendingEditorCommit,
    workspace: workspacePersistenceSnapshot,
    replaceCommentsByFileId,
    replaceKnowledgeBaseline: setKnowledgeBaseline,
    replaceWorkspace,
  });
  const {
    canChooseRoomExitStrategy,
    copyShareUrl: copyShareUrlWithPendingCommit,
    isStartingLive,
    isLiveChromeVisible,
    jsonShare,
    liveRoomOpenTimedOut,
    openLocalWorkspaceAfterRoomFailure,
    roomExitStrategy,
    startSession: startSessionWithPendingCommit,
    stopSession: stopSessionWithPendingCommit,
  } = useWorkspaceLiveSessionController({
    chrome: workspaceChrome,
    comments: fileComments,
    copy: workspaceShareCopy,
    flushPendingEditorCommit,
    getActiveFileSnapshot,
    getWorkspaceSnapshot,
    hasConnectedFolder: () => hasConnectedFolderRef.current,
    disconnectConnectedFolder: () => disconnectConnectedFolderRef.current(),
    handlePersistenceError,
    liveRoomOpenFailure,
    onBeforeWorkspaceBoundary: handleUserWorkspaceBoundary,
    room: roomController,
    roomDocumentProjectionStore,
    sessionHost: workspaceSessionHost,
    setCopiedFileId,
    setLiveRoomOpenFailure,
    showToast,
    text,
    workspace: workspaceFiles,
  });
  const liveRoomOpenState = getLiveRoomOpenState({
    connectionStatus,
    hydrationStatus,
    hasActiveRoom: Boolean(activeRoom),
    timedOut: liveRoomOpenTimedOut,
    failure: liveRoomOpenFailure,
  });
  const handledRoomOpenFailureRef = useRef<string | null>(null);
  useEffect(() => {
    if (liveRoomOpenState !== "unavailable" && liveRoomOpenState !== "expired") {
      if (!activeRoom) handledRoomOpenFailureRef.current = null;
      return;
    }

    const roomId = activeRoom?.roomId;
    if (!roomId || handledRoomOpenFailureRef.current === roomId) return;
    handledRoomOpenFailureRef.current = roomId;

    const surfaceCopy = getWorkspaceSurfaceCopy(workspacePreferences.language);
    showToast(
      liveRoomOpenState === "expired"
        ? surfaceCopy.roomExpiredTitle
        : isStartingLive
          ? workspaceShareCopy.live.unavailable
          : surfaceCopy.roomUnavailableTitle,
      "error",
    );
    openLocalWorkspaceAfterRoomFailure();
  }, [
    activeRoom,
    isStartingLive,
    liveRoomOpenState,
    openLocalWorkspaceAfterRoomFailure,
    showToast,
    workspaceShareCopy.live.unavailable,
    workspacePreferences.language,
  ]);

  useSelectionActionDismissal({
    selectionActionPosition,
    setSelectionActionPosition,
  });

  const {
    closeJsonShareImport,
    closeWorkspaceFolderImport,
    copyFile,
    downloadCurrentFile,
    downloadWorkspaceArchive,
    disconnectLiveWorkspaceFolder,
    emptyDropActive,
    handleEmptyWorkspaceDragLeave,
    handleEmptyWorkspaceDragOver,
    handleEmptyWorkspaceDrop,
    handleImportInputChange,
    handleWorkspaceImportInputChange,
    isLiveFolderSupported,
    liveFolderAutoSave,
    liveFolderConflict,
    liveFolderConflictDialogOpen,
    liveFolderSaveStatus,
    deferLiveFolderConflict,
    keepTabulaLiveFolderVersion,
    mergeLiveFolderConflictManually,
    jsonShareImport,
    openLiveWorkspaceFolder,
    saveLiveWorkspaceFolder,
    reviewLiveFolderConflict,
    toggleLiveFolderAutoSave,
    useExternalLiveFolderVersion,
    workspaceFolderImport,
    workspaceSourceKind,
    workspaceSourceLabel,
    replaceWorkspaceWithFolder,
    replaceWorkspaceWithJsonShare,
  } = useWorkspaceIoController({
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
    replaceKnowledgeBaseline: setKnowledgeBaseline,
    replaceWorkspace,
    resetCollaborationState,
    showToast,
    workspaceSource: initialWorkspaceSnapshot.source,
  });
  hasConnectedFolderRef.current = workspaceSourceKind === "live-folder";
  disconnectConnectedFolderRef.current = disconnectLiveWorkspaceFolder;
  const {
    selectFile,
    addFile,
    renameWorkspaceFileAction,
    duplicateFile,
    deleteFile,
    closeAllFiles,
    closeOtherFiles,
    closeFile,
    reopenLastClosedFile,
    selectAdjacentFile,
  } = useWorkspaceFileActions({
    activeFile,
    isRoomSession: Boolean(activeRoom),
    activeFileId,
    addWorkspaceFileAction,
    closeAllWorkspaceFilesAction,
    closeOtherWorkspaceFilesAction,
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
    reopenLastClosedWorkspaceFileAction,
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
    renameWorkspaceName,
  } = useWorkspaceFolderActions({
    activeRoom: Boolean(activeRoom),
    copy: workspaceActionCopy,
    files,
    folders,
    historyByFileId,
    onBeforeWorkspaceBoundary: handleUserWorkspaceBoundary,
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
    renameWorkspace,
    renameRoomNode,
    restoreCommentsForFiles,
    restoreFolder: restoreWorkspaceFolderAction,
    restoreRoomFolderBundle,
    setHistoryByFileId,
    showToast,
    upsertRoomComment,
  });
  const workspaceCommentActions = useWorkspaceCommentActions({
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
    openRightPanel,
    selectFile,
    selectedCharacterCount,
    setActiveFileBookmarks,
    setCenterPopover,
    setFocusedCommentId,
    setSelectionActionPosition,
    setTopPopover,
    showToast,
    startCommentReply: beginCommentReply,
    queueEditorTextRange,
    text,
    copy: workspaceActionCopy,
  });
  const {
    addFileComment,
    cancelSelectionComment,
    formatCommentDate,
    goToFileComment,
    pendingSelectionCommentText,
    selectionCommentPending,
    consumeSelectionCommentRequest,
    startCommentReply,
  } = workspaceCommentActions;
  const {
    capabilities: workspaceBoundaryCapabilities,
    clearLocalWorkspace,
    contextSummary: workspaceContextSummary,
    disconnectLocalFolder,
  } = useWorkspaceBoundaryController({
    activeRoom: Boolean(activeRoom),
    browserPersistence: localWorkspacePersistence,
    clearFileHistory,
    closeFloatingChrome,
    collaboration: activeRoom ? {
      connectionStatus,
      durability: roomDurability,
      recoveryMode: roomRecoveryMode,
    } : null,
    copy: workspaceMenuCopy,
    disconnectFolder: disconnectLiveWorkspaceFolder,
    folderBinding: workspaceSourceKind === "live-folder" ? {
      autoSave: liveFolderAutoSave,
      label: workspaceSourceLabel,
      saveStatus: liveFolderSaveStatus,
    } : null,
    getWorkspaceSnapshot,
    language: workspacePreferences.language,
    onBeforeWorkspaceBoundary: handleUserWorkspaceBoundary,
    replaceCommentsByFileId,
    replaceKnowledgeBaseline: setKnowledgeBaseline,
    replaceWorkspace,
    showToast,
  });
  const { menuSurfaceProps } = useWorkspaceMenuController({
    importInputRef,
    workspaceImportInputRef,
    isOpen: workspaceMenuOpen,
    canUseLocalWorkspaceActions:
      workspaceBoundaryCapabilities.canUseLocalWorkspaceActions,
    canClearBrowserWorkspace:
      workspaceBoundaryCapabilities.canClearBrowserWorkspace,
    canExportWorkspace: files.length > 0,
    onClearWorkspace: clearLocalWorkspace,
    onExportWorkspace: downloadWorkspaceArchive,
    onCloseChrome: closeFloatingChrome,
    onImportFileChange: handleImportInputChange,
    onImportWorkspaceChange: handleWorkspaceImportInputChange,
    onOpenLiveWorkspace: isLiveFolderSupported && workspaceSourceKind !== "live-folder"
      ? openLiveWorkspaceFolder
      : undefined,
    onSaveLiveWorkspace: workspaceSourceKind === "live-folder"
      ? saveLiveWorkspaceFolder
      : undefined,
    onReviewLiveFolderConflict: workspaceSourceKind === "live-folder" && liveFolderConflict
      ? reviewLiveFolderConflict
      : undefined,
    onDisconnectLiveWorkspace: workspaceSourceKind === "live-folder"
      && workspaceBoundaryCapabilities.canUseLocalWorkspaceActions
      ? disconnectLocalFolder
      : undefined,
    liveFolderAutoSave,
    onToggleLiveFolderAutoSave: workspaceSourceKind === "live-folder" && !liveFolderConflict
      ? toggleLiveFolderAutoSave
      : undefined,
    collaborationActive: Boolean(activeRoom),
    onRetryCollaboration:
      activeRoom && (connectionStatus === "disconnected" || connectionStatus === "failed")
        ? retryCollaborationConnection
        : undefined,
    preferences: workspacePreferences,
    preferencesOpen,
    setPreferences: setWorkspacePreferences,
    setPreferencesOpen,
    setTopPopover,
    workspaceContextSummary,
  });
  const { knowledgeIndex, leftPanelProps, rightPanelProps } =
    useWorkspaceRightPanelController({
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
      shellSize,
      workspaceContextSummary,
      workspaceMenuOpen,
      leftPanelOpen,
      leftPanelView,
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
      onCloseWorkspaceMenu: () => {
        setPreferencesOpen(false);
        setWorkspaceMenuOpen(false);
      },
      onToggleWorkspaceMenu: toggleWorkspaceMenu,
      onOpenPreferences: () => {
        setWorkspaceMenuOpen(false);
        setPreferencesOpen(true);
      },
      onNewFile: addFile,
      onNewFolder: addWorkspaceFolder,
      onRenameFile: renameWorkspaceFileAction,
      onRenameFolder: renameWorkspaceFolder,
      onRenameWorkspace: renameWorkspaceName,
      onMoveFileToFolder: moveWorkspaceFile,
      onMoveFolder: moveWorkspaceFolder,
      onReplyDraftChange: updateCommentReplyDraft,
      onResolveAmbiguousLink: resolveAmbiguousWorkspaceLink,
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
      setLeftPanelOpen,
      setLeftPanelView,
      text,
    });
  const {
    openPreviewWorkspaceLink,
    resolveWorkspaceDocument,
    resolveWorkspaceLink,
  } = useWorkspacePreviewNavigation({
    activeFileId,
    activeViewMode,
    knowledgeIndex,
    previewBody: renderedPreview.body,
    previewRef,
    previewSurfaceRef,
    onSelectFile: selectFile,
    onSetViewMode: setWorkspaceFileViewMode,
  });
  const { shareOpen, topChromeProps } = useWorkspaceTopChromeController({
    activeFile,
    activeText: text,
    collaborators,
    connectionStatus,
    copiedFileId,
    canChooseRoomExitStrategy,
    currentUserName: identity.name,
    files,
    folders,
    followState,
    identity: presenceIdentity,
    isStartingLive,
    isLive: isLiveChromeVisible,
    isLiveConnected,
    jsonShare,
    language: workspacePreferences.language,
    workspaceContextSummary,
    openFiles,
    lastClosedFile,
    room: activeRoom,
    roomExitStrategy,
    shellSize,
    leftPanelOpen,
    rightPanelOpen,
    topPopover,
    onAddFile: addRootFile,
    onChangeUserName: updateIdentityName,
    onCloseAllFiles: closeAllFiles,
    onCloseOtherFiles: closeOtherFiles,
    onCloseFile: closeFile,
    onShareLoadError: () => {
      setTopPopover(null);
      showToast(getWorkspaceMenuCopy(workspacePreferences.language).share.loadError, "error");
    },
    onShareCopyFailed: () => {
      showToast(
        getWorkspaceMenuCopy(workspacePreferences.language).share.copyFailed,
        "error",
      );
    },
    onCommitUserName: normalizeIdentityName,
    onCopyShareUrl: copyShareUrlWithPendingCommit,
    onEmptyShare: () => {
      showToast(
        getWorkspaceMenuCopy(workspacePreferences.language).share.nothingToShare,
      );
    },
    onReorderFiles: reorderFiles,
    onRenameFile: renameWorkspaceFileAction,
    onReopenLastClosedFile: reopenLastClosedFile,
    onSelectFile: selectFile,
    onShareOpened: () => {
      productAnalytics.report("share_opened");
    },
    onStartSession: startSessionWithPendingCommit,
    onStopSession: stopSessionWithPendingCommit,
    onRetrySession: retryCollaborationConnection,
    onToggleLeftPanel: toggleLeftPanel,
    onOpenWorkspaceLauncher: () => setLauncherOpen(true),
    onToggleRightPanel: toggleRightPanel,
    onToggleFollowing: toggleFollowing,
    setCenterPopover,
    setPreferencesOpen,
    setTopPopover,
    setWorkspaceMenuOpen,
  });
  const documentSurfaceController = useDocumentSurfaceController({
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
  const { documentSurface, documentWorkbenchController } = documentSurfaceController;
  const viewModeRequestRef = useRef(0);
  const setViewModeWithPendingCommit = useEventCallback((viewMode: FileViewMode) => {
    const requestId = viewModeRequestRef.current + 1;
    viewModeRequestRef.current = requestId;
    // Commit editor text before preview loading begins. Committing inside the
    // resolved loader callback changed the file and the view in the same tick,
    // so a newly-authored document could render one stale empty preview frame.
    flushPendingEditorCommit();
    if (activeRoom && activeFile) {
      const latestEditorText = editorRef.current?.getValue();
      if (
        typeof latestEditorText === "string" &&
        roomDocumentProjectionStore.set(activeFile.id, latestEditorText)
      ) {
        bumpVisibleTextRevision();
      }
    }
    const applyViewMode = () => {
      if (viewModeRequestRef.current !== requestId) return;
      documentWorkbenchController.onSetViewMode(viewMode);
    };
    if (viewMode === "edit" || viewMode === "visual") {
      applyViewMode();
      return;
    }
    void loadMarkdownPreview().then(applyViewMode).catch(() => undefined);
  });
  const canAddPropertyToActiveFile = Boolean(
    activeFile &&
    activeFile.artifact?.editable !== false &&
    (!activeFile.artifact ||
      activeFile.artifact.kind === "document" ||
      activeFile.artifact.kind === "instruction"),
  );
  const requestAddProperty = useEventCallback(() => {
    const latestActiveFile = getActiveFileSnapshot();
    if (
      !latestActiveFile ||
      latestActiveFile.artifact?.editable === false ||
      (latestActiveFile.artifact &&
        latestActiveFile.artifact.kind !== "document" &&
        latestActiveFile.artifact.kind !== "instruction")
    ) {
      return;
    }
    propertyAddRequestIdRef.current += 1;
    setViewModeWithPendingCommit("visual");
    setPropertyAddRequest({
      documentId: latestActiveFile.id,
      requestId: propertyAddRequestIdRef.current,
    });
  });
  const handlePropertyAddRequest = useEventCallback(() => {
    setPropertyAddRequest(null);
  });
  // Keep the suggestion input stable while document bodies change. Metadata
  // recommendations only need frontmatter, so body typing must not re-parse
  // every document in a large workspace.
  const workspaceFrontmatterSignature = JSON.stringify(
    files.map(({ text: markdown }) => getFrontmatterSnapshot(markdown)),
  );
  const workspaceMarkdownDocuments = useMemo(
    () => JSON.parse(workspaceFrontmatterSignature) as string[],
    [workspaceFrontmatterSignature],
  );
  const { workbenchProps } = useWorkspaceWorkbenchSurfaceController({
    addPropertyRequestId:
      propertyAddRequest && propertyAddRequest.documentId === activeFile?.id
        ? propertyAddRequest.requestId
        : undefined,
    activeFile,
    activeSyncScrolling: workspacePreferences.syncScrolling,
    centerPopover,
    comments: workspaceCommentActions,
    document: documentRuntime,
    editor: activeFileEditor,
    editorRef,
    focusedCommentId,
    language: workspacePreferences.language,
    onOpenWorkspaceLink: openPreviewWorkspaceLink,
    onPropertyAddRequestHandled: handlePropertyAddRequest,
    onExportDocument: activeFile ? downloadCurrentFile : undefined,
    onSetViewMode: setViewModeWithPendingCommit,
    previewRef,
    room: roomController,
    surface: documentSurfaceController,
    toolbarLabel: workspaceChromeCopy.documentControls.documentToolbar,
    workspaceMarkdownDocuments,
    resolveWorkspaceDocument,
    resolveWorkspaceLink,
  });
  useWorkspaceKeyboardShortcuts({
    importInputRef,
    addFile: addRootFile,
    closeFloatingChrome,
    openFilesPanel,
    openHelp,
    openDocumentSearch: openSearchFromCurrentSelection,
    openWorkspaceLauncher: () => setLauncherOpen(true),
    selectAdjacentFile,
    setActiveFileViewMode: setViewModeWithPendingCommit,
    setCenterPopover,
  });

  return createWorkspaceRuntimeFacade({
    documentRuntime: {
      surface: documentSurface,
      workbench: workbenchProps,
    },
    workspaceSession: {
      sourceKind:
        workspaceSession.mode === "room"
          ? workspaceSession.source.kind
          : workspaceSourceKind,
      emptySurface: {
        dropActive: emptyDropActive,
        language: workspacePreferences.language,
        shortcutPlatform,
        workspaceRef,
        onDragLeave: handleEmptyWorkspaceDragLeave,
        onDragOver: handleEmptyWorkspaceDragOver,
        onDrop: handleEmptyWorkspaceDrop,
        onNewFile: addRootFile,
        onOpenFile: () => importInputRef.current?.click(),
        onOpenWorkspace: isLiveFolderSupported
          ? openLiveWorkspaceFolder
          : () => workspaceImportInputRef.current?.click(),
        workspaceMode: isLiveFolderSupported ? "connected" : "copy",
      },
      localOpening:
        localPersistenceEnabled && localWorkspacePersistence.pending,
    },
    chrome: {
      menu: menuSurfaceProps,
      top: topChromeProps,
    },
    panels: {
      left: {
        ...leftPanelProps,
      },
      right: {
        ...rightPanelProps,
      },
    },
    overlays: {
      workspace: {
        infoDialog,
        jsonShareImport,
        liveFolderConflict: liveFolderConflictDialogOpen
          ? liveFolderConflict
          : null,
        workspaceFolderImport,
        language: workspacePreferences.language,
        shortcutPlatform,
        toast,
        launcher: launcherOpen ? {
          files,
          folders,
          openFileIds,
          activeFileId: activeFile?.id,
          onClose: () => setLauncherOpen(false),
          onSelectFile: selectFile,
          onNewFile: addRootFile,
          onNewFolder: () => { addWorkspaceFolder(); },
          onImportFile: () => importInputRef.current?.click(),
          onImportWorkspace: () => workspaceImportInputRef.current?.click(),
          onExportFile: activeFile ? downloadCurrentFile : undefined,
          onExportWorkspace: downloadWorkspaceArchive,
          onAddProperty: canAddPropertyToActiveFile ? requestAddProperty : undefined,
          onOpenFiles: () => {
            openLeftPanel("files");
          },
          onOpenComments: () => {
            openRightPanel("comments");
          },
          onOpenMetadata: () => {
            openRightPanel("metadata");
          },
          onOpenPreferences: () => {
            setPreferencesOpen(true);
          },
          onOpenHelp: openHelp,
          onOpenAbout: openAbout,
        } : undefined,
        onCloseInfoDialog: () => setInfoDialog(null),
        onCloseWorkspaceFolderImport: closeWorkspaceFolderImport,
        onDismissToast: dismissToast,
        onPauseToast: pauseToast,
        onResumeToast: resumeToast,
        onCloseJsonShareImport: closeJsonShareImport,
        onReplaceWorkspaceWithJsonShare: replaceWorkspaceWithJsonShare,
        onReplaceWorkspaceWithFolder: replaceWorkspaceWithFolder,
        onKeepTabulaLiveFolderVersion: keepTabulaLiveFolderVersion,
        onMergeLiveFolderConflictManually: mergeLiveFolderConflictManually,
        onUseExternalLiveFolderVersion: useExternalLiveFolderVersion,
        onDeferLiveFolderConflict: deferLiveFolderConflict,
      },
    },
    collaboration: {
      liveRoomOpenState,
      loadingSurface: {
        language: workspacePreferences.language,
      },
    },
  });
}
