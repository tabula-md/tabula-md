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
  appendOkfVerification,
  captureWorkspaceKnowledgeBaseline,
  setOkfConceptType,
  type OkfConceptRepairUpdate,
  type OkfIndexCandidate,
  type OkfWikilinkRepairUpdate,
  type TextChange,
  type TextPatch,
  type WorkspaceKnowledgeLink,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceOkfLogCandidate,
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
  WORKSPACE_ROOT_FOLDER_ID,
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
import type { MarkdownPreviewWorkspaceLink } from "../preview/markdownPreviewTypes";
import {
  decodeMarkdownPreviewFragment,
  resolveMarkdownPreviewWorkspaceLink,
} from "../preview/workspacePreviewLinks";
import { getAmbiguousWorkspaceLinkResolutionEdit } from "./workspaceLinkResolution";
import {
  getWorkspaceFilePaths,
  getWorkspaceFolderPaths,
} from "./workspaceDisplayTitles";
import { getWorkspaceKnowledgeDocuments } from "./workspaceKnowledgeModel";

type WorkspaceMarkdownUpdate = {
  documentId: string;
  beforeMarkdown: string;
  markdown: string;
  patches: readonly TextPatch[];
};

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
  const [
    knowledgeCompatibilityOpenRequest,
    setKnowledgeCompatibilityOpenRequest,
  ] = useState(0);
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
      ...(knowledgeBaseline ? { knowledgeBaseline } : {}),
    }),
    [
      activeFileId,
      commentsByFileId,
      files,
      folders,
      knowledgeBaseline,
      openFileIds,
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
    applyLocalText,
    renameNode: renameRoomNode,
    moveNode: moveRoomNode,
    deleteNode: deleteRoomNode,
    editorBinding,
    materializeWorkspace: materializeRoomWorkspace,
    materializeDocument: materializeRoomDocument,
    materializeDocumentComments: materializeRoomDocumentComments,
    replaceDocumentText: replaceRoomDocumentText,
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
  const applyWorkspaceMarkdownUpdates = useEventCallback((
    updates: readonly WorkspaceMarkdownUpdate[],
  ) => {
    if (updates.length === 0) return false;
    handleUserWorkspaceBoundary();
    const filesById = new Map(files.map((file) => [file.id, file]));
    for (const update of updates) {
      const file = filesById.get(update.documentId);
      if (!file) return false;
      const currentText = file.id === activeFile?.id
        ? getLatestFileText(file.id, file.text)
        : activeRoom
          ? materializeRoomDocument(file.id)
          : file.text;
      if (currentText !== update.beforeMarkdown) return false;
    }

    for (const update of updates) {
      if (update.documentId === activeFile?.id) {
        mapFileCommentAnchors(
          update.documentId,
          update.patches,
          update.beforeMarkdown.length,
        );
        updateActiveFileText(update.markdown, { patches: update.patches });
      } else if (activeRoom) {
        if (!replaceRoomDocumentText(update.documentId, update.markdown)) return false;
        mapFileCommentAnchors(
          update.documentId,
          update.patches,
          update.beforeMarkdown.length,
        );
      } else {
        mapFileCommentAnchors(
          update.documentId,
          update.patches,
          update.beforeMarkdown.length,
        );
        setFileText(update.documentId, update.markdown);
      }
    }
    return true;
  });
  const applyOkfConceptRepairs = useEventCallback((
    updates: readonly OkfConceptRepairUpdate[],
  ) => applyWorkspaceMarkdownUpdates(updates));
  const applyOkfWikilinkRepairs = useEventCallback((
    updates: readonly OkfWikilinkRepairUpdate[],
  ) => applyWorkspaceMarkdownUpdates(updates));
  const verifyKnowledgeDocument = useEventCallback((
    documentId: string,
    verifiedBy: string,
  ) => {
    const file = files.find((candidate) => candidate.id === documentId);
    if (!file) return false;
    flushPendingEditorCommit();
    const currentText = file.id === activeFile?.id
      ? getLatestFileText(file.id, file.text)
      : activeRoom
        ? materializeRoomDocument(file.id)
        : file.text;
    if (currentText === null) return false;
    const result = appendOkfVerification(currentText, verifiedBy);
    if (!result.ok) return false;
    return applyWorkspaceMarkdownUpdates([{
      documentId,
      beforeMarkdown: currentText,
      markdown: result.markdown,
      patches: result.patches,
    }]);
  });
  const startKnowledgeTracking = useEventCallback(() => {
    if (activeRoom) return false;
    handleUserWorkspaceBoundary();
    const snapshot = getWorkspaceSnapshot();
    setKnowledgeBaseline(captureWorkspaceKnowledgeBaseline(
      getWorkspaceKnowledgeDocuments(snapshot.files, snapshot.folders),
    ));
    return true;
  });
  const materializeOkfLog = useEventCallback(async (
    candidate: WorkspaceOkfLogCandidate,
  ) => {
    if (!knowledgeBaseline || activeRoom || !candidate.markdown) return false;
    handleUserWorkspaceBoundary();
    const snapshot = getWorkspaceSnapshot();
    const currentDocuments = getWorkspaceKnowledgeDocuments(
      snapshot.files,
      snapshot.folders,
    );
    const { planWorkspaceOkfLog } = await import(
      "./workspaceKnowledgeChangesRuntime"
    );
    const currentCandidate = planWorkspaceOkfLog(
      knowledgeBaseline,
      currentDocuments,
      candidate.date,
    );
    if (
      currentCandidate.state !== candidate.state
      || currentCandidate.currentMarkdown !== candidate.currentMarkdown
      || currentCandidate.markdown !== candidate.markdown
      || currentCandidate.changeSet.changes.length === 0
    ) {
      return false;
    }

    let materialized = false;
    if (candidate.currentDocumentId && candidate.currentMarkdown) {
      materialized = applyWorkspaceMarkdownUpdates([{
        documentId: candidate.currentDocumentId,
        beforeMarkdown: candidate.currentMarkdown,
        markdown: candidate.markdown,
        patches: [{
          from: 0,
          to: candidate.currentMarkdown.length,
          insert: candidate.markdown,
        }],
      }]);
    } else {
      const rootLogExists = [...getWorkspaceFilePaths(
        snapshot.files,
        snapshot.folders,
      ).values()].some((path) => path.toLocaleLowerCase() === "log.md");
      if (rootLogExists) return false;
      materialized = Boolean(addRoomAwareFileFromContent(
        "log.md",
        candidate.markdown,
        "edit",
        { parentId: WORKSPACE_ROOT_FOLDER_ID },
      ));
    }
    if (!materialized) return false;
    setKnowledgeBaseline(captureWorkspaceKnowledgeBaseline(currentDocuments));
    return true;
  });
  const materializeOkfIndex = useEventCallback((candidate: OkfIndexCandidate) => {
    if (candidate.documentId) {
      if (typeof candidate.currentMarkdown !== "string") return false;
      return applyWorkspaceMarkdownUpdates([{
        documentId: candidate.documentId,
        beforeMarkdown: candidate.currentMarkdown,
        markdown: candidate.markdown,
        patches: [{
          from: 0,
          to: candidate.currentMarkdown.length,
          insert: candidate.markdown,
        }],
      }]);
    }

    handleUserWorkspaceBoundary();
    if ([...getWorkspaceFilePaths(files, folders).values()].includes(candidate.path)) {
      return false;
    }
    const matchingFolderIds = [...getWorkspaceFolderPaths(folders)]
      .filter(([, path]) => path === candidate.directoryPath)
      .map(([folderId]) => folderId);
    if (matchingFolderIds.length !== 1) return false;
    const createdFile = addRoomAwareFileFromContent(
      "index.md",
      candidate.markdown,
      "edit",
      { parentId: matchingFolderIds[0] ?? WORKSPACE_ROOT_FOLDER_ID },
    );
    return Boolean(
      createdFile
      && getWorkspaceStoreSnapshot(workspaceSession.mode).files.some(
        (file) => file.id === createdFile.id,
      )
    );
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
    copyShareUrl: copyShareUrlWithPendingCommit,
    isStartingLive,
    isLiveChromeVisible,
    jsonShare,
    liveRoomOpenTimedOut,
    openLocalWorkspaceAfterRoomFailure,
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
        : surfaceCopy.roomUnavailableTitle,
      "error",
    );
    openLocalWorkspaceAfterRoomFailure();
  }, [
    activeRoom,
    liveRoomOpenState,
    openLocalWorkspaceAfterRoomFailure,
    showToast,
    workspacePreferences.language,
  ]);

  useSelectionActionDismissal({
    selectionActionPosition,
    setSelectionActionPosition,
  });

  const {
    closeJsonShareImport,
    closeWorkspaceExportReview,
    closeWorkspaceFolderImport,
    copyFile,
    confirmWorkspaceArchiveExport,
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
    jsonShareImport,
    openLiveWorkspaceFolder,
    saveLiveWorkspaceFolder,
    toggleLiveFolderAutoSave,
    workspaceExportReview,
    workspaceFolderImport,
    workspaceSourceKind,
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
    knowledgeBaseline,
    replaceCommentsByFileId,
    replaceKnowledgeBaseline: setKnowledgeBaseline,
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
  const selectKnowledgeHealthIssue = useEventCallback(
    (issue: WorkspaceKnowledgeHealthIssue) => {
      const targetFile = files.find((file) => file.id === issue.documentId);
      if (!targetFile) return;
      selectFile(issue.documentId);
      if (
        issue.from === undefined ||
        issue.to === undefined ||
        issue.from < 0 ||
        issue.to < issue.from
      ) {
        return;
      }
      if (targetFile.viewMode !== "edit") {
        setWorkspaceFileViewMode("edit");
      }
      queueEditorTextRange(issue.from, issue.to);
    },
  );
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
    disconnectLiveWorkspaceFolder();
    handleUserWorkspaceBoundary();
    const starterWorkspace = createStarterWorkspaceState();
    replaceWorkspace(starterWorkspace);
    replaceCommentsByFileId({});
    setKnowledgeBaseline(undefined);
    clearFileHistory();
    localWorkspacePersistence.persistNow(starterWorkspace);
    closeFloatingChrome();
    syncUrlForLocalWorkspace("replace");
    showToast(workspaceMenuCopy.clearWorkspace.cleared);
  });
  const reviewWorkspaceExportIssues = useEventCallback(() => {
    closeWorkspaceExportReview();
    setRightPanelOpen(true);
    setRightPanelView("knowledge");
    setKnowledgeCompatibilityOpenRequest((current) => current + 1);
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
    onOpenLiveWorkspace: isLiveFolderSupported && workspaceSourceKind !== "live-folder"
      ? openLiveWorkspaceFolder
      : undefined,
    onSaveLiveWorkspace: workspaceSourceKind === "live-folder"
      ? saveLiveWorkspaceFolder
      : undefined,
    onDisconnectLiveWorkspace: workspaceSourceKind === "live-folder"
      ? disconnectLiveWorkspaceFolder
      : undefined,
    liveFolderAutoSave,
    onToggleLiveFolderAutoSave: workspaceSourceKind === "live-folder"
      ? toggleLiveFolderAutoSave
      : undefined,
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
      knowledgeBaseline,
      knowledgeCompatibilityOpenRequest,
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
      onRenameWorkspace: renameWorkspaceName,
      onMoveFileToFolder: moveWorkspaceFile,
      onMoveFolder: moveWorkspaceFolder,
      onReplyDraftChange: updateCommentReplyDraft,
      onResolveAmbiguousLink: resolveAmbiguousWorkspaceLink,
      onSelectFile: selectFile,
      onSelectKnowledgeHealthIssue: selectKnowledgeHealthIssue,
      onSetActiveFileOkfType: setActiveFileOkfType,
      onApplyOkfConceptRepairs: applyOkfConceptRepairs,
      onApplyOkfWikilinkRepairs: applyOkfWikilinkRepairs,
      onVerifyKnowledgeDocument: verifyKnowledgeDocument,
      onMaterializeOkfIndex: materializeOkfIndex,
      onMaterializeOkfLog: materializeOkfLog,
      onStartKnowledgeTracking: startKnowledgeTracking,
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
    () => (
      target: string,
      syntax?: "markdown" | "wikilink",
      context?: {
        relation?: "link" | "embed";
        sourceDocumentId?: string;
      },
    ) => resolveMarkdownPreviewWorkspaceLink(
      knowledgeIndex,
      context?.sourceDocumentId ?? activeFileId,
      target,
      syntax,
      context?.relation,
    ),
    [activeFileId, knowledgeIndex],
  );
  const resolveWorkspaceDocument = useMemo(
    () => (documentId: string) => {
      const document = knowledgeIndex?.documentsById.get(documentId);
      const analysis = knowledgeIndex?.analysesByDocumentId.get(documentId);
      return document && analysis
        ? { ...document, headings: analysis.headings }
        : undefined;
    },
    [knowledgeIndex],
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
      activeViewMode === "edit" ||
      activeViewMode === "visual"
    ) {
      return undefined;
    }

    let frameId = 0;
    let attempts = 0;
    const scrollToFragment = () => {
      const target = Array.from(
        previewSurfaceRef.current?.querySelectorAll<HTMLElement>("[id]") ?? [],
      ).find((element) =>
        element.id === pendingPreviewNavigation.fragment &&
        !element.closest(".preview-workspace-embed-body")
      );
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
    isStartingLive,
    isLive: isLiveChromeVisible,
    isLiveConnected,
    jsonShare,
    language: workspacePreferences.language,
    openFiles,
    lastClosedFile,
    room: activeRoom,
    rightPanelOpen,
    topPopover,
    workspaceMenuOpen,
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
    if (viewMode === "edit" || viewMode === "visual") {
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
        onOpenWorkspace: () => workspaceImportInputRef.current?.click(),
      },
      localOpening:
        localPersistenceEnabled && localWorkspacePersistence.pending,
    },
    chrome: {
      menu: menuSurfaceProps,
      top: topChromeProps,
    },
    panels: {
      right: rightPanelProps,
    },
    overlays: {
      workspace: {
        infoDialog,
        jsonShareImport,
        workspaceFolderImport,
        workspaceExportReview,
        language: workspacePreferences.language,
        shortcutPlatform,
        toast,
        onCloseInfoDialog: () => setInfoDialog(null),
        onCloseWorkspaceFolderImport: closeWorkspaceFolderImport,
        onCloseWorkspaceExportReview: closeWorkspaceExportReview,
        onDismissToast: dismissToast,
        onPauseToast: pauseToast,
        onResumeToast: resumeToast,
        onCloseJsonShareImport: closeJsonShareImport,
        onReplaceWorkspaceWithJsonShare: replaceWorkspaceWithJsonShare,
        onReplaceWorkspaceWithFolder: replaceWorkspaceWithFolder,
        onConfirmWorkspaceExport: confirmWorkspaceArchiveExport,
        onReviewWorkspaceExportIssues: reviewWorkspaceExportIssues,
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
