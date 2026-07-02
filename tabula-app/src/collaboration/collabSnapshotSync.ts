import type { CollabTextAdapter, CollabTextDocumentHandle } from "./collabRuntimeAdapters";
import type { RoomRecoveryStore } from "./collabRuntimeAdapters";
import type { RoomMeta } from "./liveCollaboration";
import type { TextChange } from "@tabula-md/tabula";

type TimeoutHandle = unknown;
export type CollabSnapshotFetchResult = "missing" | "restored" | "unavailable";

type SnapshotRecoveryType = "snapshot-recovered" | "invalid-message";

type CollabSnapshotSyncOptions = {
  roomId: string;
  roomKey: string;
  textAdapter: Pick<CollabTextAdapter, "applyRemoteUpdate" | "encodeState">;
  textDocument: CollabTextDocumentHandle;
  canUseSnapshots: () => boolean;
  recoveryStore: RoomRecoveryStore;
  mergeStates: (states: readonly Uint8Array[]) => Uint8Array;
  onTextChange: (text: string, change?: TextChange) => void;
  onRoomMetaChange?: (meta: RoomMeta) => void;
  onSnapshotStored?: () => void;
  emitRecoveryEvent: (type: SnapshotRecoveryType, message: string) => void;
  setTimeoutFn?: (callback: () => void, delayMs: number) => TimeoutHandle;
  clearTimeoutFn?: (handle: TimeoutHandle) => void;
};

export type CollabSnapshotSync = {
  refreshMeta(): Promise<void>;
  fetch(): Promise<CollabSnapshotFetchResult>;
  store(): Promise<boolean>;
  scheduleStore(): void;
  clearTimer(): void;
};

const defaultSetTimeout = (callback: () => void, delayMs: number): TimeoutHandle => setTimeout(callback, delayMs);
const defaultClearTimeout = (handle: TimeoutHandle) => clearTimeout(handle as ReturnType<typeof setTimeout>);
export const collabSnapshotStoreDelayMs = 1_000;

export const createCollabSnapshotSync = ({
  roomId,
  roomKey,
  textAdapter,
  textDocument,
  canUseSnapshots,
  recoveryStore,
  mergeStates,
  onTextChange,
  onRoomMetaChange,
  onSnapshotStored,
  emitRecoveryEvent,
  setTimeoutFn = defaultSetTimeout,
  clearTimeoutFn = defaultClearTimeout,
}: CollabSnapshotSyncOptions): CollabSnapshotSync => {
  let snapshotTimer: TimeoutHandle | undefined;

  const clearTimer = () => {
    if (snapshotTimer) {
      clearTimeoutFn(snapshotTimer);
      snapshotTimer = undefined;
    }
  };

  const refreshMeta = async () => undefined;

  const store = async () => {
    if (!canUseSnapshots()) {
      return false;
    }

    try {
      const stored = await recoveryStore.save({
        roomId,
        roomKey,
        state: textAdapter.encodeState(textDocument),
        mergeStates,
      });
      if (!stored) {
        return false;
      }

      clearTimer();
      onSnapshotStored?.();
      onRoomMetaChange?.({
        roomId,
        version: stored.version,
        snapshotCount: 1,
        lastSavedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        snapshots: [
          {
            id: "firebase",
            createdAt: new Date().toISOString(),
            textLength: 0,
            updateSize: 0,
            version: stored.version,
          },
        ],
      });
      return true;
    } catch {
      emitRecoveryEvent("invalid-message", "The encrypted room recovery state could not be stored.");
      return false;
    }
  };

  return {
    refreshMeta,
    async fetch() {
      if (!canUseSnapshots()) {
        return "unavailable";
      }

      try {
        const update = await recoveryStore.load(roomId, roomKey);
        if (!update) {
          return "missing";
        }
        const result = textAdapter.applyRemoteUpdate(textDocument, update);
        if (result) {
          onTextChange(result.text, result.change);
        }
        emitRecoveryEvent("snapshot-recovered", "Encrypted room recovery state restored.");
        await refreshMeta();
        return "restored";
      } catch {
        emitRecoveryEvent("invalid-message", "The encrypted room recovery state could not be decrypted.");
        return "unavailable";
      }
    },
    store,
    scheduleStore() {
      clearTimer();
      snapshotTimer = setTimeoutFn(() => {
        void store();
      }, collabSnapshotStoreDelayMs);
    },
    clearTimer,
  };
};
