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
  setOkfConceptType,
  type TextChange,
  type WorkspaceRoomSnapshot,
} from "@tabula-md/tabula";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import { loadMarkdownPreview } from "../preview/markdownPreviewLoader";
import {
  materializeWorkspaceRoomSnapshot,
  projectWorkspaceRoomComments,
} from "../collaboration/workspaceRoomProjection";
import {
  createStarterWorkspaceState,
  createWorkspaceFile,
  randomId,
  readInitialWorkspaceSnapshot,
  README_FILE_ID,
  syncUrlForLocalWorkspace,
  type FileViewMode,
  type WorkspaceState,
} from "./workspaceStorage";
import {
  getWorkspaceChromeCopy,
  getWorkspaceMenuCopy,
} from "./workspaceLocale";
import { createWorkspaceAppViewModel } from "./workspaceAppViewModel";
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
import type { MarkdownPreviewWorkspaceLink } from "../preview/markdownPreviewTypes";
import {
  decodeMarkdownPreviewFragment,
  resolveMarkdownPreviewWorkspaceLink,
} from "../preview/workspacePreviewLinks";

export function useWorkspaceRuntime() {
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
    selectFile: selectWorkspaceFileAction,
    addFolder: addWorkspaceFolderAction,
    addFile: addWorkspaceFileAction,
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
  const localPersistenceEnabled = workspaceSession.mode === "local";
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const previewRef = useRef<MarkdownPreviewHandle | null>(null);
  const [pendingPreviewNavigation, setPendingPreviewNavigation] = useState<{
    documentId: string;
    fragment: string;
    sourceLineNumber?: number;
  } | null>(null);
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
    hydrationStatus,
    recoveryMode,
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
  const setActiveFileOkfType = useEventCallback((conceptType: string) => {
    if (!activeFile) return false;
    flushPendingEditorCommit();
    const currentText = getLatestFileText(activeFile.id, activeFile.text);
    const result = setOkfConceptType(currentText, conceptType);
    if (!result.ok) return false;
    if (!result.changed) return true;
    mapFileCommentAnchors(activeFile.id, result.patches, currentText.length);
    updateActiveFileText(result.markdown, { patches: result.patches });
    return true;
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
  const {
    copyShareUrl: copyShareUrlWithPendingCommit,
    isLiveChromeVisible,
    jsonShare,
    liveRoomOpenTimedOut,
    openLocalWorkspaceAfterRoomFailure,
    retryOpeningLiveRoom,
    startSession: startSessionWithPendingCommit,
    stopSession: stopSessionWithPendingCommit,
  } = useWorkspaceLiveSessionController({
    chrome: workspaceChrome,
    comments: fileComments,
    copy: workspaceShareCopy,
    flushPendingEditorCommit,
    getActiveFileSnapshot,
    getWorkspaceSnapshot,
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
  const { menuSurfaceProps } = useWorkspaceMenuController({
    importInputRef,
    workspaceImportInputRef,
    isOpen: workspaceMenuOpen,
    onAddFile: addRootFile,
    canClearWorkspace: !activeRoom,
    canExportFile: Boolean(activeFile),
    canExportWorkspace: files.length > 0,
    onClearWorkspace: clearLocalWorkspace,
    onExportFile: downloadCurrentFile,
    onExportWorkspace: downloadWorkspaceArchive,
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
  const { knowledgeIndex, rightPanelProps } =
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
      onSetActiveFileOkfType: setActiveFileOkfType,
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
  const resolveWorkspaceLink = useMemo(
    () => (href: string) =>
      resolveMarkdownPreviewWorkspaceLink(knowledgeIndex, activeFileId, href),
    [activeFileId, knowledgeIndex],
  );
  const openPreviewWorkspaceLink = useEventCallback((
    link: Extract<MarkdownPreviewWorkspaceLink, { status: "resolved" }>,
  ) => {
    const decodedFragment = link.fragment
      ? decodeMarkdownPreviewFragment(link.fragment)
      : "";
    setPendingPreviewNavigation(
      decodedFragment
        ? {
            documentId: link.targetDocumentId,
            fragment: decodedFragment,
            sourceLineNumber: link.sourceLineNumber,
          }
        : null,
    );

    if (link.targetDocumentId === activeFileId) {
      return;
    }

    selectFile(link.targetDocumentId);
    setWorkspaceFileViewMode(activeViewMode === "split" ? "split" : "preview");
  });
  useEffect(() => {
    if (
      !pendingPreviewNavigation ||
      pendingPreviewNavigation.documentId !== activeFileId ||
      activeViewMode === "edit"
    ) {
      return undefined;
    }

    let frameId = 0;
    let attempts = 0;
    const scrollToFragment = () => {
      const target = Array.from(
        previewSurfaceRef.current?.querySelectorAll<HTMLElement>("[id]") ?? [],
      ).find((element) => element.id === pendingPreviewNavigation.fragment);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
        setPendingPreviewNavigation(null);
        return;
      }
      attempts += 1;
      if (attempts === 1 && pendingPreviewNavigation.sourceLineNumber) {
        previewRef.current?.followEditorPosition({
          atDocumentEnd: false,
          lineNumber: pendingPreviewNavigation.sourceLineNumber,
          lineOffsetRatio: 0,
        });
      }
      if (attempts < 90) {
        frameId = window.requestAnimationFrame(scrollToFragment);
      } else {
        setPendingPreviewNavigation(null);
      }
    };
    frameId = window.requestAnimationFrame(scrollToFragment);
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeFileId,
    activeViewMode,
    pendingPreviewNavigation,
    previewSurfaceRef,
    renderedPreview.body,
  ]);
  const { shareOpen, topChromeProps } = useWorkspaceTopChromeController({
    activeFile,
    activeText: text,
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
    recoveryMode,
    jsonShare,
    language: workspacePreferences.language,
    openFiles,
    room: activeRoom,
    rightPanelOpen,
    topPopover,
    workspaceMenuOpen,
    onAddFile: addRootFile,
    onChangeUserName: updateIdentityName,
    onCloseFile: closeFile,
    onShareLoadError: () => {
      setTopPopover(null);
      showToast(getWorkspaceMenuCopy(workspacePreferences.language).share.loadError, "error");
    },
    onCommitUserName: normalizeIdentityName,
    onCopyShareUrl: copyShareUrlWithPendingCommit,
    onReorderFiles: reorderFiles,
    onRenameFile: renameWorkspaceFileAction,
    onSelectFile: selectFile,
    onShareOpened: () => productAnalytics.report("share_opened"),
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
    const applyViewMode = () => {
      if (viewModeRequestRef.current !== requestId) return;
      flushPendingEditorCommit();
      documentWorkbenchController.onSetViewMode(viewMode);
    };
    if (viewMode === "edit") {
      applyViewMode();
      return;
    }
    void loadMarkdownPreview().then(applyViewMode).catch(() => undefined);
  });
  const { workbenchProps } = useWorkspaceWorkbenchSurfaceController({
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
    onSetViewMode: setViewModeWithPendingCommit,
    persistence: localWorkspacePersistence,
    previewRef,
    room: roomController,
    surface: documentSurfaceController,
    toolbarLabel: workspaceChromeCopy.documentControls.documentToolbar,
    resolveWorkspaceLink,
  });
  useWorkspaceKeyboardShortcuts({
    importInputRef,
    addFile: addRootFile,
    closeFloatingChrome,
    openFilesPanel,
    openHelp,
    openDocumentSearch: openSearchFromCurrentSelection,
    selectAdjacentFile,
    setActiveFileViewMode: setViewModeWithPendingCommit,
    setCenterPopover,
  });

  return createWorkspaceAppViewModel({
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
      onNewFile: addRootFile,
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
      hydrationStatus,
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
    rightPanelProps,
    topChromeProps,
    workbenchProps,
    rightPanelOpen,
  });
}
