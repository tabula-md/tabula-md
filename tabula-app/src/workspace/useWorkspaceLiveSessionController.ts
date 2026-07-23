import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useEventCallback } from "../shared/useEventCallback";
import type { useAppToast } from "../ui/useAppToast";
import {
  clearWorkspaceDocumentBodies,
} from "../collaboration/workspaceRoomProjection";
import { useLiveRoomConnectionLifecycle } from "../collaboration/useLiveRoomConnectionLifecycle";
import type { LiveRoomOpenFailure } from "../collaboration/liveRoomOpenState";
import { clientErrorReporter } from "../observability/clientErrorReporting";
import { productAnalytics } from "../observability/productAnalytics";
import { useWorkspaceShareController } from "../share/useWorkspaceShareController";
import { readIndexedDbWorkspace } from "./persistence/workspaceIndexedDb";
import type { ActiveRoomDocumentProjectionStore } from "../collaboration/runtime/ActiveRoomDocumentProjectionStore";
import {
  getWorkspaceStoreForMode,
  getWorkspaceStoreSnapshot,
} from "./state/workspaceStore";
import type { useFileComments } from "../comments/useFileComments";
import type { useWorkspaceFiles } from "./state/useWorkspaceFiles";
import type { useWorkspaceChromeController } from "./useWorkspaceChromeController";
import type { useWorkspaceRoomController } from "./useWorkspaceRoomController";
import { useWorkspaceRouteRuntime } from "./useWorkspaceRouteRuntime";
import type { WorkspaceSessionHost } from "./session/WorkspaceSessionHost";
import {
  createRoomWorkspaceState,
  createStarterWorkspaceState,
  syncUrlForLocalWorkspace,
  type LocationRoom,
  type WorkspaceFile,
  type WorkspaceState,
} from "./workspaceStorage";
import type { WorkspaceShareCopy } from "./workspaceLocale";

type WorkspaceFilesController = ReturnType<typeof useWorkspaceFiles>;
type FileCommentsController = ReturnType<typeof useFileComments>;
type WorkspaceChromeController = ReturnType<typeof useWorkspaceChromeController>;
type WorkspaceRoomController = ReturnType<typeof useWorkspaceRoomController>;

type UseWorkspaceLiveSessionControllerOptions = {
  chrome: Pick<
    WorkspaceChromeController,
    "setCenterPopover" | "setTopPopover"
  >;
  comments: Pick<FileCommentsController, "commentsByFileId" | "replaceCommentsByFileId">;
  copy: WorkspaceShareCopy;
  flushPendingEditorCommit: () => void;
  getActiveFileSnapshot: () => WorkspaceFile | undefined;
  getWorkspaceSnapshot: () => WorkspaceState;
  handlePersistenceError: (error: unknown) => void;
  liveRoomOpenFailure: LiveRoomOpenFailure | null;
  onBeforeWorkspaceBoundary: () => void;
  room: Pick<
    WorkspaceRoomController,
    | "connectionStatus"
    | "hydrationStatus"
    | "isLive"
    | "resetCollaborationState"
    | "resetRoomView"
    | "retryConnection"
    | "startSession"
  >;
  roomDocumentProjectionStore: ActiveRoomDocumentProjectionStore;
  sessionHost: WorkspaceSessionHost;
  setCopiedFileId: Dispatch<SetStateAction<string | null>>;
  setLiveRoomOpenFailure: (failure: LiveRoomOpenFailure | null) => void;
  showToast: ReturnType<typeof useAppToast>["showToast"];
  text: string;
  workspace: WorkspaceFilesController;
};

