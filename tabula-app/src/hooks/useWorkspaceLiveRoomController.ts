import type { Dispatch, SetStateAction } from "react";
import type { ConnectionStatus } from "../collaboration";
import { getRoomShareLinkView } from "../share";
import {
  syncUrlForLocalWorkspace,
  type LocationRoom,
  type WorkspaceFile,
} from "../workspaceStorage";
import type { RoomWorkspaceBootstrap } from "../workspace/session/WorkspaceSession";
import { productAnalytics } from "../observability/productAnalytics";

export type StartedWorkspaceRoom = {
  roomId: string;
  shareUrl: string;
  bootstrap: RoomWorkspaceBootstrap;
};

type UseWorkspaceLiveRoomControllerArgs = {
  activeFile?: WorkspaceFile;
  room?: LocationRoom | null;
  resetCollaborationState: (nextStatus: ConnectionStatus) => void;
  retryCollaborationConnection: () => void;
  setCopiedFileId: Dispatch<SetStateAction<string | null>>;
  startCollaborationSession: () => Promise<
    StartedWorkspaceRoom | undefined
  >;
};

export function useWorkspaceLiveRoomController({
  activeFile,
  room,
  resetCollaborationState,
  retryCollaborationConnection,
  setCopiedFileId,
  startCollaborationSession,
}: UseWorkspaceLiveRoomControllerArgs) {
  const startSession = async () => {
    const startedSession = await startCollaborationSession();
    if (!startedSession) {
      return undefined;
    }

    setCopiedFileId(null);
    return startedSession;
  };

  const stopSession = () => {
    if (!room) {
      return;
    }

    resetCollaborationState("idle");
    setCopiedFileId(null);
    syncUrlForLocalWorkspace();
  };

  const copyShareUrl = async () => {
    const shareUrlView = getRoomShareLinkView(room?.shareUrl, room?.roomId);
    if (!room || !shareUrlView.canCopy || !shareUrlView.url) {
      return;
    }

    await navigator.clipboard.writeText(shareUrlView.url);
    productAnalytics.report("room_link_copied");
    setCopiedFileId(activeFile?.id ?? room.roomId);
    window.setTimeout(() => setCopiedFileId(null), 1600);
  };

  return {
    copyShareUrl,
    retrySession: retryCollaborationConnection,
    startSession,
    stopSession,
  };
}
