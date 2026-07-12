import type { WorkspaceRoomComment, WorkspaceRoomStructureSnapshot } from "@tabula-md/tabula";
import type {
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
} from "../collaboration";
import type { WorkspaceRoomChangeOrigin } from "../collaboration/liveCollaboration";
import {
  isUsableLiveRoomFile,
  type WorkspaceFile,
} from "../workspaceStorage";
import {
  getActiveWorkspaceStatus,
  getWorkspaceStatusLabel,
} from "../workspace";
import { useCollaborationRoom } from "./useCollaborationRoom";

type UseWorkspaceCollaborationRuntimeOptions = {
  roomFile?: WorkspaceFile;
  activeDocument?: WorkspaceFile;
  editorPresenceEnabled?: boolean;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  identity: Collaborator;
  workspaceDocuments?: readonly { id: string; title: string; text: string; parentId?: string | null }[];
  workspaceFolders?: readonly { id: string; title: string; parentId: string | null; order?: number }[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
  setFileCollaborationStatus: (
    fileId: string,
    status: ConnectionStatus,
    options?: { requireRoom?: boolean },
  ) => void;
  setFileRecoveryEvent: (
    fileId: string,
    event: {
      type: CollabRecoveryEvent["type"];
      message: string;
      createdAt: string;
    },
  ) => void;
  startFileCollaborationSession: (
    fileId: string,
    roomId: string,
    shareUrl: string,
  ) => WorkspaceFile | undefined;
  onWorkspaceStructureChange?: (
    snapshot: WorkspaceRoomStructureSnapshot,
    origin: WorkspaceRoomChangeOrigin | undefined,
    readDocumentText: (documentId: string) => string | null,
  ) => void;
  onCommentsChange?: (commentsByFileId: Record<string, WorkspaceRoomComment[]>) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
};

export function useWorkspaceCollaborationRuntime({
  roomFile,
  activeDocument,
  editorPresenceEnabled,
  getActiveFileSnapshot,
  identity,
  workspaceDocuments,
  workspaceFolders,
  commentsByFileId,
  setFileCollaborationStatus,
  setFileRecoveryEvent,
  startFileCollaborationSession,
  onWorkspaceStructureChange,
  onCommentsChange,
  onOpenFailure,
  onCapacityExceeded,
}: UseWorkspaceCollaborationRuntimeOptions) {
  const room = useCollaborationRoom({
    roomFile,
    activeDocument,
    editorPresenceEnabled,
    getActiveFileSnapshot,
    identity,
    workspaceDocuments,
    workspaceFolders,
    commentsByFileId,
    setFileCollaborationStatus,
    setFileRecoveryEvent,
    startFileCollaborationSession,
    onWorkspaceStructureChange,
    onCommentsChange,
    onOpenFailure,
    onCapacityExceeded,
  });
  const isLive = isUsableLiveRoomFile(roomFile);
  const activeStatus = getActiveWorkspaceStatus({
    isLive,
    connectionStatus: room.connectionStatus,
  });
  return {
    ...room,
    activeStatus,
    isLive,
    statusLabel: getWorkspaceStatusLabel(activeStatus),
  };
}
