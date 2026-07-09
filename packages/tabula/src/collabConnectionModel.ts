import type { CollaborationCollaborator } from "./collaborationTypes";
import type { EncryptedEnvelope } from "./roomProtocol";

export type RoomServerMetadata = {
  roomId: string;
  activeConnections: number;
  updatedAt?: string | null;
};

export const createRoomApiUrl = (baseUrl: string, roomId: string, suffix = "") =>
  `${baseUrl}/v1/rooms/${encodeURIComponent(roomId)}${suffix}`;

export const isEncryptedEnvelope = (value: unknown): value is EncryptedEnvelope => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const envelope = value as Partial<EncryptedEnvelope>;
  return (
    envelope.v === 1 &&
    typeof envelope.roomId === "string" &&
    envelope.kind === "room-event" &&
    typeof envelope.version === "number" &&
    typeof envelope.iv === "string" &&
    typeof envelope.ciphertext === "string" &&
    typeof envelope.createdAt === "string"
  );
};

export const sortCollaborators = (collaborators: Iterable<CollaborationCollaborator>) =>
  [...collaborators].sort((first, second) => first.name.localeCompare(second.name));
