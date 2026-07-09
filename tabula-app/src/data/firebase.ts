import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import {
  Bytes,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type { RoomCheckpointStore } from "../collaboration/roomCheckpointStore";
import { tabulaServiceConfig } from "../serviceConfig";

type FirebaseRoomCheckpointDocument = {
  formatVersion: 1;
  checkpointVersion: number;
  checkpoint: Bytes;
  updatedAt?: unknown;
};

const firebaseAppName = "tabula-room-checkpoint";
const roomCheckpointFormatVersion = 1;
const roomCheckpointCollection = "roomCheckpoints";

export const createFirebaseRoomCheckpointStore = (
  firebaseConfig = tabulaServiceConfig.firebaseConfig,
): RoomCheckpointStore => {
  if (!firebaseConfig) {
    return createDisabledFirebaseRoomCheckpointStore();
  }

  const config = parseFirebaseConfig(firebaseConfig);
  if (!config) {
    return createDisabledFirebaseRoomCheckpointStore();
  }

  const app =
    getApps().find((candidate) => candidate.name === firebaseAppName) ??
    initializeApp(config, firebaseAppName);
  const firestore = getFirestore(app);

  return {
    enabled: true,
    async loadEncryptedCheckpoint(roomId) {
      const snapshot = await getDoc(doc(firestore, roomCheckpointCollection, roomId));
      if (!snapshot.exists()) {
        return null;
      }

      return readFirebaseRoomCheckpointDocument(snapshot.data()).checkpoint.toUint8Array();
    },
    async saveEncryptedCheckpoint(roomId, encryptedCheckpoint) {
      const roomRef = doc(firestore, roomCheckpointCollection, roomId);
      await runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(roomRef);
        const previous = snapshot.exists()
          ? readFirebaseRoomCheckpointDocument(snapshot.data())
          : null;
        const checkpointVersion = (previous?.checkpointVersion ?? 0) + 1;

        transaction.set(roomRef, {
          formatVersion: roomCheckpointFormatVersion,
          checkpointVersion,
          checkpoint: Bytes.fromUint8Array(encryptedCheckpoint),
          updatedAt: serverTimestamp(),
        } satisfies FirebaseRoomCheckpointDocument);
      });
    },
  };
};

const createDisabledFirebaseRoomCheckpointStore = (): RoomCheckpointStore => ({
  enabled: false,
  async loadEncryptedCheckpoint() {
    return null;
  },
  async saveEncryptedCheckpoint() {
    // Firebase room checkpoints are optional.
  },
});

const parseFirebaseConfig = (rawConfig: string): FirebaseOptions | null => {
  try {
    const parsed = JSON.parse(rawConfig) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Firebase config must be an object");
    }
    return parsed as FirebaseOptions;
  } catch (error) {
    console.warn(`Invalid VITE_TABULA_FIREBASE_CONFIG: ${errorMessage(error)}`);
    return null;
  }
};

const readFirebaseRoomCheckpointDocument = (value: unknown): FirebaseRoomCheckpointDocument => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Firebase room checkpoint document");
  }

  const document = value as Partial<FirebaseRoomCheckpointDocument>;
  if (
    document.formatVersion !== roomCheckpointFormatVersion ||
    !Number.isSafeInteger(document.checkpointVersion) ||
    document.checkpointVersion === undefined ||
    document.checkpointVersion < 0 ||
    !(document.checkpoint instanceof Bytes)
  ) {
    throw new Error("Invalid Firebase room checkpoint document");
  }

  return {
    formatVersion: roomCheckpointFormatVersion,
    checkpointVersion: document.checkpointVersion,
    checkpoint: document.checkpoint,
    updatedAt: document.updatedAt,
  };
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";
