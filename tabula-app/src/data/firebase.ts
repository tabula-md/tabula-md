import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import {
  Bytes,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  decryptData,
  encryptData,
  toArrayBuffer,
} from "@tabula-md/tabula";
import {
  createDisabledRoomRecoveryStore,
  type RoomRecoveryStore,
} from "../collaboration/collabRuntimeAdapters";
import { tabulaServiceConfig } from "../serviceConfig";

type FirebaseRoomDocument = {
  formatVersion: 1;
  stateVersion: number;
  iv: Bytes;
  ciphertext: Bytes;
  updatedAt?: unknown;
};

const firebaseAppName = "tabula-room-recovery";
const roomRecoveryFormatVersion = 1;
const textEncoder = new TextEncoder();

export const createFirebaseRoomRecoveryStore = (
  firebaseConfig = tabulaServiceConfig.firebaseConfig,
): RoomRecoveryStore => {
  if (!firebaseConfig) {
    return createDisabledRoomRecoveryStore();
  }

  const config = parseFirebaseConfig(firebaseConfig);
  if (!config) {
    return createDisabledRoomRecoveryStore();
  }

  const app =
    getApps().find((candidate) => candidate.name === firebaseAppName) ??
    initializeApp(config, firebaseAppName);
  const firestore = getFirestore(app);

  return {
    async load(roomId, roomKey) {
      const snapshot = await getDoc(doc(firestore, "rooms", roomId));
      if (!snapshot.exists()) {
        return null;
      }

      return decryptStoredRoomState(readFirebaseRoomDocument(snapshot.data()), roomId, roomKey);
    },
    async save({ roomId, roomKey, state, mergeStates }) {
      const roomRef = doc(firestore, "rooms", roomId);
      return runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(roomRef);
        const previous = snapshot.exists() ? readFirebaseRoomDocument(snapshot.data()) : null;
        const previousState = previous
          ? await decryptStoredRoomState(previous, roomId, roomKey)
          : null;
        const nextState = previousState && mergeStates ? mergeStates([previousState, state]) : state;
        const stateVersion = (previous?.stateVersion ?? 0) + 1;
        const encrypted = await encryptData(roomKey, nextState, {
          additionalData: createFirebaseRoomAad(roomId, stateVersion),
        });

        transaction.set(roomRef, {
          formatVersion: roomRecoveryFormatVersion,
          stateVersion,
          iv: Bytes.fromUint8Array(encrypted.iv),
          ciphertext: Bytes.fromUint8Array(new Uint8Array(encrypted.encryptedBuffer)),
          updatedAt: serverTimestamp(),
        } satisfies FirebaseRoomDocument);

        return { version: stateVersion };
      });
    },
  };
};

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

const readFirebaseRoomDocument = (value: unknown): FirebaseRoomDocument => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Firebase room recovery document");
  }

  const document = value as Partial<FirebaseRoomDocument>;
  if (
    document.formatVersion !== roomRecoveryFormatVersion ||
    !Number.isSafeInteger(document.stateVersion) ||
    document.stateVersion === undefined ||
    document.stateVersion < 0 ||
    !(document.iv instanceof Bytes) ||
    !(document.ciphertext instanceof Bytes)
  ) {
    throw new Error("Invalid Firebase room recovery document");
  }

  return {
    formatVersion: roomRecoveryFormatVersion,
    stateVersion: document.stateVersion,
    iv: document.iv,
    ciphertext: document.ciphertext,
    updatedAt: document.updatedAt,
  };
};

const decryptStoredRoomState = async (
  stored: FirebaseRoomDocument,
  roomId: string,
  roomKey: string,
) =>
  new Uint8Array(
    await decryptData(
      stored.iv.toUint8Array(),
      toArrayBuffer(stored.ciphertext.toUint8Array()),
      roomKey,
      {
        additionalData: createFirebaseRoomAad(roomId, stored.stateVersion),
      },
    ),
  );

const createFirebaseRoomAad = (roomId: string, stateVersion: number) =>
  textEncoder.encode(
    JSON.stringify({
      formatVersion: roomRecoveryFormatVersion,
      roomId,
      stateVersion,
    }),
  );

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";
