import type { EncryptedEnvelope, EnvelopeKind } from "./roomProtocol";
import type { FetchLike } from "./collabRoomClient";
import type { CreateRoomTransport } from "./roomTransport";
import type { TextChange, TextPatch } from "@tabula-md/tabula";

export type CollabRuntimeTimerHandle = unknown;

export type CollabRuntimeClock = {
  setTimeout(callback: () => void, delayMs: number): CollabRuntimeTimerHandle;
  clearTimeout(handle: CollabRuntimeTimerHandle): void;
  setInterval(callback: () => void, delayMs: number): CollabRuntimeTimerHandle;
  clearInterval(handle: CollabRuntimeTimerHandle): void;
  nowIso(): string;
  createId(): string;
};

export type CollabTextDocumentHandle = unknown;

export type CollabTextUpdateListener = (update: Uint8Array, origin: unknown) => void;

export type CollabTextChangeResult = {
  text: string;
  change: TextChange;
};

export type CollabTextAdapter = {
  createDocument(initialText?: string): CollabTextDocumentHandle;
  observeUpdates(document: CollabTextDocumentHandle, listener: CollabTextUpdateListener): () => void;
  isRemoteOrigin(origin: unknown): boolean;
  encodeState(document: CollabTextDocumentHandle): Uint8Array;
  mergeUpdates(updates: readonly Uint8Array[]): Uint8Array;
  applyLocalText(document: CollabTextDocumentHandle, nextText: string, patches?: readonly TextPatch[]): void;
  applyRemoteUpdate(document: CollabTextDocumentHandle, update: Uint8Array): CollabTextChangeResult | null;
  destroy(document: CollabTextDocumentHandle): void;
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
  text: CollabTextAdapter;
  createRoomTransport: CreateRoomTransport;
  resolveRoomBaseUrl: () => string | null;
  fetcher?: FetchLike;
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
  nowIso() {
    return new Date().toISOString();
  },
  createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  },
});
