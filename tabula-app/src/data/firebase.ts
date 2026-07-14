import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import {
  Timestamp,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  deleteObject,
  connectStorageEmulator,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import type { RoomCheckpointStore } from "../collaboration/roomCheckpointStore";
import { tabulaServiceConfig } from "../serviceConfig";

type FirebaseRoomCheckpointPointer = {
  formatVersion: 2;
  generation: number;
  blobPath: string;
  byteLength: number;
  updatedAt?: unknown;
  expiresAt: Timestamp;
};

const firebaseAppName = "tabula-room-checkpoint";
const roomCheckpointFormatVersion = 2;
const roomCheckpointCollection = "roomCheckpointPointers";
const emulatorConnectedApps = new Set<string>();

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
};

const createBlobId = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const createFirebaseRoomCheckpointStore = (
  firebaseConfig = tabulaServiceConfig.firebaseConfig,
): RoomCheckpointStore => {
  if (!firebaseConfig) return createDisabledFirebaseRoomCheckpointStore();
  const config = parseFirebaseConfig(firebaseConfig);
  if (!config) return createDisabledFirebaseRoomCheckpointStore();

  const app = getApps().find((candidate) => candidate.name === firebaseAppName) ?? initializeApp(config, firebaseAppName);
  const firestore = getFirestore(app);
  const storage = getStorage(app);
  if (
    tabulaServiceConfig.firebaseEmulatorHost &&
    !emulatorConnectedApps.has(app.name)
  ) {
    connectFirestoreEmulator(
      firestore,
      tabulaServiceConfig.firebaseEmulatorHost,
      tabulaServiceConfig.firestoreEmulatorPort,
    );
    connectStorageEmulator(
      storage,
      tabulaServiceConfig.firebaseEmulatorHost,
      tabulaServiceConfig.firebaseStorageEmulatorPort,
    );
    emulatorConnectedApps.add(app.name);
  }

  return {
    enabled: true,
    async loadEncryptedCheckpoint(roomId, signal) {
      let failedPointer: FirebaseRoomCheckpointPointer | null = null;
      let failedRead: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        throwIfAborted(signal);
        const snapshot = await getDoc(doc(firestore, roomCheckpointCollection, roomId));
        throwIfAborted(signal);
        if (!snapshot.exists()) return null;
        const pointer = readFirebaseRoomCheckpointPointer(snapshot.data());
        if (
          failedPointer &&
          failedPointer.generation === pointer.generation &&
          failedPointer.blobPath === pointer.blobPath
        ) {
          throw failedRead;
        }
        const expiresAt = pointer.expiresAt.toMillis();
        if (expiresAt <= Date.now()) {
          return { status: "expired", generation: pointer.generation, expiresAt };
        }
        try {
          const bytes = await getBytes(ref(storage, pointer.blobPath));
          throwIfAborted(signal);
          if (bytes.byteLength !== pointer.byteLength) {
            throw new Error("Room checkpoint blob length does not match its pointer.");
          }
          return {
            status: "ready",
            generation: pointer.generation,
            encryptedCheckpoint: new Uint8Array(bytes),
            expiresAt,
          };
        } catch (error) {
          throwIfAborted(signal);
          failedPointer = pointer;
          failedRead = error;
        }
      }
      throw failedRead;
    },
    async saveEncryptedCheckpoint(roomId, request, signal) {
      throwIfAborted(signal);
      const blobPath = `roomCheckpoints/${roomId}/${createBlobId()}.bin`;
      const blobRef = ref(storage, blobPath);
      await uploadBytes(blobRef, request.encryptedCheckpoint, { contentType: "application/octet-stream" });
      throwIfAborted(signal);
      const pointerRef = doc(firestore, roomCheckpointCollection, roomId);
      const createPointer = (generation: number) => ({
        formatVersion: roomCheckpointFormatVersion,
        generation,
        blobPath,
        byteLength: request.encryptedCheckpoint.byteLength,
        updatedAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(request.expiresAt),
      } satisfies FirebaseRoomCheckpointPointer);
      let previousBlobPath: string | null = null;
      try {
        if (request.expectedGeneration === 0) {
          try {
            await setDoc(pointerRef, createPointer(1));
            return { ok: true, generation: 1 };
          } catch (error) {
            throwIfAborted(signal);
            const existing = await getDoc(pointerRef);
            if (existing.exists()) {
              await deleteObject(blobRef).catch(() => undefined);
              return {
                ok: false,
                reason: "conflict",
                generation: readFirebaseRoomCheckpointPointer(existing.data()).generation,
              };
            }
            throw error;
          }
        }
        const result = await runTransaction(firestore, async (transaction) => {
          const snapshot = await transaction.get(pointerRef);
          const previous = snapshot.exists() ? readFirebaseRoomCheckpointPointer(snapshot.data()) : null;
          const generation = previous?.generation ?? 0;
          if (generation !== request.expectedGeneration) {
            return { ok: false as const, reason: "conflict" as const, generation };
          }
          previousBlobPath = previous?.blobPath ?? null;
          const nextGeneration = generation + 1;
          transaction.set(pointerRef, createPointer(nextGeneration));
          return { ok: true as const, generation: nextGeneration };
        });
        if (!result.ok) {
          await deleteObject(blobRef).catch(() => undefined);
          return result;
        }
        if (previousBlobPath && previousBlobPath !== blobPath) {
          await deleteObject(ref(storage, previousBlobPath)).catch(() => undefined);
        }
        return result;
      } catch (error) {
        await deleteObject(blobRef).catch(() => undefined);
        throw error;
      }
    },
  };
};

const createDisabledFirebaseRoomCheckpointStore = (): RoomCheckpointStore => ({
  enabled: false,
  async loadEncryptedCheckpoint() { return null; },
  async saveEncryptedCheckpoint() {
    throw new Error("Live room persistence is unavailable.");
  },
});

const parseFirebaseConfig = (rawConfig: string): FirebaseOptions | null => {
  try {
    const parsed = JSON.parse(rawConfig) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Firebase config must be an object");
    return parsed as FirebaseOptions;
  } catch (error) {
    console.warn(`Invalid VITE_TABULA_FIREBASE_CONFIG: ${errorMessage(error)}`);
    return null;
  }
};

const readFirebaseRoomCheckpointPointer = (value: unknown): FirebaseRoomCheckpointPointer => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Firebase room checkpoint pointer");
  const pointer = value as Partial<FirebaseRoomCheckpointPointer>;
  if (
    pointer.formatVersion !== roomCheckpointFormatVersion ||
    !Number.isSafeInteger(pointer.generation) ||
    pointer.generation === undefined || pointer.generation < 1 ||
    typeof pointer.blobPath !== "string" || !pointer.blobPath.startsWith("roomCheckpoints/") ||
    !Number.isSafeInteger(pointer.byteLength) || pointer.byteLength === undefined || pointer.byteLength < 1 ||
    !(pointer.expiresAt instanceof Timestamp)
  ) throw new Error("Invalid Firebase room checkpoint pointer");
  return pointer as FirebaseRoomCheckpointPointer;
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Unknown error";
