import type { EncryptedEnvelope } from "./roomProtocol";
import type { Collaborator, LiveSelection, RoomMeta } from "./collab";

export type RoomServerMetadata = {
  roomId: string;
  activeConnections: number;
  snapshotVersion: number | null;
  updatedAt: string | null;
};

type PresencePayload = Collaborator & {
  roomId: string;
  fileTitle: string;
};

type EncodePresenceOptions = {
  identity: Collaborator;
  roomId: string;
  fileTitle: string;
  selection?: LiveSelection;
  now?: () => number;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const createRoomApiUrl = (baseUrl: string, roomId: string, suffix = "") =>
  `${baseUrl}/v1/rooms/${encodeURIComponent(roomId)}${suffix}`;

export const toRoomMeta = (metadata: RoomServerMetadata): RoomMeta => {
  const snapshotVersion = metadata.snapshotVersion ?? 0;
  const latestSnapshot =
    metadata.snapshotVersion && metadata.updatedAt
      ? [
          {
            id: "latest",
            createdAt: metadata.updatedAt,
            textLength: 0,
            updateSize: 0,
            version: metadata.snapshotVersion,
          },
        ]
      : [];

  return {
    roomId: metadata.roomId,
    version: snapshotVersion,
    snapshotCount: metadata.snapshotVersion ? 1 : 0,
    lastSavedAt: metadata.updatedAt ?? undefined,
    lastUpdatedAt: metadata.updatedAt ?? undefined,
    snapshots: latestSnapshot,
  };
};

export const isEncryptedEnvelope = (value: unknown): value is EncryptedEnvelope => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const envelope = value as Partial<EncryptedEnvelope>;
  return (
    envelope.v === 1 &&
    typeof envelope.roomId === "string" &&
    ["yjs-update", "presence", "snapshot"].includes(String(envelope.kind)) &&
    typeof envelope.version === "number" &&
    typeof envelope.iv === "string" &&
    typeof envelope.ciphertext === "string" &&
    typeof envelope.createdAt === "string"
  );
};

export const encodePresenceForRoom = ({
  identity,
  roomId,
  fileTitle,
  selection,
  now = Date.now,
}: EncodePresenceOptions) => {
  const payload: PresencePayload = {
    ...identity,
    roomId,
    fileTitle,
    selection,
    lastSeen: now(),
  };

  return textEncoder.encode(JSON.stringify(payload));
};

export const decodePresence = (bytes: Uint8Array, now = Date.now): Collaborator | null => {
  try {
    const decoded = JSON.parse(textDecoder.decode(bytes)) as Partial<PresencePayload>;
    if (!decoded.id || !decoded.name || !decoded.color) {
      return null;
    }

    return {
      id: decoded.id,
      name: decoded.name,
      color: decoded.color,
      lastSeen: typeof decoded.lastSeen === "number" ? decoded.lastSeen : now(),
      roomId: typeof decoded.roomId === "string" ? decoded.roomId : undefined,
      fileTitle: decoded.fileTitle,
      selection: decoded.selection,
    };
  } catch {
    return null;
  }
};

export const sortCollaborators = (collaborators: Iterable<Collaborator>) =>
  [...collaborators].sort((first, second) => first.name.localeCompare(second.name));
