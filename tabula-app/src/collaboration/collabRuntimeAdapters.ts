import type { EncryptedEnvelope, EnvelopeKind } from "./roomProtocol";
import type { RoomCheckpointStore } from "./roomCheckpointStore";
import type { CreateRoomTransport } from "./roomTransport";

export type CollabRuntimeTimerHandle = unknown;

export type CollabRuntimeClock = {
  setTimeout(callback: () => void, delayMs: number): CollabRuntimeTimerHandle;
  clearTimeout(handle: CollabRuntimeTimerHandle): void;
  setInterval(callback: () => void, delayMs: number): CollabRuntimeTimerHandle;
  clearInterval(handle: CollabRuntimeTimerHandle): void;
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => CollabRuntimeTimerHandle;
  cancelIdleCallback?: (handle: CollabRuntimeTimerHandle) => void;
  nowIso(): string;
  createId(): string;
};

export type CollabCryptoAdapter = {
  importRoomKey(encodedKey: string): Promise<CryptoKey>;
  encryptEnvelope(
    roomKey: CryptoKey,
    roomId: string,
    kind: EnvelopeKind,
    version: number,
    plaintext: Uint8Array,
  ): Promise<EncryptedEnvelope>;
  decryptEnvelope(roomKey: CryptoKey, envelope: EncryptedEnvelope): Promise<Uint8Array>;
};

export type CollabRuntimeAdapters = {
  clock: CollabRuntimeClock;
  crypto: CollabCryptoAdapter;
  roomCheckpointStore: RoomCheckpointStore;
  createRoomTransport: CreateRoomTransport;
  resolveRoomBaseUrl: () => string | null;
};

export const createBrowserCollabRuntimeClock = (): CollabRuntimeClock => ({
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  clearTimeout(handle) {
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
  setInterval(callback, delayMs) {
    return globalThis.setInterval(callback, delayMs);
  },
  clearInterval(handle) {
    globalThis.clearInterval(handle as ReturnType<typeof setInterval>);
  },
  requestIdleCallback(callback, options) {
    const idleScheduler = globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => CollabRuntimeTimerHandle;
    };
    return idleScheduler.requestIdleCallback
      ? idleScheduler.requestIdleCallback(callback, options)
      : globalThis.setTimeout(callback, 0);
  },
  cancelIdleCallback(handle) {
    const idleScheduler = globalThis as typeof globalThis & {
      cancelIdleCallback?: (handle: CollabRuntimeTimerHandle) => void;
    };
    if (idleScheduler.cancelIdleCallback) {
      idleScheduler.cancelIdleCallback(handle);
      return;
    }
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
  nowIso() {
    return new Date().toISOString();
  },
  createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  },
});
