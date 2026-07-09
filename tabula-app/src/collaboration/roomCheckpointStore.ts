import {
  decodeEncryptedData,
  decodeWorkspaceRoomCheckpoint,
  encodeEncryptedData,
  encodeWorkspaceRoomCheckpoint,
  WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION,
  type WorkspaceRoomCheckpoint,
} from "@tabula-md/tabula";
import { tabulaServiceConfig } from "../serviceConfig";

export type RoomCheckpointStore = {
  enabled: boolean;
  loadEncryptedCheckpoint(roomId: string): Promise<Uint8Array | null>;
  saveEncryptedCheckpoint(roomId: string, encryptedCheckpoint: Uint8Array): Promise<void>;
};

export type RoomCheckpointMetadata = {
  kind: "workspace-room-checkpoint";
  roomId: string;
  schemaVersion: typeof WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION;
};

export const createNoopRoomCheckpointStore = (): RoomCheckpointStore => ({
  enabled: false,
  async loadEncryptedCheckpoint() {
    return null;
  },
  async saveEncryptedCheckpoint() {
    // A checkpoint store is optional for local/dev relay-only sessions.
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
    async loadEncryptedCheckpoint(roomId) {
      const store = await loadStore();
      return store.enabled ? store.loadEncryptedCheckpoint(roomId) : null;
    },
    async saveEncryptedCheckpoint(roomId, encryptedCheckpoint) {
      const store = await loadStore();
      if (store.enabled) {
        await store.saveEncryptedCheckpoint(roomId, encryptedCheckpoint);
      }
    },
  };
};

export const encryptWorkspaceRoomCheckpoint = async ({
  checkpoint,
  roomKey,
}: {
  checkpoint: WorkspaceRoomCheckpoint;
  roomKey: string | CryptoKey;
}) =>
  encodeEncryptedData(encodeWorkspaceRoomCheckpoint(checkpoint), {
    encryptionKey: roomKey,
    metadata: {
      kind: "workspace-room-checkpoint",
      roomId: checkpoint.roomId,
      schemaVersion: WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION,
    } satisfies RoomCheckpointMetadata,
    additionalData: getRoomCheckpointAdditionalData(checkpoint.roomId),
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
    decoded.metadata.kind !== "workspace-room-checkpoint" ||
    decoded.metadata.roomId !== roomId ||
    decoded.metadata.schemaVersion !== WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION
  ) {
    throw new Error("Room checkpoint failed: invalid checkpoint metadata");
  }

  const checkpoint = decodeWorkspaceRoomCheckpoint(decoded.data);
  if (!checkpoint || checkpoint.roomId !== roomId) {
    throw new Error("Room checkpoint failed: invalid checkpoint payload");
  }

  return checkpoint;
};

const getRoomCheckpointAdditionalData = (roomId: string) =>
  new TextEncoder().encode(`tabula.workspace-room-checkpoint:${roomId}`);
