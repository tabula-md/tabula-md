import * as Y from "yjs";
import {
  createWorkspaceRoomCrdt,
  getWorkspaceRoomSnapshot,
  ROOM_WIRE_MAX_CRDT_STATE_BYTES,
  validateWorkspaceRoomLimits,
  validateWorkspaceRoomStructure,
  type WorkspaceRoomCrdt,
} from "@tabula-md/tabula";
import type { CollabRuntimeAdapters } from "../collabRuntimeAdapters";
import {
  decryptWorkspaceRoomCheckpoint,
  encryptWorkspaceRoomCheckpoint,
  ROOM_CHECKPOINT_RETENTION_MS,
  type RoomCheckpointStore,
} from "../roomCheckpointStore";

const SAVE_DELAY_MS = 5_000;
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 30_000;

export const CHECKPOINT_ORIGIN = Symbol("tabula.checkpoint");

export type RoomDurability = "clean" | "dirty" | "saving" | "failed" | "unknown";

export type CheckpointLoadResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "invalid" | "unsupported" };

export type InitialRoomCheckpoint = {
  checkpointUpdate: Uint8Array;
  generation: number;
};

type CheckpointCoordinatorOptions = {
  room: WorkspaceRoomCrdt;
  roomId: string;
  store: RoomCheckpointStore;
  clock: Pick<CollabRuntimeAdapters["clock"], "clearTimeout" | "setTimeout">;
  signal: AbortSignal;
  isClosed: () => boolean;
  isLeader: () => boolean;
  isWithinLimits: () => boolean;
  onCapacityExceeded: () => void;
  onDurabilityChange: (durability: RoomDurability) => void;
  onSaveError: () => void;
};

const stateVectorsEqual = (first: Uint8Array | null, second: Uint8Array) =>
  Boolean(
    first &&
    first.byteLength === second.byteLength &&
    first.every((value, index) => value === second[index]),
  );

