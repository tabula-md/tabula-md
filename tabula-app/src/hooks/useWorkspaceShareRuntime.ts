import type { Dispatch, SetStateAction } from "react";
import type { ConnectionStatus } from "../collaboration";
import type { WorkspaceShareCopy } from "../workspaceLocale";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";
import { useJsonShareController } from "./useJsonShareController";
import { useWorkspaceLiveRoomController } from "./useWorkspaceLiveRoomController";

type UseWorkspaceShareRuntimeOptions = {
  activeFile?: WorkspaceFile;
  commentsByFileId: Record<string, FileComment[]>;
  copy: WorkspaceShareCopy;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  resetCollaborationState: (nextStatus: ConnectionStatus) => void;
  setCenterPopover: (popover: null) => void;
  setCopiedFileId: Dispatch<SetStateAction<string | null>>;
  showToast: (message: string, tone?: "error" | "neutral") => void;
  startCollaborationSession: () => { roomId: string; shareUrl: string } | undefined;
  stopFileCollaborationSession: (fileId: string) => WorkspaceFile | undefined;
};

export function useWorkspaceShareRuntime({
  activeFile,
  commentsByFileId,
  copy,
  getActiveFileSnapshot,
  resetCollaborationState,
  setCenterPopover,
  setCopiedFileId,
  showToast,
  startCollaborationSession,
  stopFileCollaborationSession,
}: UseWorkspaceShareRuntimeOptions) {
  const jsonShare = useJsonShareController({
    activeFile,
    commentsByFileId,
    copy,
    getActiveFileSnapshot,
    showToast,
  });
  const liveRoom = useWorkspaceLiveRoomController({
    activeFile,
    resetCollaborationState,
    setCenterPopover,
    setCopiedFileId,
    startCollaborationSession,
    stopFileCollaborationSession,
  });

  return {
    jsonShare,
    ...liveRoom,
  };
}
