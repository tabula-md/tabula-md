import type { WorkspaceRoomComment } from "@tabula-md/tabula";
import type {
  Collaborator,
  CollabRecoveryEvent,
} from "../collaboration";
import type { LocationRoom, WorkspaceFile } from "../workspaceStorage";
import {
  getActiveWorkspaceStatus,
  getWorkspaceStatusLabel,
} from "../workspace";
import { useCollaborationRoom } from "./useCollaborationRoom";

type UseWorkspaceCollaborationRuntimeOptions = {
  room?: LocationRoom | null;
  activeDocument?: WorkspaceFile;
  editorPresenceEnabled?: boolean;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  identity: Collaborator;
  workspaceDocuments?: readonly { id: string; title: string; text: string; parentId?: string | null }[];
  workspaceFolders?: readonly { id: string; title: string; parentId: string | null; order?: number }[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
  onCommentsChange?: (commentsByFileId: Record<string, WorkspaceRoomComment[]>) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
};

export function useWorkspaceCollaborationRuntime({
  room: sessionRoom,
  activeDocument,
  editorPresenceEnabled,
  getActiveFileSnapshot,
  identity,
  workspaceDocuments,
  workspaceFolders,
  commentsByFileId,
  onRecoveryEvent,
  onCommentsChange,
  onOpenFailure,
  onCapacityExceeded,
}: UseWorkspaceCollaborationRuntimeOptions) {
  const collaboration = useCollaborationRoom({
    room: sessionRoom,
    activeDocument,
    editorPresenceEnabled,
    getActiveFileSnapshot,
    identity,
    workspaceDocuments,
    workspaceFolders,
    commentsByFileId,
    onRecoveryEvent,
    onCommentsChange,
    onOpenFailure,
    onCapacityExceeded,
  });
  const isLive = Boolean(sessionRoom);
  const activeStatus = getActiveWorkspaceStatus({
    isLive,
    connectionStatus: collaboration.connectionStatus,
  });
  const statusLabel = isLive && activeStatus === "connected" && collaboration.durability === "failed"
    ? "Changes aren’t backed up"
    : getWorkspaceStatusLabel(activeStatus);
  return {
    ...collaboration,
    activeStatus,
    isLive,
    statusLabel,
  };
}
