import type { CollabTextAdapter, CollabTextDocumentHandle } from "./collabRuntimeAdapters";
import type { RoomRecoveryStore } from "./collabRuntimeAdapters";
import type { RoomMeta } from "./liveCollaboration";
import type { TextChange } from "@tabula-md/tabula";

type TimeoutHandle = unknown;
type IdleCallbackHandle = unknown;
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
  requestIdleCallbackFn?: (callback: () => void, options?: { timeout?: number }) => IdleCallbackHandle;
  cancelIdleCallbackFn?: (handle: IdleCallbackHandle) => void;
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
const defaultRequestIdleCallback = (callback: () => void, options?: { timeout?: number }): IdleCallbackHandle => {
  const idleScheduler = globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => IdleCallbackHandle;
  };
  return idleScheduler.requestIdleCallback
    ? idleScheduler.requestIdleCallback(callback, options)
    : defaultSetTimeout(callback, 0);
};
const defaultCancelIdleCallback = (handle: IdleCallbackHandle) => {
  const idleScheduler = globalThis as typeof globalThis & {
    cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
  };
  if (idleScheduler.cancelIdleCallback) {
    idleScheduler.cancelIdleCallback(handle);
    return;
  }
  defaultClearTimeout(handle);
};
export const collabSnapshotStoreDelayMs = 8_000;
export const collabSnapshotStoreIdleTimeoutMs = 2_000;

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
  requestIdleCallbackFn = defaultRequestIdleCallback,
  cancelIdleCallbackFn = defaultCancelIdleCallback,
}: CollabSnapshotSyncOptions): CollabSnapshotSync => {
  let snapshotTimer: TimeoutHandle | undefined;
  let snapshotIdleCallback: IdleCallbackHandle | undefined;
  let storePromise: Promise<boolean> | undefined;
  let shouldStoreAfterCurrentSave = false;

  const clearTimer = () => {
    if (snapshotTimer) {
      clearTimeoutFn(snapshotTimer);
      snapshotTimer = undefined;
    }
    if (snapshotIdleCallback) {
      cancelIdleCallbackFn(snapshotIdleCallback);
      snapshotIdleCallback = undefined;
    }
  };

  const refreshMeta = async () => undefined;

  const performStore = async () => {
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

  const store = async () => {
    clearTimer();
    if (storePromise) {
      shouldStoreAfterCurrentSave = true;
      return storePromise;
    }

    storePromise = performStore();
    try {
      return await storePromise;
    } finally {
      storePromise = undefined;
      if (shouldStoreAfterCurrentSave) {
        shouldStoreAfterCurrentSave = false;
        scheduleStore();
      }
    }
  };

  const scheduleStore = () => {
    clearTimer();
    snapshotTimer = setTimeoutFn(() => {
      snapshotTimer = undefined;
      snapshotIdleCallback = requestIdleCallbackFn(() => {
        snapshotIdleCallback = undefined;
        void store();
      }, { timeout: collabSnapshotStoreIdleTimeoutMs });
    }, collabSnapshotStoreDelayMs);
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
    scheduleStore,
    clearTimer,
  };
};
