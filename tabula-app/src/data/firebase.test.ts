import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseRoomCheckpointStore } from "./firebase";

const firebaseMocks = vi.hoisted(() => {
  class MockTimestamp {
    constructor(private readonly millis: number) {}
    static fromMillis(millis: number) { return new MockTimestamp(millis); }
    toMillis() { return this.millis; }
  }
  return {
    MockTimestamp,
    connectFirestoreEmulator: vi.fn(),
    connectStorageEmulator: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    doc: vi.fn((_: unknown, ...path: string[]) => ({ path })),
    getApps: vi.fn(() => []),
    getBytes: vi.fn(),
    getDoc: vi.fn(),
    getFirestore: vi.fn(() => ({ name: "firestore" })),
    getStorage: vi.fn(() => ({ name: "storage" })),
    initializeApp: vi.fn((config: unknown, name: string) => ({ config, name })),
    ref: vi.fn((_: unknown, path: string) => ({ path })),
    runTransaction: vi.fn(),
    serverTimestamp: vi.fn(() => ({ serverTimestamp: true })),
    uploadBytes: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("firebase/app", () => ({ getApps: firebaseMocks.getApps, initializeApp: firebaseMocks.initializeApp }));
vi.mock("firebase/firestore", () => ({
  Timestamp: firebaseMocks.MockTimestamp,
  connectFirestoreEmulator: firebaseMocks.connectFirestoreEmulator,
  doc: firebaseMocks.doc,
  getDoc: firebaseMocks.getDoc,
  getFirestore: firebaseMocks.getFirestore,
  runTransaction: firebaseMocks.runTransaction,
  serverTimestamp: firebaseMocks.serverTimestamp,
}));
vi.mock("firebase/storage", () => ({
  connectStorageEmulator: firebaseMocks.connectStorageEmulator,
  deleteObject: firebaseMocks.deleteObject,
  getBytes: firebaseMocks.getBytes,
  getStorage: firebaseMocks.getStorage,
  ref: firebaseMocks.ref,
  uploadBytes: firebaseMocks.uploadBytes,
}));

const firebaseConfig = JSON.stringify({ apiKey: "test", projectId: "tabula-test", appId: "test-app" });

beforeEach(() => {
  vi.clearAllMocks();
  firebaseMocks.getApps.mockReturnValue([]);
});

describe("Firebase room checkpoint store", () => {
  it("stays disabled without configuration", async () => {
    const store = createFirebaseRoomCheckpointStore(null);
    expect(store.enabled).toBe(false);
    await expect(store.loadEncryptedCheckpoint("room-1")).resolves.toBeNull();
  });

  it("loads ciphertext from Storage through a Firestore generation pointer", async () => {
    const encrypted = new Uint8Array([1, 2, 3, 4]);
    firebaseMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        formatVersion: 2,
        generation: 3,
        blobPath: "roomCheckpoints/room-1/blob.bin",
        byteLength: encrypted.byteLength,
        expiresAt: firebaseMocks.MockTimestamp.fromMillis(Date.now() + 10_000),
      }),
    });
    firebaseMocks.getBytes.mockResolvedValue(encrypted.buffer);

    const store = createFirebaseRoomCheckpointStore(firebaseConfig);
    await expect(store.loadEncryptedCheckpoint("room-1")).resolves.toMatchObject({
      status: "ready",
      generation: 3,
      encryptedCheckpoint: encrypted,
    });
    expect(firebaseMocks.getDoc).toHaveBeenCalledWith({ path: ["roomCheckpointPointers", "room-1"] });
    expect(firebaseMocks.getBytes).toHaveBeenCalledWith({ path: "roomCheckpoints/room-1/blob.bin" });
  });

  it("retries once when the pointer advances while the previous blob is being removed", async () => {
    const expiresAt = firebaseMocks.MockTimestamp.fromMillis(Date.now() + 10_000);
    firebaseMocks.getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          formatVersion: 2,
          generation: 2,
          blobPath: "roomCheckpoints/room-1/old.bin",
          byteLength: 3,
          expiresAt,
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          formatVersion: 2,
          generation: 3,
          blobPath: "roomCheckpoints/room-1/new.bin",
          byteLength: 4,
          expiresAt,
        }),
      });
    firebaseMocks.getBytes
      .mockRejectedValueOnce(new Error("object-not-found"))
      .mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4]).buffer);

    const store = createFirebaseRoomCheckpointStore(firebaseConfig);
    await expect(store.loadEncryptedCheckpoint("room-1")).resolves.toMatchObject({
      status: "ready",
      generation: 3,
      encryptedCheckpoint: new Uint8Array([1, 2, 3, 4]),
    });
    expect(firebaseMocks.getDoc).toHaveBeenCalledTimes(2);
    expect(firebaseMocks.getBytes).toHaveBeenCalledTimes(2);
  });

  it("does not retry the same broken checkpoint blob indefinitely", async () => {
    const pointer = {
      formatVersion: 2,
      generation: 2,
      blobPath: "roomCheckpoints/room-1/broken.bin",
      byteLength: 3,
      expiresAt: firebaseMocks.MockTimestamp.fromMillis(Date.now() + 10_000),
    };
    firebaseMocks.getDoc.mockResolvedValue({ exists: () => true, data: () => pointer });
    firebaseMocks.getBytes.mockRejectedValue(new Error("object-not-found"));

    const store = createFirebaseRoomCheckpointStore(firebaseConfig);
    await expect(store.loadEncryptedCheckpoint("room-1")).rejects.toThrow("object-not-found");
    expect(firebaseMocks.getDoc).toHaveBeenCalledTimes(2);
    expect(firebaseMocks.getBytes).toHaveBeenCalledTimes(1);
  });

  it("uploads ciphertext then advances the pointer only when generation matches", async () => {
    const encrypted = new Uint8Array([5, 6, 7]);
    const set = vi.fn();
    firebaseMocks.runTransaction.mockImplementation(async (_db, callback) => callback({
      get: vi.fn().mockResolvedValue({ exists: () => false }),
      set,
    }));
    const store = createFirebaseRoomCheckpointStore(firebaseConfig);
    await expect(store.saveEncryptedCheckpoint("room-1", {
      expectedGeneration: 0,
      encryptedCheckpoint: encrypted,
      expiresAt: Date.now() + 10_000,
    })).resolves.toEqual({ ok: true, generation: 1 });

    expect(firebaseMocks.uploadBytes).toHaveBeenCalledTimes(1);
    const written = set.mock.calls[0][1];
    expect(written).toMatchObject({ formatVersion: 2, generation: 1, byteLength: 3 });
    expect(written).not.toHaveProperty("roomKey");
    expect(written).not.toHaveProperty("markdown");
  });
});
