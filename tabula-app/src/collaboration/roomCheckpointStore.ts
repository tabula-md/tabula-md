import {
  decodeEncryptedData,
  encodeEncryptedData,
  WORKSPACE_ROOM_SCHEMA_VERSION,
} from "@tabula-md/tabula";
import { tabulaServiceConfig } from "../serviceConfig";

export const ROOM_CHECKPOINT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type LoadedRoomCheckpoint =
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

export type SaveRoomCheckpointRequest = {
  expectedGeneration: number;
  encryptedCheckpoint: Uint8Array;
  expiresAt: number;
};

export type SaveRoomCheckpointResult =
  | { ok: true; generation: number }
  | { ok: false; reason: "conflict"; generation: number };

export type RoomCheckpointStore = {
  enabled: boolean;
  loadEncryptedCheckpoint(roomId: string, signal?: AbortSignal): Promise<LoadedRoomCheckpoint | null>;
  saveEncryptedCheckpoint(
    roomId: string,
    request: SaveRoomCheckpointRequest,
    signal?: AbortSignal,
  ): Promise<SaveRoomCheckpointResult>;
};

export type RoomCheckpointMetadata = {
  kind: "workspace-room-crdt";
  roomId: string;
  schemaVersion: typeof WORKSPACE_ROOM_SCHEMA_VERSION;
};

export const createNoopRoomCheckpointStore = (): RoomCheckpointStore => ({
  enabled: false,
  async loadEncryptedCheckpoint() {
    return null;
  },
  async saveEncryptedCheckpoint(_roomId, request) {
    return { ok: true, generation: request.expectedGeneration + 1 };
  },
});

export const createDefaultRoomCheckpointStore = (): RoomCheckpointStore => {
  if (tabulaServiceConfig.firebaseConfig) {
    return createLazyFirebaseRoomCheckpointStore(tabulaServiceConfig.firebaseConfig);
  }
  return createNoopRoomCheckpointStore();
};

const createLazyFirebaseRoomCheckpointStore = (firebaseConfig: string): RoomCheckpointStore => {
  let storePromise: Promise<RoomCheckpointStore> | null = null;
  const loadStore = () => {
    storePromise ??= import("../data/firebase").then(({ createFirebaseRoomCheckpointStore }) =>
      createFirebaseRoomCheckpointStore(firebaseConfig),
    );
    return storePromise;
  };

  return {
    enabled: true,
    async loadEncryptedCheckpoint(roomId, signal) {
      const store = await loadStore();
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      return store.enabled ? store.loadEncryptedCheckpoint(roomId, signal) : null;
    },
    async saveEncryptedCheckpoint(roomId, request, signal) {
      const store = await loadStore();
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      return store.enabled
        ? store.saveEncryptedCheckpoint(roomId, request, signal)
        : { ok: true, generation: request.expectedGeneration + 1 };
    },
  };
};

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
    } satisfies RoomCheckpointMetadata,
    additionalData: getRoomCheckpointAdditionalData(roomId),
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
  const decoded = await decodeEncryptedData<RoomCheckpointMetadata>(encryptedCheckpoint, {
    decryptionKey: roomKey,
    additionalData: getRoomCheckpointAdditionalData(roomId),
  });

  if (
    decoded.metadata.kind !== "workspace-room-crdt" ||
    decoded.metadata.roomId !== roomId ||
    decoded.metadata.schemaVersion !== WORKSPACE_ROOM_SCHEMA_VERSION
  ) {
    throw new Error("Room checkpoint failed: unsupported checkpoint metadata");
  }
  return decoded.data;
};

const getRoomCheckpointAdditionalData = (roomId: string) =>
  new TextEncoder().encode(`tabula.workspace-room-crdt:v${WORKSPACE_ROOM_SCHEMA_VERSION}:${roomId}`);
