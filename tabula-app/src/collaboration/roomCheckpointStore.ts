export {
  ROOM_CHECKPOINT_RETENTION_MS,
  decryptWorkspaceRoomCheckpoint,
  encryptWorkspaceRoomCheckpoint,
} from "@tabula-md/tabula";
import { tabulaServiceConfig } from "../serviceConfig";

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

export const createNoopRoomCheckpointStore = (): RoomCheckpointStore => ({
  enabled: false,
  async loadEncryptedCheckpoint() {
    return null;
  },
  async saveEncryptedCheckpoint() {
    throw new Error("Live room persistence is unavailable.");
  },
});

export const getRoomCheckpointAvailability = () => ({
  available: Boolean(tabulaServiceConfig.firebaseConfig),
  unavailableReason: tabulaServiceConfig.firebaseConfig
    ? ""
    : tabulaServiceConfig.copy.roomCheckpointUnconfiguredMessage,
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
      if (!store.enabled) throw new Error("Live room persistence is unavailable.");
      return store.saveEncryptedCheckpoint(roomId, request, signal);
    },
  };
};
