import type { Dispatch, SetStateAction } from "react";
import type { ConnectionStatus } from "../collaboration";
import { getRoomShareLinkView } from "../share";
import {
  syncUrlForFile,
  type WorkspaceFile,
} from "../workspaceStorage";

type UseWorkspaceLiveRoomControllerArgs = {
  activeFile?: WorkspaceFile;
  resetCollaborationState: (nextStatus: ConnectionStatus) => void;
  setCenterPopover: (popover: null) => void;
  setCopiedFileId: Dispatch<SetStateAction<string | null>>;
  startCollaborationSession: () => { roomId: string; shareUrl: string } | undefined;
  stopFileCollaborationSession: (fileId: string) => WorkspaceFile | undefined;
};

export function useWorkspaceLiveRoomController({
  activeFile,
  resetCollaborationState,
  setCenterPopover,
  setCopiedFileId,
  startCollaborationSession,
  stopFileCollaborationSession,
}: UseWorkspaceLiveRoomControllerArgs) {
  const startSession = () => {
    const startedSession = startCollaborationSession();
    if (!startedSession) {
      return;
    }

    setCopiedFileId(null);
    setCenterPopover(null);
    syncUrlForFile(startedSession);
  };

  const stopSession = () => {
    if (!activeFile?.roomId) {
      return;
    }

    const stoppedFileId = activeFile.id;
    resetCollaborationState("idle");
    setCopiedFileId(null);
    stopFileCollaborationSession(stoppedFileId);
    syncUrlForFile(undefined);
  };

  const copyShareUrl = async () => {
    const shareUrlView = getRoomShareLinkView(activeFile?.shareUrl, activeFile?.roomId);
    if (!activeFile || !shareUrlView.canCopy || !shareUrlView.url) {
      return;
    }

    await navigator.clipboard.writeText(shareUrlView.url);
    setCopiedFileId(activeFile.id);
    window.setTimeout(() => setCopiedFileId(null), 1600);
  };

  return {
    copyShareUrl,
    startSession,
    stopSession,
  };
}
