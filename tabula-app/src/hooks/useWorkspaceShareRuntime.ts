import type { Dispatch, SetStateAction } from "react";
import type { ConnectionStatus } from "../collaboration";
import type { WorkspaceShareCopy } from "../workspaceLocale";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";
import { useJsonShareController } from "./useJsonShareController";
import { useWorkspaceLiveRoomController } from "./useWorkspaceLiveRoomController";

type UseWorkspaceShareRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeText?: string;
  commentsByFileId: Record<string, FileComment[]>;
  copy: WorkspaceShareCopy;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
  resetCollaborationState: (nextStatus: ConnectionStatus) => void;
  setCenterPopover: (popover: null) => void;
  setCopiedFileId: Dispatch<SetStateAction<string | null>>;
  showToast: (message: string, tone?: "error" | "neutral") => void;
  startCollaborationSession: () => { roomId: string; shareUrl: string } | undefined;
  stopFileCollaborationSession: (fileId: string) => WorkspaceFile | undefined;
};

export function useWorkspaceShareRuntime({
  activeFile,
  activeText,
  commentsByFileId,
  copy,
  getActiveFileSnapshot,
  onBeforeWorkspaceBoundary,
  resetCollaborationState,
  setCenterPopover,
  setCopiedFileId,
  showToast,
  startCollaborationSession,
  stopFileCollaborationSession,
}: UseWorkspaceShareRuntimeOptions) {
  const jsonShare = useJsonShareController({
    activeFile,
    activeText,
    commentsByFileId,
    copy,
    getActiveFileSnapshot,
    onBeforeWorkspaceBoundary,
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