export function useWorkspaceLiveSessionController({
  chrome,
  comments,
  copy,
  flushPendingEditorCommit,
  getActiveFileSnapshot,
  getWorkspaceSnapshot,
  handlePersistenceError,
  liveRoomOpenFailure,
  onBeforeWorkspaceBoundary,
  room,
  roomDocumentProjectionStore,
  sessionHost,
  setCopiedFileId,
  setLiveRoomOpenFailure,
  showToast,
  text,
  workspace,
}: UseWorkspaceLiveSessionControllerOptions) {
  const activeRoomSession = sessionHost.getSnapshot();
  const activeRoom = activeRoomSession.mode === "room" ? activeRoomSession.room : null;
  const [isStartingLive, setIsStartingLive] = useState(false);
  const pendingCreatedRoomIdRef = useRef<string | null>(null);
  const previousRoomConnectionRef = useRef<{
    recovering: boolean;
    roomId: string;
    status: WorkspaceRoomController["connectionStatus"];
  } | null>(null);
  const { copyShareUrl, jsonShare, startSession, stopSession } =
    useWorkspaceShareController({
      activeFile: workspace.activeFile,
      room: activeRoom,
      activeText: text,
      commentsByFileId: comments.commentsByFileId,
      copy,
      files: workspace.files,
      folders: workspace.folders,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary,
      resetCollaborationState: room.resetCollaborationState,
      retryCollaborationConnection: room.retryConnection,
      setCopiedFileId,
      showToast,
      startCollaborationSession: room.startSession,
    });

  useEffect(() => {
    const roomId = activeRoom?.roomId;
    const status = room.connectionStatus;
    const previous = previousRoomConnectionRef.current;
    if (!roomId) {
      previousRoomConnectionRef.current = null;
      return;
    }
    if (!previous || previous.roomId !== roomId) {
      previousRoomConnectionRef.current = { recovering: false, roomId, status };
      return;
    }

    let recovering = previous.recovering;
    if (previous.status === status) return;
    if (status === "reconnecting" && previous.status === "connected") {
      recovering = true;
      showToast(copy.live.reconnectingTitle);
    } else if (
      status === "disconnected" &&
      (previous.status === "connected" || previous.status === "reconnecting")
    ) {
      recovering = true;
      showToast(copy.live.disconnectedTitle, "error");
    } else if (status === "connected" && recovering) {
      recovering = false;
      showToast(copy.live.reconnectedTitle);
    }
    previousRoomConnectionRef.current = { recovering, roomId, status };
  }, [
    activeRoom?.roomId,
    copy.live.disconnectedTitle,
    copy.live.reconnectedTitle,
    copy.live.reconnectingTitle,
    room.connectionStatus,
    showToast,
  ]);
  useEffect(() => {
    const pendingRoomId = pendingCreatedRoomIdRef.current;
    if (
      !isStartingLive ||
      !pendingRoomId ||
      activeRoom?.roomId !== pendingRoomId ||
      room.connectionStatus !== "connected" ||
      room.hydrationStatus !== "ready"
    ) {
      return;
    }

    pendingCreatedRoomIdRef.current = null;
    setIsStartingLive(false);
    productAnalytics.report("room_created", { roomId: pendingRoomId });
  }, [
    activeRoom?.roomId,
    isStartingLive,
    room.connectionStatus,
    room.hydrationStatus,
  ]);

  const openLocalWorkspaceAfterRoomFailure = useEventCallback(() => {
    pendingCreatedRoomIdRef.current = null;
    setIsStartingLive(false);
    flushPendingEditorCommit();
    room.resetCollaborationState("idle");
    roomDocumentProjectionStore.clear();
    setCopiedFileId(null);
    sessionHost.openLocal();
    setLiveRoomOpenFailure(null);
    syncUrlForLocalWorkspace("replace");
    void readIndexedDbWorkspace()
      .then((storedWorkspace) => {
        const nextStoredWorkspace = storedWorkspace ?? createStarterWorkspaceState();
        getWorkspaceStoreForMode("local").getState().replaceWorkspace(nextStoredWorkspace);
        comments.replaceCommentsByFileId(nextStoredWorkspace.commentsByFileId);
      })
      .catch(handlePersistenceError);
  });
  const copyShareUrlWithPendingCommit = useEventCallback(async () => {
    flushPendingEditorCommit();
    try {
      await copyShareUrl();
    } catch (error) {
      clientErrorReporter.report({
        feature: "collaboration",
        operation: "copy-room-link",
        error,
      });
      showToast(copy.copyFailed, "error");
    }
  });
  const startSessionWithPendingCommit = useEventCallback(async () => {
    if (isStartingLive) return;

    pendingCreatedRoomIdRef.current = null;
    setIsStartingLive(true);
    flushPendingEditorCommit();
    try {
      const startedSession = await startSession();
      if (!startedSession) {
        setIsStartingLive(false);
        chrome.setTopPopover(null);
        showToast(copy.live.unavailable, "error");
        return;
      }

      pendingCreatedRoomIdRef.current = startedSession.roomId;
      setLiveRoomOpenFailure(null);
      const roomWorkspace = {
        ...getWorkspaceStoreSnapshot("local"),
        folders: workspace.folders,
      };
      roomDocumentProjectionStore.prime(roomWorkspace.files);
      getWorkspaceStoreForMode("room").getState().replaceWorkspace(
        clearWorkspaceDocumentBodies(roomWorkspace),
      );
      sessionHost.openRoom(
        { roomId: startedSession.roomId, shareUrl: startedSession.shareUrl },
        startedSession.bootstrap,
        "created",
      );
    } catch (error) {
      pendingCreatedRoomIdRef.current = null;
      setIsStartingLive(false);
      roomDocumentProjectionStore.clear();
      clientErrorReporter.report({
        feature: "collaboration",
        operation: "start-session",
        error,
      });
      chrome.setTopPopover(null);
      showToast(copy.live.unavailable, "error");
    }
  });
  const stopSessionWithPendingCommit = useEventCallback(() => {
    pendingCreatedRoomIdRef.current = null;
    setIsStartingLive(false);
    flushPendingEditorCommit();
    getWorkspaceStoreForMode("local").getState().replaceWorkspace(getWorkspaceSnapshot());
    stopSession();
    room.resetCollaborationState("idle");
    roomDocumentProjectionStore.clear();
    syncUrlForLocalWorkspace("replace");
    sessionHost.openLocal();
    setLiveRoomOpenFailure(null);
  });
  const handleLiveRoomConnectionFailed = useEventCallback(() => {
    chrome.setTopPopover(null);
    showToast(copy.live.unavailable, "error");
    stopSessionWithPendingCommit();
  });
  const { timedOut } = useLiveRoomConnectionLifecycle({
    activeFileAvailable: Boolean(workspace.activeFile),
    activeRoom,
    connectionStatus: room.connectionStatus,
    hydrationStatus: room.hydrationStatus,
    onConnectionFailed: handleLiveRoomConnectionFailed,
  });
  const handleRouteWorkspaceChange = useEventCallback(() => {
    chrome.setTopPopover(null);
    chrome.setCenterPopover(null);
    setCopiedFileId(null);
  });
  const activateRoomWorkspace = useEventCallback((nextRoom: LocationRoom) => {
    pendingCreatedRoomIdRef.current = null;
    setIsStartingLive(false);
    room.resetRoomView(nextRoom.roomId);
    setLiveRoomOpenFailure(null);
    roomDocumentProjectionStore.clear();
    getWorkspaceStoreForMode("room").getState().replaceWorkspace(createRoomWorkspaceState());
    sessionHost.openRoom(nextRoom);
  });
  useWorkspaceRouteRuntime({
    activateRoomWorkspace,
    isRoomSession: Boolean(activeRoom),
    onBeforeWorkspaceBoundary,
    onRouteWorkspaceChange: handleRouteWorkspaceChange,
    onLeaveRoom: openLocalWorkspaceAfterRoomFailure,
  });

  return {
    copyShareUrl: copyShareUrlWithPendingCommit,
    isStartingLive,
    isLiveChromeVisible:
      room.isLive &&
      room.hydrationStatus === "ready" &&
      !isStartingLive &&
      !liveRoomOpenFailure &&
      !timedOut,
    jsonShare,
    liveRoomOpenTimedOut: timedOut,
    openLocalWorkspaceAfterRoomFailure,
    startSession: startSessionWithPendingCommit,
    stopSession: stopSessionWithPendingCommit,
  };
}
