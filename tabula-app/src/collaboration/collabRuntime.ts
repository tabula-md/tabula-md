import {
  HUMAN_ROOM_CAPABILITIES,
  parseRoomLocation,
  parseRoomShareUrl,
  type RoomRouteLocation,
} from "@tabula-md/tabula";
import {
  type RoomSession,
  type TabulaRoomAvailability,
} from "./collabRoom";
import type {
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
  LiveSelection,
} from "./workspaceRoomRuntimeTypes";
import { createRoomSession } from "./collabRoom";
import type { WorkspaceFile } from "../workspaceStorage";

export type LiveRoomConnectionTarget = {
  fileId: string;
  fileTitle?: string;
  roomId: string;
  roomKey: string;
  shareUrl: string;
};

export type CollaborationStatusPatch = {
  requireRoom?: boolean;
};

export type RecoveryEventPatch = {
  type: CollabRecoveryEvent["type"];
  message: string;
  createdAt: string;
};

export type CollaborationPresenceIdentityInput = {
  identity: Collaborator;
  isLive: boolean;
  activeDocumentId?: string;
  roomId?: string;
  fileTitle?: string;
  selection?: LiveSelection;
  joinedAt?: string;
};

export type CollaborationSessionStartRequest = {
  roomId: string;
  roomKey: string;
  shareUrl: string;
};

type CreateRoomSession = (origin: string) => Pick<RoomSession, "roomId" | "roomKey" | "shareUrl">;

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

const getCurrentRoomLocation = (): RoomRouteLocation | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location;
};

export const shouldStartLiveRoomConnection = ({
  file,
  hasPendingStart = false,
  location,
}: {
  file?: WorkspaceFile;
  hasPendingStart?: boolean;
  location?: RoomRouteLocation | null;
}) => {
  const target = getLiveRoomConnectionTarget(file);
  if (!target) {
    return false;
  }

  if (hasPendingStart) {
    return true;
  }

  const roomLocation = location === undefined ? getCurrentRoomLocation() : location;
  const room = roomLocation ? parseRoomLocation(roomLocation) : null;
  return Boolean(room && room.roomId === target.roomId && room.roomKey === target.roomKey);
};

export const getInitialCollaborationStatus = (
  file?: WorkspaceFile,
  options: { location?: RoomRouteLocation | null } = {},
): ConnectionStatus => (shouldStartLiveRoomConnection({ file, location: options.location }) ? "connecting" : "idle");

export const getDisconnectedStatusPatch = (): CollaborationStatusPatch => ({
  requireRoom: true,
});

export const getIdleStatusPatch = (): CollaborationStatusPatch => ({});

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
    roomId: session.roomId,
    roomKey: session.roomKey,
    shareUrl: session.shareUrl,
  };
};

export const createCollaborationPresenceIdentity = ({
  identity,
  isLive,
  activeDocumentId,
  roomId,
  fileTitle,
  selection,
  joinedAt,
}: CollaborationPresenceIdentityInput): Collaborator =>
  isLive
    ? {
        ...identity,
        kind: identity.kind ?? "human",
        client: identity.client ?? "tabula-md",
        capabilities: identity.capabilities ?? [...HUMAN_ROOM_CAPABILITIES],
        joinedAt: identity.joinedAt ?? joinedAt ?? new Date(0).toISOString(),
        ...(activeDocumentId ? { activeDocumentId } : {}),
        roomId,
        ...(fileTitle ? { fileTitle } : {}),
        selection: selection && activeDocumentId
          ? { ...selection, documentId: selection.documentId ?? activeDocumentId }
          : undefined,
      }
    : identity;
