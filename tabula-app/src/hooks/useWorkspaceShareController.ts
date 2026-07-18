import type { Dispatch, SetStateAction } from "react";
import type { ConnectionStatus } from "../collaboration/liveCollaboration";
import type { WorkspaceShareCopy } from "../workspaceLocale";
import type { FileComment, LocationRoom, WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import { useJsonShareController } from "./useJsonShareController";
import { useWorkspaceLiveRoomController } from "./useWorkspaceLiveRoomController";
import type { StartedWorkspaceRoom } from "./useWorkspaceLiveRoomController";

type UseWorkspaceShareControllerOptions = {
  activeFile?: WorkspaceFile;
  room?: LocationRoom | null;
  activeText?: string;
  commentsByFileId: Record<string, FileComment[]>;
  copy: WorkspaceShareCopy;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
  resetCollaborationState: (nextStatus: ConnectionStatus) => void;
  retryCollaborationConnection: () => void;
  setCopiedFileId: Dispatch<SetStateAction<string | null>>;
  showToast: (message: string, tone?: "error" | "neutral") => void;
  startCollaborationSession: () => Promise<
    StartedWorkspaceRoom | undefined
  >;
};

export function useWorkspaceShareController({
  activeFile,
  room,
  activeText,
  commentsByFileId,
  copy,
  files,
  folders,
  getActiveFileSnapshot,
  onBeforeWorkspaceBoundary,
  resetCollaborationState,
  retryCollaborationConnection,
  setCopiedFileId,
  showToast,
  startCollaborationSession,
}: UseWorkspaceShareControllerOptions) {
  const jsonShare = useJsonShareController({
    activeFile,
    activeText,
    commentsByFileId,
    copy,
    files,
    folders,
    getActiveFileSnapshot,
    onBeforeWorkspaceBoundary,
    showToast,
  });
  const liveRoom = useWorkspaceLiveRoomController({
    activeFile,
    room,
    resetCollaborationState,
    retryCollaborationConnection,
    setCopiedFileId,
    startCollaborationSession,
  });

  return {
    jsonShare,
    ...liveRoom,
  };
}
