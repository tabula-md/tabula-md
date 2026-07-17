import {
  HUMAN_ROOM_CAPABILITIES,
  parseRoomShareUrl,
} from "@tabula-md/tabula";
import {
  type Collaborator,
  type ConnectionStatus,
  type RoomSession,
  type TabulaRoomAvailability,
} from "./liveCollaboration";
import { createRoomSession } from "./collabRoom";
import type { LocationRoom, WorkspaceFile } from "../workspaceStorage";

export type LiveRoomConnectionTarget = {
  fileId?: string;
  fileTitle?: string;
  roomId: string;
  roomKey: string;
  shareUrl: string;
};

export type CollaborationPresenceIdentityInput = {
  identity: Collaborator;
  isLive: boolean;
  joinedAt?: string;
};

export type CollaborationSessionStartRequest = {
  roomId: string;
  roomKey: string;
  shareUrl: string;
};

type CreateRoomSession = (origin: string) => Pick<RoomSession, "roomId" | "roomKey" | "shareUrl">;

export const getLiveRoomConnectionTarget = ({
  room,
  document,
}: {
  room?: LocationRoom | null;
  document?: Pick<WorkspaceFile, "id" | "title">;
}): LiveRoomConnectionTarget | null => {
  if (!room) {
    return null;
  }

  const parsedRoom = parseRoomShareUrl(room.shareUrl);
  if (!parsedRoom || parsedRoom.roomId !== room.roomId) {
    return null;
  }

  return {
    fileId: document?.id,
    fileTitle: document?.title,
    roomId: parsedRoom.roomId,
    roomKey: parsedRoom.roomKey,
    shareUrl: parsedRoom.shareUrl,
  };
};

export const getInitialCollaborationStatus = (
  room?: LocationRoom | null,
): ConnectionStatus => (room ? "connecting" : "idle");

export const canStartCollaborationSession = ({
  hasWorkspaceDocuments,
  roomAvailability,
}: {
  hasWorkspaceDocuments: boolean;
  roomAvailability: TabulaRoomAvailability;
}) => hasWorkspaceDocuments && roomAvailability.available;

export const createCollaborationSessionStartRequest = ({
  hasWorkspaceDocuments,
  origin,
  roomAvailability,
  createSession = createRoomSession,
}: {
  hasWorkspaceDocuments: boolean;
  origin: string;
  roomAvailability: TabulaRoomAvailability;
  createSession?: CreateRoomSession;
}): CollaborationSessionStartRequest | undefined => {
  if (!canStartCollaborationSession({ hasWorkspaceDocuments, roomAvailability })) {
    return undefined;
  }

  const session = createSession(origin);
  return {
    roomId: session.roomId,
    roomKey: session.roomKey,
    shareUrl: session.shareUrl,
  };
};

export const createCollaborationPresenceIdentity = ({
  identity,
  isLive,
  joinedAt,
}: CollaborationPresenceIdentityInput): Collaborator =>
  isLive
    ? {
        ...identity,
        kind: identity.kind ?? "human",
        client: identity.client ?? "tabula-md",
        capabilities: identity.capabilities ?? [...HUMAN_ROOM_CAPABILITIES],
        joinedAt: identity.joinedAt ?? joinedAt ?? new Date(0).toISOString(),
      }
    : identity;
