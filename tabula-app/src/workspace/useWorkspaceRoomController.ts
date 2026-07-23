import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type MutableRefObject,
  type RefObject,
} from "react";
import type {
  WorkspaceRoomComment,
  WorkspaceRoomSnapshot,
  WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";
import type { MarkdownEditorHandle } from "../document/markdownEditorTypes";
import { useEventCallback } from "../shared/useEventCallback";
import type { useAppToast } from "../ui/useAppToast";
import {
  createWorkspaceFile,
  WORKSPACE_ROOT_FOLDER_ID,
  type FileComment,
  type FileCommentReply,
  type WorkspaceFile,
} from "./workspaceStorage";
import type { WorkspaceActionCopy } from "./workspaceActionLocale";
import type { WorkspaceSession } from "./session/WorkspaceSession";
import type { ActiveRoomDocumentProjectionStore } from "../collaboration/runtime/ActiveRoomDocumentProjectionStore";
import { useWorkspaceCollaborationRuntime } from "../collaboration/useWorkspaceCollaborationRuntime";
import { useCollaborationPresenceIdentity } from "../collaboration/useCollaborationPresenceIdentity";
import { useParticipantFollowController } from "../collaboration/useParticipantFollowController";
import {
  projectWorkspaceRoomComments,
  projectWorkspaceRoomStructure,
} from "../collaboration/workspaceRoomProjection";
import {
  readRoomViewState,
  restoreRoomWorkspaceView,
  writeRoomViewState,
} from "../collaboration/roomViewState";
import type { useWorkspaceFiles } from "./state/useWorkspaceFiles";
import type { useFileComments } from "../comments/useFileComments";
import type { useWorkspaceChromeController } from "./useWorkspaceChromeController";
import {
  getWorkspaceStoreSnapshot,
  type DeletedWorkspaceFolderBundle,
} from "./state/workspaceStore";
import type { LiveRoomOpenFailure } from "../collaboration/liveRoomOpenState";
import type { Collaborator } from "../collaboration/liveCollaboration";

export type RoomCommentActions = {
  created: (fileId: string, comment: FileComment) => void;
  deleted: (fileId: string, commentId: string) => void;
  resolved: (fileId: string, commentId: string, resolved: boolean) => void;
  replied: (fileId: string, commentId: string, reply: FileCommentReply) => void;
};

type WorkspaceFilesController = ReturnType<typeof useWorkspaceFiles>;
type FileCommentsController = ReturnType<typeof useFileComments>;
type WorkspaceChromeController = ReturnType<typeof useWorkspaceChromeController>;

type UseWorkspaceRoomControllerOptions = {
  activeRoomSession: Extract<WorkspaceSession, { mode: "room" }> | null;
  activeViewMode: WorkspaceFile["viewMode"];
  bumpVisibleTextRevision: () => void;
  chrome: Pick<
    WorkspaceChromeController,
    "rightPanelOpen" | "rightPanelView" | "setRightPanelOpen" | "setRightPanelView"
  >;
  comments: Pick<
    FileCommentsController,
    "commentsByFileId" | "replaceCommentsByFileId"
  >;
  copy: WorkspaceActionCopy;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  getCollaborationSessionFileSnapshot: () => WorkspaceFile | undefined;
  identity: Collaborator;
  materializeRoomWorkspaceRef: MutableRefObject<
    () => WorkspaceRoomSnapshot | undefined
  >;
  onOpenFailure: (failure: LiveRoomOpenFailure) => void;
  roomCommentActionsRef: MutableRefObject<RoomCommentActions>;
  roomDocumentProjectionStore: ActiveRoomDocumentProjectionStore;
  showToast: ReturnType<typeof useAppToast>["showToast"];
  workspace: WorkspaceFilesController;
  workspaceSession: WorkspaceSession;
};

const emptyRoomCommentActions = (): RoomCommentActions => ({
  created: () => undefined,
  deleted: () => undefined,
  resolved: () => undefined,
  replied: () => undefined,
});

export function useWorkspaceRoomController({
  activeRoomSession,
  activeViewMode,
  bumpVisibleTextRevision,
  chrome,
  comments,
  copy,
  editorRef,
  getCollaborationSessionFileSnapshot,
  identity,
  materializeRoomWorkspaceRef,
  onOpenFailure,
  roomCommentActionsRef,
  roomDocumentProjectionStore,
  showToast,
  workspace,
  workspaceSession,
}: UseWorkspaceRoomControllerOptions) {
  const activeRoom = activeRoomSession?.room ?? null;
  const activeRoomId = activeRoom?.roomId;
  const activeRoomDocument = activeRoom ? workspace.activeFile : undefined;
  const restoredRoomViewsRef = useRef(new Set<string>());
  const followState = useSyncExternalStore(
    workspaceSession.follow.subscribe,
    workspaceSession.follow.getSnapshot,
    workspaceSession.follow.getSnapshot,
  );

  const sessionStartDocuments = useMemo(
    () => activeRoom ? [] : workspace.files.map((file) => ({
      id: file.id,
      title: file.title,
      text: file.text,
      parentId: file.parentId,
      order: file.order,
    })),
    [activeRoom, workspace.files],
  );
  const sessionStartFolders = useMemo(
    () => activeRoom ? [] : workspace.folders,
    [activeRoom, workspace.folders],
  );
  const sessionStartComments = useMemo<Record<string, WorkspaceRoomComment[]>>(() => {
    const documentIds = new Set(sessionStartDocuments.map((document) => document.id));
    return Object.fromEntries(
      Object.entries(comments.commentsByFileId)
        .filter(([fileId]) => documentIds.has(fileId))
        .map(([fileId, fileComments]) => [fileId, fileComments.map((comment) => ({
          ...comment,
          fileId,
          resolved: comment.resolved ?? false,
          replies: comment.replies ?? [],
        }))]),
    );
  }, [comments.commentsByFileId, sessionStartDocuments]);
  const handleRoomCapacityExceeded = useEventCallback(() => {
    showToast(copy.roomCapacityExceeded, "error");
  });
  const collaboration = useWorkspaceCollaborationRuntime({
    session: activeRoomSession,
    activeDocument: workspace.activeFile,
    editorPresenceEnabled:
      Boolean(activeRoomDocument) &&
      activeViewMode !== "preview" &&
      followState.status === "idle",
    getSessionFileSnapshot: getCollaborationSessionFileSnapshot,
    identity,
    workspaceDocuments: sessionStartDocuments,
    workspaceFolders: sessionStartFolders,
    commentsByFileId: sessionStartComments,
    onOpenFailure,
    onCapacityExceeded: handleRoomCapacityExceeded,
  });
  materializeRoomWorkspaceRef.current = collaboration.materializeWorkspace;

  const mergeWorkspaceRoomStructure = useEventCallback((
    snapshot: WorkspaceRoomStructureSnapshot,
  ) => {
    if (activeRoomId && snapshot.roomId !== activeRoomId) return;
    const workspaceSnapshot = {
      ...getWorkspaceStoreSnapshot("room"),
      folders: workspace.folders,
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
        chrome.setRightPanelView(roomViewState.rightPanelView);
        chrome.setRightPanelOpen(roomViewState.rightPanelOpen);
      }
    }
    workspace.replaceWorkspace(nextWorkspace);
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
      showToast(copy.documentAdded(addedDocument.title), "neutral", {
        actionLabel: "Open",
        onAction: () => workspace.selectFile(addedDocument.id),
      });
    } else if (renamedDocuments.length === 1 && addedDocuments.length === 0 && deletedDocuments.length === 0) {
      const renamedDocument = renamedDocuments[0];
      showToast(copy.documentRenamed(
        previousRoomFilesById.get(renamedDocument.id)?.title ?? renamedDocument.title,
        renamedDocument.title,
      ));
    } else if (addedDocuments.length || deletedDocuments.length || renamedDocuments.length || foldersChanged) {
      showToast(copy.sharedWorkspaceUpdated);
    }
  });

  const {
    addCommentReply,
    deleteComment,
    setCommentResolved,
    upsertComment,
  } = collaboration;
  useEffect(() => {
    if (!activeRoomId || workspace.files.length === 0) return;
    writeRoomViewState(activeRoomId, {
      activeDocumentId: workspace.activeFileId || undefined,
      openDocumentIds: workspace.openFileIds,
      rightPanelOpen: chrome.rightPanelOpen,
      rightPanelView: chrome.rightPanelView,
    });
  }, [
    activeRoomId,
    chrome.rightPanelOpen,
    chrome.rightPanelView,
    workspace.activeFileId,
    workspace.files,
    workspace.openFileIds,
  ]);
  useEffect(() => {
    const snapshot = collaboration.structureSnapshot;
    if (!activeRoomId || !snapshot || snapshot.roomId !== activeRoomId) return;
    mergeWorkspaceRoomStructure(snapshot);
  }, [activeRoomId, collaboration.structureSnapshot, mergeWorkspaceRoomStructure]);
  useEffect(() => {
    if (!activeRoomId) return;
    comments.replaceCommentsByFileId(
      activeRoomDocument?.id
        ? projectWorkspaceRoomComments({
            [activeRoomDocument.id]: [...collaboration.activeDocumentComments],
          })
        : {},
      { preserveInteraction: true },
    );
  }, [
    activeRoomDocument?.id,
    activeRoomId,
    collaboration.activeDocumentComments,
    comments.replaceCommentsByFileId,
  ]);

  const localPresenceIdentity = useMemo(
    () => ({ ...identity, presenceState: collaboration.localPresenceState }),
    [collaboration.localPresenceState, identity],
  );
  const presenceIdentity = useCollaborationPresenceIdentity({
    identity: localPresenceIdentity,
    isLive: collaboration.isLive,
  });
  useEffect(() => {
    if (activeRoomDocument && collaboration.activeDocumentProjection !== null) {
      if (roomDocumentProjectionStore.set(
        activeRoomDocument.id,
        collaboration.activeDocumentProjection,
      )) {
        bumpVisibleTextRevision();
      }
      return;
    }
    if (!activeRoomDocument && roomDocumentProjectionStore.clear()) {
      bumpVisibleTextRevision();
    }
  }, [
    activeRoomDocument?.id,
    collaboration.activeDocumentProjection,
    roomDocumentProjectionStore,
  ]);
  const publishCurrentRoomViewport = useEventCallback(() => {
    const viewport = editorRef.current?.getViewport();
    collaboration.setViewport(
      viewport && activeRoomDocument
        ? { documentId: activeRoomDocument.id, ...viewport }
        : null,
    );
  });
  useEffect(() => {
    if (!collaboration.editorBinding || !activeRoomDocument || activeViewMode === "preview") {
      collaboration.setViewport(null);
      return;
    }
    const frame = window.requestAnimationFrame(publishCurrentRoomViewport);
    return () => window.cancelAnimationFrame(frame);
  }, [activeRoomDocument?.id, activeViewMode, collaboration.editorBinding?.documentId]);

  const follow = useParticipantFollowController({
    activeDocumentId: workspace.activeFileId,
    collaborators: collaboration.collaborators,
    editorRef,
    files: workspace.files,
    followState,
    identityId: identity.id,
    isLive: collaboration.isLive,
    roomId: activeRoomId,
    selectDocument: workspace.selectFile,
    startFollowState: workspaceSession.follow.start,
    stopFollowState: workspaceSession.follow.stop,
    setFollowingActor: collaboration.setFollowingActor,
    showError: (message) => showToast(message, "error"),
    showNotice: showToast,
  });

  const publishRoomDocument = useEventCallback((file: WorkspaceFile) =>
    !activeRoom || collaboration.createDocument({
      id: file.id,
      title: file.title,
      markdown: file.text,
      parentId: file.parentId ?? WORKSPACE_ROOT_FOLDER_ID,
      order: file.order,
    }));
  const publishRoomDocumentProjection = useEventCallback((file: WorkspaceFile) =>
    publishRoomDocument(file));
  const restoreRoomDocument = useEventCallback((file: WorkspaceFile, fileComments: FileComment[]) => {
    if (!publishRoomDocument(file)) return false;
    for (const comment of fileComments) {
      collaboration.upsertComment({
        ...comment,
        fileId: file.id,
        resolved: comment.resolved ?? false,
        replies: comment.replies ?? [],
      });
    }
    return true;
  });
  const publishRoomFolder = useEventCallback((folder: (typeof workspace.folders)[number]) =>
    !activeRoom || collaboration.createFolder({
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
    viewMode?: WorkspaceFile["viewMode"],
    overrides?: Partial<WorkspaceFile>,
  ) => {
    const nextFile = workspace.addFileFromContent(
      title,
      activeRoom ? "" : fileText,
      viewMode,
      overrides,
    );
    if (activeRoom && !publishRoomDocument({ ...nextFile, text: fileText })) {
      workspace.deleteFile(nextFile.id);
      showToast(copy.importRoomFailed, "error");
    }
    return nextFile;
  });

  useEffect(() => {
    const isSharedRoomFile = (fileId: string) =>
      Boolean(activeRoomId && workspace.files.some((file) => file.id === fileId));
    roomCommentActionsRef.current = {
      created: (fileId, comment) => {
        if (!isSharedRoomFile(fileId)) return;
        upsertComment({
          ...comment,
          fileId,
          resolved: comment.resolved ?? false,
          replies: comment.replies ?? [],
        });
      },
      deleted: (fileId, commentId) => {
        if (isSharedRoomFile(fileId)) deleteComment(commentId);
      },
      resolved: (fileId, commentId, resolved) => {
        if (isSharedRoomFile(fileId)) setCommentResolved(commentId, resolved);
      },
      replied: (fileId, commentId, reply) => {
        if (isSharedRoomFile(fileId)) addCommentReply(commentId, reply);
      },
    };
    return () => {
      roomCommentActionsRef.current = emptyRoomCommentActions();
    };
  }, [
    activeRoomId,
    addCommentReply,
    deleteComment,
    roomCommentActionsRef,
    setCommentResolved,
    upsertComment,
    workspace.files,
  ]);

  return {
    ...collaboration,
    ...follow,
    activeRoom,
    activeRoomId,
    addRoomAwareFileFromContent,
    followState,
    isLiveConnected:
      collaboration.isLive && collaboration.connectionStatus === "connected",
    presenceIdentity,
    publishCurrentRoomViewport,
    publishRoomDocumentProjection,
    publishRoomFolder,
    resetRoomView: (roomId: string) => restoredRoomViewsRef.current.delete(roomId),
    restoreRoomDocument,
    restoreRoomFolderBundle,
  };
}
