import type { Dispatch, SetStateAction } from "react";
import type { ConnectionStatus } from "../collaboration";
import { getRoomShareLinkView } from "../share";
import { syncUrlForFile, type LocationRoom, type WorkspaceFile } from "../workspaceStorage";

type UseWorkspaceLiveRoomControllerArgs = {
  activeFile?: WorkspaceFile;
  room?: LocationRoom | null;
  resetCollaborationState: (nextStatus: ConnectionStatus) => void;
  retryCollaborationConnection: () => void;
  setCopiedFileId: Dispatch<SetStateAction<string | null>>;
  startCollaborationSession: () => Promise<
    { fileId: string; roomId: string; shareUrl: string } | undefined
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
    syncUrlForFile(undefined);
  };

  const copyShareUrl = async () => {
    const shareUrlView = getRoomShareLinkView(room?.shareUrl, room?.roomId);
    if (!room || !shareUrlView.canCopy || !shareUrlView.url) {
      return;
    }

    await navigator.clipboard.writeText(shareUrlView.url);
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
