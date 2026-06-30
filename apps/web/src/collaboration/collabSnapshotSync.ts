import * as Y from "yjs";

import type { EncryptedEnvelope } from "./roomProtocol";
import { fetchRoomMeta, fetchRoomSnapshotEnvelope, putRoomSnapshotEnvelope, type FetchLike } from "./collabRoomClient";
import { applyRemoteUpdateToYText, type CollabTextDocument } from "./collabTextModel";
import type { RoomMeta } from "./liveCollaboration";
import type { TextChange } from "../textPatches";

type TimeoutHandle = unknown;
export type CollabSnapshotFetchResult = "missing" | "restored" | false;

type SnapshotRecoveryType = "snapshot-recovered" | "invalid-message";

type CollabSnapshotSyncOptions = {
  roomId: string;
  textDocument: CollabTextDocument;
  getBaseUrl: () => string;
  canUseSnapshots: () => boolean;
  encryptSnapshot: (update: Uint8Array) => Promise<EncryptedEnvelope>;
  decryptSnapshot: (envelope: EncryptedEnvelope) => Promise<Uint8Array>;
  onTextChange: (text: string, change?: TextChange) => void;
  onRoomMetaChange?: (meta: RoomMeta) => void;
  onSnapshotStored?: () => void;
  emitRecoveryEvent: (type: SnapshotRecoveryType, message: string) => void;
  fetcher?: FetchLike;
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

export const createCollabSnapshotSync = ({
  roomId,
  textDocument,
  getBaseUrl,
  canUseSnapshots,
  encryptSnapshot,
  decryptSnapshot,
  onTextChange,
  onRoomMetaChange,
  onSnapshotStored,
  emitRecoveryEvent,
  fetcher,
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

  const refreshMeta = async () => {
    const meta = await fetchRoomMeta({ baseUrl: getBaseUrl(), roomId, fetcher });
    if (meta) {
      onRoomMetaChange?.(meta);
    }
  };

  const store = async () => {
    if (!canUseSnapshots()) {
      return false;
    }

    try {
      const envelope = await encryptSnapshot(Y.encodeStateAsUpdate(textDocument.doc));
      const meta = await putRoomSnapshotEnvelope({ baseUrl: getBaseUrl(), roomId, envelope, fetcher });
      if (!meta) {
        return false;
      }

      clearTimer();
      onSnapshotStored?.();
      onRoomMetaChange?.(meta);
      return true;
    } catch {
      emitRecoveryEvent("invalid-message", "The encrypted room snapshot could not be stored.");
      return false;
    }
  };

  return {
    refreshMeta,
    async fetch() {
      if (!canUseSnapshots()) {
        return false;
      }

      try {
        const snapshot = await fetchRoomSnapshotEnvelope({ baseUrl: getBaseUrl(), roomId, fetcher });
        if (snapshot.status === "missing") {
          await refreshMeta();
          return "missing";
        }
        if (snapshot.status === "invalid") {
          emitRecoveryEvent("invalid-message", snapshot.message);
          return false;
        }

        const update = await decryptSnapshot(snapshot.envelope);
        const result = applyRemoteUpdateToYText({ ...textDocument, update });
        if (result) {
          onTextChange(result.text, result.change);
        }
        emitRecoveryEvent("snapshot-recovered", "Encrypted room snapshot restored.");
        await refreshMeta();
        return "restored";
      } catch {
        emitRecoveryEvent("invalid-message", "The encrypted room snapshot could not be decrypted.");
        return false;
      }
    },
    store,
    scheduleStore() {
      clearTimer();
      snapshotTimer = setTimeoutFn(() => {
        void store();
      }, 1_000);
    },
    clearTimer,
  };
};
