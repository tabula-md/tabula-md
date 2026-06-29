import {
  parseRoomShareUrl,
  type CollabRecoveryEvent,
  type RoomMeta,
  type TabulaRoomAvailability,
} from "./collab";
import type { WorkspaceFile } from "./workspaceStorage";

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
