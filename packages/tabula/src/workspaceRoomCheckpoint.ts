import { decodeEncryptedData, encodeEncryptedData } from "./data/encode";
import { WORKSPACE_ROOM_SCHEMA_VERSION } from "./workspaceRoomModel";

export const ROOM_CHECKPOINT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type WorkspaceRoomCheckpointMetadata = {
  kind: "workspace-room-crdt";
  roomId: string;
  schemaVersion: typeof WORKSPACE_ROOM_SCHEMA_VERSION;
};

export type LoadedWorkspaceRoomCheckpoint =
  | {
      status: "ready";
      generation: number;
      encryptedCheckpoint: Uint8Array;
      expiresAt: number;
    }
  | {
      status: "expired";
      generation: number;
      expiresAt: number;
    };

export type SaveWorkspaceRoomCheckpointRequest = {
  expectedGeneration: number;
  encryptedCheckpoint: Uint8Array;
  expiresAt: number;
};

export type SaveWorkspaceRoomCheckpointResult =
  | { ok: true; generation: number }
  | { ok: false; reason: "conflict"; generation: number };

export type WorkspaceRoomCheckpointStore = {
  enabled: boolean;
  loadEncryptedCheckpoint(
    roomId: string,
    signal?: AbortSignal,
  ): Promise<LoadedWorkspaceRoomCheckpoint | null>;
  saveEncryptedCheckpoint(
    roomId: string,
    request: SaveWorkspaceRoomCheckpointRequest,
    signal?: AbortSignal,
  ): Promise<SaveWorkspaceRoomCheckpointResult>;
};

const getAdditionalData = (roomId: string) =>
  new TextEncoder().encode(
    `tabula.workspace-room-crdt:v${WORKSPACE_ROOM_SCHEMA_VERSION}:${roomId}`,
  );

export const encryptWorkspaceRoomCheckpoint = async ({
  roomId,
  update,
  roomKey,
}: {
  roomId: string;
  update: Uint8Array;
  roomKey: string | CryptoKey;
}) =>
  encodeEncryptedData(update, {
    encryptionKey: roomKey,
    metadata: {
      kind: "workspace-room-crdt",
      roomId,
      schemaVersion: WORKSPACE_ROOM_SCHEMA_VERSION,
    } satisfies WorkspaceRoomCheckpointMetadata,
    additionalData: getAdditionalData(roomId),
  });

export const decryptWorkspaceRoomCheckpoint = async ({
  encryptedCheckpoint,
  roomId,
  roomKey,
}: {
  encryptedCheckpoint: Uint8Array;
  roomId: string;
  roomKey: string | CryptoKey;
}) => {
  const decoded = await decodeEncryptedData<WorkspaceRoomCheckpointMetadata>(
    encryptedCheckpoint,
    {
      decryptionKey: roomKey,
      additionalData: getAdditionalData(roomId),
    },
  );

  if (
    decoded.metadata.kind !== "workspace-room-crdt" ||
    decoded.metadata.roomId !== roomId ||
    decoded.metadata.schemaVersion !== WORKSPACE_ROOM_SCHEMA_VERSION
  ) {
    throw new Error("Room checkpoint failed: unsupported checkpoint metadata");
  }
  return decoded.data;
};
