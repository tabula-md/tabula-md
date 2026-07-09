import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseRoomCheckpointStore } from "./firebase";

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

beforeEach(() => {
  vi.clearAllMocks();
  firebaseMocks.getApps.mockReturnValue([]);
});

describe("createFirebaseRoomCheckpointStore", () => {
  it("stays disabled when config is missing", async () => {
    const store = createFirebaseRoomCheckpointStore(null);

    expect(store.enabled).toBe(false);
    await expect(store.loadEncryptedCheckpoint("room-1")).resolves.toBeNull();
    await expect(store.saveEncryptedCheckpoint("room-1", new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
    expect(firebaseMocks.initializeApp).not.toHaveBeenCalled();
  });

  it("loads ciphertext-only room checkpoints by public room id", async () => {
    const encryptedCheckpoint = new Uint8Array([1, 2, 3, 4]);
    firebaseMocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        formatVersion: 1,
        checkpointVersion: 1,
        checkpoint: firebaseMocks.MockBytes.fromUint8Array(encryptedCheckpoint),
        updatedAt: { serverTimestamp: true },
      }),
    });

    const store = createFirebaseRoomCheckpointStore(firebaseConfig);
    await expect(store.loadEncryptedCheckpoint("room-1")).resolves.toEqual(encryptedCheckpoint);

    expect(firebaseMocks.getDoc).toHaveBeenCalledWith({ path: ["roomCheckpoints", "room-1"] });
  });

  it("writes encrypted checkpoints through a Firestore transaction without keys or plaintext", async () => {
    const encryptedCheckpoint = new Uint8Array([5, 6, 7, 8]);
    const set = vi.fn();
    firebaseMocks.runTransaction.mockImplementation(async (_firestore, callback) =>
      callback({
        get: vi.fn().mockResolvedValue({ exists: () => false }),
        set,
      }),
    );

    const store = createFirebaseRoomCheckpointStore(firebaseConfig);
    await store.saveEncryptedCheckpoint("room-1", encryptedCheckpoint);

    expect(set).toHaveBeenCalledTimes(1);
    const [, written] = set.mock.calls[0] as [
      unknown,
      {
        formatVersion: 1;
        checkpointVersion: number;
        checkpoint: InstanceType<typeof firebaseMocks.MockBytes>;
        updatedAt: unknown;
      },
    ];
    expect(written.formatVersion).toBe(1);
    expect(written.checkpointVersion).toBe(1);
    expect(written.checkpoint.toUint8Array()).toEqual(encryptedCheckpoint);
    expect(written).not.toHaveProperty("roomKey");
    expect(written).not.toHaveProperty("markdown");
    expect(written).not.toHaveProperty("plaintext");
  });
});
