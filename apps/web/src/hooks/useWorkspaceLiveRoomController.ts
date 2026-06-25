import type { Dispatch, SetStateAction } from "react";
import type { ConnectionStatus } from "../collab";
import type { MarkdownFile } from "../workspaceStorage";

export type ActiveLiveRoomNotice = {
  title: string;
  message: string;
  canKeepLocal: boolean;
};

type UseWorkspaceLiveRoomControllerArgs = {
  activeFile?: MarkdownFile;
  activeStatus: ConnectionStatus;
  resetCollaborationState: (nextStatus: ConnectionStatus) => void;
  setCenterPopover: (popover: null) => void;
  setCopiedFileId: Dispatch<SetStateAction<string | null>>;
  startCollaborationSession: () => { roomId: string; shareUrl: string } | undefined;
  stopFileCollaborationSession: (fileId: string) => MarkdownFile | undefined;
};

export const getLiveRoomNotice = (
  file: MarkdownFile | undefined,
  status: ConnectionStatus,
): ActiveLiveRoomNotice | null => {
  if (
    !file?.roomId ||
    status !== "offline" ||
    file.lastRecoveryType !== "invalid-message" ||
    !file.lastRecoveryMessage
  ) {
    return null;
  }

  const sourceMessage = file.lastRecoveryMessage;
  const normalizedMessage = sourceMessage.toLowerCase();

  if (normalizedMessage.includes("missing its client-only room key")) {
    return {
      title: "Room key missing",
      message:
        "This shared URL is missing the client-only key, so Tabula cannot decrypt the room. Ask for the full link or keep this file as a local copy.",
      canKeepLocal: true,
    };
  }

  if (normalizedMessage.includes("invalid room key")) {
    return {
      title: "Room key invalid",
      message:
        "The key in this shared URL is not valid. Ask for a fresh room link or keep this file as a local copy.",
      canKeepLocal: true,
    };
  }

  if (normalizedMessage.includes("could not be decrypted")) {
    return {
      title: "Room key does not match",
      message:
        "The key in this URL cannot decrypt the latest room snapshot. The encrypted room was not changed.",
      canKeepLocal: true,
    };
  }

  if (normalizedMessage.includes("server disconnected") || normalizedMessage.includes("not reachable")) {
    return null;
  }

  return {
    title: "Live room needs attention",
    message: sourceMessage,
    canKeepLocal: true,
  };
};

export function useWorkspaceLiveRoomController({
  activeFile,
  activeStatus,
  resetCollaborationState,
  setCenterPopover,
  setCopiedFileId,
  startCollaborationSession,
  stopFileCollaborationSession,
}: UseWorkspaceLiveRoomControllerArgs) {
  const activeLiveRoomNotice = getLiveRoomNotice(activeFile, activeStatus);

  const startSession = () => {
    const startedSession = startCollaborationSession();
    if (!startedSession) {
      return;
    }

    setCopiedFileId(null);
    setCenterPopover(null);
  };

  const stopSession = () => {
    if (!activeFile?.roomId) {
      return;
    }

    const stoppedFileId = activeFile.id;
    resetCollaborationState("idle");
    setCopiedFileId(null);
    stopFileCollaborationSession(stoppedFileId);
  };

  const copyShareUrl = async () => {
    const url = activeFile?.shareUrl || window.location.href;
    await navigator.clipboard.writeText(url);
    if (activeFile) {
      setCopiedFileId(activeFile.id);
    }
    window.setTimeout(() => setCopiedFileId(null), 1600);
  };

  return {
    activeLiveRoomNotice,
    copyShareUrl,
    startSession,
    stopSession,
  };
}
