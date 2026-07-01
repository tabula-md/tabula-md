import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  decryptData,
  encryptData,
  generateEncryptionKey,
  toArrayBuffer,
} from "@tabula-md/tabula";
import { createFirebaseRoomRecoveryStore } from "./firebase";

const firebaseMocks = vi.hoisted(() => {
  class MockBytes {
    static fromUint8Array(bytes: Uint8Array) {
      return new MockBytes(bytes);
    }

    private readonly bytes: Uint8Array;

    constructor(bytes: Uint8Array) {
      this.bytes = new Uint8Array(bytes);
    }

    toUint8Array() {
      return new Uint8Array(this.bytes);
    }
  }

  return {
    MockBytes,
    doc: vi.fn((_: unknown, ...path: string[]) => ({ path })),
    getApps: vi.fn(() => []),
    getDoc: vi.fn(),
    getFirestore: vi.fn(() => ({ name: "firestore" })),
    initializeApp: vi.fn((config: unknown, name: string) => ({ config, name })),
    runTransaction: vi.fn(),
    serverTimestamp: vi.fn(() => ({ serverTimestamp: true })),
  };
});

vi.mock("firebase/app", () => ({
  getApps: firebaseMocks.getApps,
  initializeApp: firebaseMocks.initializeApp,
}));

vi.mock("firebase/firestore", () => ({
  Bytes: firebaseMocks.MockBytes,
  doc: firebaseMocks.doc,
  getDoc: firebaseMocks.getDoc,
  getFirestore: firebaseMocks.getFirestore,
  runTransaction: firebaseMocks.runTransaction,
  serverTimestamp: firebaseMocks.serverTimestamp,
}));

const firebaseConfig = JSON.stringify({
  apiKey: "test-api-key",
  authDomain: "tabula-test.firebaseapp.com",
  projectId: "tabula-test",
  appId: "test-app-id",
});

const createAad = (roomId: string, stateVersion: number) =>
  new TextEncoder().encode(
    JSON.stringify({
      formatVersion: 1,
      roomId,
      stateVersion,
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  firebaseMocks.getApps.mockReturnValue([]);
});

describe("createFirebaseRoomRecoveryStore", () => {
  it("falls back to the disabled store when config is missing", async () => {
    const store = createFirebaseRoomRecoveryStore(null);

    await expect(store.load("room-1", "key")).resolves.toBeNull();
    await expect(
      store.save({
        roomId: "room-1",
        roomKey: "key",
        state: new Uint8Array([1, 2, 3]),
      }),
    ).resolves.toBeNull();
    expect(firebaseMocks.initializeApp).not.toHaveBeenCalled();
  });

  it("loads and decrypts ciphertext-only room recovery documents", async () => {
    const roomId = "room-1";
    const roomKey = await generateEncryptionKey();
    const state = new Uint8Array([1, 2, 3, 4]);
    const encrypted = await encryptData(roomKey, state, {
      additionalData: createAad(roomId, 1),
    });
    firebaseMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        formatVersion: 1,
        stateVersion: 1,
        iv: firebaseMocks.MockBytes.fromUint8Array(encrypted.iv),
        ciphertext: firebaseMocks.MockBytes.fromUint8Array(new Uint8Array(encrypted.encryptedBuffer)),
        updatedAt: { serverTimestamp: true },
      }),
    });

    const store = createFirebaseRoomRecoveryStore(firebaseConfig);
    const loaded = await store.load(roomId, roomKey);

    expect(loaded).toEqual(state);
    expect(firebaseMocks.getDoc).toHaveBeenCalledWith({ path: ["rooms", roomId] });
  });

  it("writes encrypted recovery state through a Firestore transaction", async () => {
    const roomId = "room-1";
    const roomKey = await generateEncryptionKey();
    const state = new Uint8Array([5, 6, 7, 8]);
    const set = vi.fn();
    firebaseMocks.runTransaction.mockImplementation(async (_firestore, callback) =>
      callback({
        get: vi.fn().mockResolvedValue({ exists: () => false }),
        set,
      }),
    );

    const store = createFirebaseRoomRecoveryStore(firebaseConfig);
    const result = await store.save({ roomId, roomKey, state });

    expect(result).toEqual({ version: 1 });
    expect(set).toHaveBeenCalledTimes(1);
    const [, written] = set.mock.calls[0] as [
      unknown,
      {
        formatVersion: 1;
        stateVersion: number;
        iv: InstanceType<typeof firebaseMocks.MockBytes>;
        ciphertext: InstanceType<typeof firebaseMocks.MockBytes>;
        updatedAt: unknown;
      },
    ];
    expect(written.formatVersion).toBe(1);
    expect(written.stateVersion).toBe(1);
    expect(written).not.toHaveProperty("roomKey");
    expect(written).not.toHaveProperty("state");

    const decrypted = new Uint8Array(
      await decryptData(
        written.iv.toUint8Array(),
        toArrayBuffer(written.ciphertext.toUint8Array()),
        roomKey,
        { additionalData: createAad(roomId, 1) },
      ),
    );
    expect(decrypted).toEqual(state);
  });
});