export const createCheckpointCoordinator = ({
  room,
  roomId,
  store,
  clock,
  signal,
  isClosed,
  isLeader,
  isWithinLimits,
  onCapacityExceeded,
  onDurabilityChange,
  onSaveError,
}: CheckpointCoordinatorOptions) => {
  let roomKey: CryptoKey | null = null;
  let generation = 0;
  let checkpointedStateVector: Uint8Array | null = null;
  let saveInFlight = false;
  let saveRequested = false;
  let retryAttempt = 0;
  let timer: unknown;
  let disposed = false;

  const clearTimer = () => {
    if (!timer) return;
    clock.clearTimeout(timer);
    timer = undefined;
  };

  const validateCheckpointUpdate = (update: Uint8Array) => {
    if (update.byteLength > ROOM_WIRE_MAX_CRDT_STATE_BYTES) {
      throw new Error("The collaboration state exceeds the supported size.");
    }
    const validationDoc = new Y.Doc();
    const validationRoom = createWorkspaceRoomCrdt({
      roomId,
      doc: validationDoc,
      initialize: false,
    });
    try {
      Y.applyUpdate(validationDoc, update);
      const structure = validateWorkspaceRoomStructure(validationRoom, roomId);
      if (!structure.ok) throw new Error(structure.message);
      const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(validationRoom));
      if (!limits.ok) throw new Error(limits.message);
    } finally {
      validationDoc.destroy();
    }
  };

  const persistCurrentCheckpoint = async (expectedGeneration: number) => {
    if (!roomKey || !isWithinLimits()) return null;
    const structure = validateWorkspaceRoomStructure(room, roomId);
    if (!structure.ok) return null;
    const stateVector = Y.encodeStateVector(room.doc);
    const update = Y.encodeStateAsUpdate(room.doc);
    if (update.byteLength > ROOM_WIRE_MAX_CRDT_STATE_BYTES) {
      onCapacityExceeded();
      return null;
    }
    const encryptedCheckpoint = await encryptWorkspaceRoomCheckpoint({ roomId, update, roomKey });
    if (disposed || isClosed() || signal.aborted) return null;
    const result = await store.saveEncryptedCheckpoint(roomId, {
      expectedGeneration,
      encryptedCheckpoint,
      expiresAt: Date.now() + ROOM_CHECKPOINT_RETENTION_MS,
    }, signal);
    return { result, stateVector };
  };

  const scheduleRetry = () => {
    if (disposed || isClosed() || !store.enabled || !isLeader()) return;
    clearTimer();
    const delay = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** retryAttempt));
    retryAttempt += 1;
    timer = clock.setTimeout(() => {
      timer = undefined;
      void saveNow();
    }, delay);
  };

  const finishSave = (stateVector: Uint8Array) => {
    checkpointedStateVector = stateVector;
    retryAttempt = 0;
    if (stateVectorsEqual(checkpointedStateVector, Y.encodeStateVector(room.doc))) {
      onDurabilityChange("clean");
      return;
    }
    onDurabilityChange("dirty");
    scheduleSave();
  };

  async function saveNow(): Promise<void> {
    clearTimer();
    if (disposed || isClosed() || !roomKey || !store.enabled) return;
    if (!isLeader()) {
      onDurabilityChange("unknown");
      return;
    }
    if (saveInFlight) {
      saveRequested = true;
      return;
    }
    saveInFlight = true;
    onDurabilityChange("saving");
    let saved = false;
    try {
      const persisted = await persistCurrentCheckpoint(generation);
      if (!persisted) return;
      if (persisted.result.ok) {
        generation = persisted.result.generation;
        finishSave(persisted.stateVector);
        saved = true;
      } else {
        const latest = await store.loadEncryptedCheckpoint(roomId, signal);
        if (latest?.status === "ready" && roomKey) {
          generation = latest.generation;
          const latestUpdate = await decryptWorkspaceRoomCheckpoint({
            encryptedCheckpoint: latest.encryptedCheckpoint,
            roomId,
            roomKey,
          });
          validateCheckpointUpdate(latestUpdate);
          Y.applyUpdate(room.doc, latestUpdate, CHECKPOINT_ORIGIN);
          const retried = await persistCurrentCheckpoint(generation);
          if (retried?.result.ok) {
            generation = retried.result.generation;
            finishSave(retried.stateVector);
            saved = true;
          }
        }
      }
    } catch {
      if (!signal.aborted) onSaveError();
    } finally {
      saveInFlight = false;
      if (!saved && !disposed && !isClosed() && !signal.aborted) {
        onDurabilityChange("failed");
        scheduleRetry();
      }
      if (saveRequested) {
        saveRequested = false;
        void saveNow();
      }
    }
  }

  function scheduleSave() {
    if (disposed || isClosed() || !roomKey || !store.enabled) return;
    if (!isLeader()) {
      onDurabilityChange("unknown");
      return;
    }
    onDurabilityChange("dirty");
    clearTimer();
    timer = clock.setTimeout(() => {
      timer = undefined;
      void saveNow();
    }, SAVE_DELAY_MS);
  }

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimer();
      roomKey = null;
    },
    handleDocumentUpdate(origin: unknown) {
      if (origin === CHECKPOINT_ORIGIN || !store.enabled) return;
      if (isLeader()) scheduleSave();
      else onDurabilityChange("unknown");
    },
    handleJoined() {
      if (generation === 0) {
        void saveNow();
      } else if (!stateVectorsEqual(checkpointedStateVector, Y.encodeStateVector(room.doc))) {
        scheduleSave();
      }
    },
    handleLeadershipChange(currentDurability: RoomDurability) {
      if (!store.enabled) return;
      if (isLeader()) {
        if (currentDurability !== "clean") scheduleSave();
      } else if (currentDurability !== "unknown") {
        onDurabilityChange("unknown");
      }
    },
    async load(
      key: CryptoKey,
      emitInitialWorkspaceState: boolean,
      initialCheckpoint?: InitialRoomCheckpoint | null,
    ): Promise<CheckpointLoadResult> {
      roomKey = key;
      if (initialCheckpoint) {
        try {
          validateCheckpointUpdate(initialCheckpoint.checkpointUpdate);
          Y.applyUpdate(room.doc, initialCheckpoint.checkpointUpdate, CHECKPOINT_ORIGIN);
          generation = initialCheckpoint.generation;
          checkpointedStateVector = Y.encodeStateVector(room.doc);
          onDurabilityChange("clean");
          return { ok: true };
        } catch {
          return { ok: false, reason: "unsupported" };
        }
      }
      if (!store.enabled) {
        onDurabilityChange("unknown");
        return emitInitialWorkspaceState ? { ok: true } : { ok: false, reason: "invalid" };
      }
      const loaded = await store.loadEncryptedCheckpoint(roomId, signal);
      if (!loaded) {
        if (emitInitialWorkspaceState) {
          onDurabilityChange("dirty");
          return { ok: true };
        }
        return { ok: false, reason: "invalid" };
      }
      generation = loaded.generation;
      if (loaded.status === "expired") return { ok: false, reason: "expired" };
      try {
        const update = await decryptWorkspaceRoomCheckpoint({
          encryptedCheckpoint: loaded.encryptedCheckpoint,
          roomId,
          roomKey,
        });
        validateCheckpointUpdate(update);
        Y.applyUpdate(room.doc, update, CHECKPOINT_ORIGIN);
        checkpointedStateVector = Y.encodeStateVector(room.doc);
        onDurabilityChange("clean");
        return { ok: true };
      } catch {
        return { ok: false, reason: "unsupported" };
      }
    },
    saveNow,
    scheduleSave,
  };
};

export type CheckpointCoordinator = ReturnType<typeof createCheckpointCoordinator>;
