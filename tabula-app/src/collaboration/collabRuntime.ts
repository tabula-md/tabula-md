import { parseRoomShareUrl } from "@tabula-md/tabula";
import {
  type Collaborator,
  type CollabRecoveryEvent,
  type ConnectionStatus,
  type LiveSelection,
  type RoomMeta,
  type RoomSession,
  type TabulaRoomAvailability,
} from "./liveCollaboration";
import { createRoomSession } from "./collabRoom";
import type { WorkspaceFile } from "../workspaceStorage";

export type LiveRoomConnectionTarget = {
  fileId: string;
  fileTitle: string;
  roomId: string;
  roomKey: string;
  shareUrl: string;
};

export type CollaborationStatusPatch = {
  collaboratorCount?: number;
  requireRoom?: boolean;
};

export type RoomMetaPatch = {
  snapshotCount: number;
  lastSnapshotAt?: string;
};

export type RecoveryEventPatch = {
  type: CollabRecoveryEvent["type"];
  message: string;
  createdAt: string;
};

export type CollaborationPresenceIdentityInput = {
  identity: Collaborator;
  isLive: boolean;
  roomId?: string;
  fileTitle: string;
  selection?: LiveSelection;
};

export type CollaborationSessionStartRequest = {
  initialText: string;
  roomId: string;
  shareUrl: string;
};

type CreateRoomSession = (origin: string) => Pick<RoomSession, "roomId" | "shareUrl">;

export const getLiveRoomConnectionTarget = (file?: WorkspaceFile): LiveRoomConnectionTarget | null => {
  if (!file?.id || !file.roomId || !file.shareUrl) {
    return null;
  }

  const parsedRoom = parseRoomShareUrl(file.shareUrl);
  if (!parsedRoom || parsedRoom.roomId !== file.roomId) {
    return null;
  }

  return {
    fileId: file.id,
    fileTitle: file.title,
    roomId: parsedRoom.roomId,
    roomKey: parsedRoom.roomKey,
    shareUrl: parsedRoom.shareUrl,
  };
};

export const getInitialCollaborationStatus = (file?: WorkspaceFile): ConnectionStatus =>
  getLiveRoomConnectionTarget(file) ? "connecting" : "idle";

export const getDisconnectedStatusPatch = (): CollaborationStatusPatch => ({
  collaboratorCount: 0,
  requireRoom: true,
});

export const getIdleStatusPatch = (): CollaborationStatusPatch => ({
  collaboratorCount: 0,
});

export const getRoomMetaPatch = (meta: RoomMeta): RoomMetaPatch => {
  const latestSnapshot = meta.snapshots[0];
  const lastSnapshotAt = latestSnapshot?.createdAt ?? meta.lastSavedAt;

  return lastSnapshotAt
    ? {
        snapshotCount: meta.snapshotCount,
        lastSnapshotAt,
      }
    : {
        snapshotCount: meta.snapshotCount,
      };
};

export const getRecoveryEventPatch = (event: CollabRecoveryEvent): RecoveryEventPatch => ({
  type: event.type,
  message: event.message,
  createdAt: event.createdAt,
});

export const canStartCollaborationSession = ({
  activeFile,
  roomAvailability,
}: {
  activeFile?: WorkspaceFile;
  roomAvailability: TabulaRoomAvailability;
}) => Boolean(activeFile) && roomAvailability.available;

export const createCollaborationSessionStartRequest = ({
  activeFile,
  origin,
  roomAvailability,
  createSession = createRoomSession,
}: {
  activeFile?: WorkspaceFile;
  origin: string;
  roomAvailability: TabulaRoomAvailability;
  createSession?: CreateRoomSession;
}): CollaborationSessionStartRequest | undefined => {
  if (!canStartCollaborationSession({ activeFile, roomAvailability }) || !activeFile) {
    return undefined;
  }

  const session = createSession(origin);
  return {
    initialText: activeFile.text,
    roomId: session.roomId,
    shareUrl: session.shareUrl,
  };
};

export const createCollaborationPresenceIdentity = ({
  identity,
  isLive,
  roomId,
  fileTitle,
  selection,
}: CollaborationPresenceIdentityInput): Collaborator =>
  isLive
    ? {
        ...identity,
        roomId,
        fileTitle,
        selection,
      }
    : identity;
