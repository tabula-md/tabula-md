import type { WorkspaceRoomComment } from "@tabula-md/tabula";
import type {
  Collaborator,
  CollabRecoveryEvent,
} from "../collaboration/liveCollaboration";
import type { WorkspaceFile } from "../workspaceStorage";
import type { RoomWorkspaceSession } from "../workspace/session/WorkspaceSession";
import {
  getActiveWorkspaceStatus,
  getWorkspaceStatusLabel,
} from "../workspace";
import { useCollaborationRoom } from "./useCollaborationRoom";

type UseWorkspaceCollaborationRuntimeOptions = {
  session?: RoomWorkspaceSession | null;
  activeDocument?: WorkspaceFile;
  editorPresenceEnabled?: boolean;
  getSessionFileSnapshot?: () => WorkspaceFile | undefined;
  identity: Collaborator;
  workspaceDocuments?: readonly { id: string; title: string; text: string; parentId?: string | null }[];
  workspaceFolders?: readonly { id: string; title: string; parentId: string | null; order?: number }[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
};

export function useWorkspaceCollaborationRuntime({
  session,
  activeDocument,
  editorPresenceEnabled,
  getSessionFileSnapshot,
  identity,
  workspaceDocuments,
  workspaceFolders,
  commentsByFileId,
  onRecoveryEvent,
  onOpenFailure,
  onCapacityExceeded,
}: UseWorkspaceCollaborationRuntimeOptions) {
  const collaboration = useCollaborationRoom({
    session,
    activeDocument,
    editorPresenceEnabled,
    getSessionFileSnapshot,
    identity,
    workspaceDocuments,
    workspaceFolders,
    commentsByFileId,
    onRecoveryEvent,
    onOpenFailure,
    onCapacityExceeded,
  });
  const isLive = Boolean(session);
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
