import type { Dispatch, SetStateAction } from "react";
import type { ConnectionStatus } from "../collaboration";
import type { WorkspaceShareCopy } from "../workspaceLocale";
import type { FileComment, WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import { useJsonShareController } from "./useJsonShareController";
import { useWorkspaceLiveRoomController } from "./useWorkspaceLiveRoomController";

type UseWorkspaceShareRuntimeOptions = {
  activeFile?: WorkspaceFile;
  roomFile?: WorkspaceFile;
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
    { fileId: string; roomId: string; shareUrl: string } | undefined
  >;
  stopFileCollaborationSession: (fileId: string) => WorkspaceFile | undefined;
};

export function useWorkspaceShareRuntime({
  activeFile,
  roomFile,
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
  stopFileCollaborationSession,
}: UseWorkspaceShareRuntimeOptions) {
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
    activeFile: roomFile ?? activeFile,
    resetCollaborationState,
    retryCollaborationConnection,
    setCopiedFileId,
    startCollaborationSession,
    stopFileCollaborationSession,
  });

  return {
    jsonShare,
    ...liveRoom,
  };
}
