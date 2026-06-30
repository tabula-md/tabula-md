import {
  createRoomShareUrl as createRoomShareUrlFromModel,
  decodeBase64Url,
  encodeBase64Url,
  parseRoomFromHash,
  parseRoomKeyFromHash,
  parseRoomLocation,
  parseRoomShareUrl,
  ROOM_ID_BYTES,
  ROOM_KEY_BYTES,
  type ParsedRoomLocation,
  type RoomSession,
} from "@tabula-md/tabula";
import {
  resolveTabulaRoomServiceUrl,
  tabulaServiceConfig,
  type RoomServiceLocation,
} from "../serviceConfig";
import type { EncryptedEnvelope, EnvelopeKind } from "./roomProtocol";

type SnapshotFetchResult = "missing" | "restored";

type ResolveTabulaRoomUrlOptions = {
  configuredUrl?: string | null;
  isDev?: boolean;
  location?: RoomServiceLocation;
};

export type TabulaRoomAvailability =
  | {
      available: true;
      baseUrl: string;
      unavailableReason: "";
    }
  | {
      available: false;
      baseUrl: "";
      unavailableReason: string;
    };

export const ROOM_UNCONFIGURED_MESSAGE =
  tabulaServiceConfig.copy.roomUnconfiguredMessage;

const AES_GCM_IV_BYTES = 12;

export {
  decodeBase64Url,
  encodeBase64Url,
  parseRoomFromHash,
  parseRoomKeyFromHash,
  parseRoomLocation,
  parseRoomShareUrl,
};
export type { ParsedRoomLocation, RoomSession };

export const shouldStoreSnapshotAfterJoin = ({
  hasUnstoredLocalChanges,
  snapshotFetchResult,
}: {
  hasUnstoredLocalChanges: boolean;
  snapshotFetchResult: SnapshotFetchResult;
}) => hasUnstoredLocalChanges || snapshotFetchResult === "missing";

export const generateRoomKey = () => {
  const bytes = new Uint8Array(ROOM_KEY_BYTES);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
};

export const generateRoomId = () => {
  const bytes = new Uint8Array(ROOM_ID_BYTES);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
};

export const createRoomShareUrl = (origin: string, roomId: string, roomKey = generateRoomKey()) =>
  createRoomShareUrlFromModel(origin, roomId, roomKey);

export const createRoomSession = (origin: string): RoomSession => {
  const roomId = generateRoomId();
  const roomKey = generateRoomKey();

  return {
    roomId,
    roomKey,
    shareUrl: createRoomShareUrl(origin, roomId, roomKey),
  };
};

export const importRoomKey = async (encodedKey: string) => {
  const rawKey = decodeBase64Url(encodedKey);
  if (rawKey.byteLength !== ROOM_KEY_BYTES) {
    throw new Error("Room key must be 32 bytes");
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(rawKey), "AES-GCM", false, ["encrypt", "decrypt"]);
};

export const encryptBytesForRoom = async (
  roomKey: CryptoKey,
  roomId: string,
  kind: EnvelopeKind,
  version: number,
  plaintext: Uint8Array,
): Promise<EncryptedEnvelope> => {
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, roomKey, toArrayBuffer(plaintext)),
  );

  return {
    v: 1,
    roomId,
    kind,
    version,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(ciphertext),
    createdAt: new Date().toISOString(),
  };
};

export const decryptEnvelopeForRoom = async (roomKey: CryptoKey, envelope: EncryptedEnvelope) => {
  const iv = decodeBase64Url(envelope.iv);
  const ciphertext = decodeBase64Url(envelope.ciphertext);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, roomKey, toArrayBuffer(ciphertext)));
};

const toArrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export const resolveTabulaRoomBaseUrl = ({
  configuredUrl = tabulaServiceConfig.roomUrl,
  isDev = tabulaServiceConfig.isDev,
  location = window.location,
}: ResolveTabulaRoomUrlOptions = {}) => {
  return resolveTabulaRoomServiceUrl({ configuredUrl, isDev, location });
};

export const getTabulaRoomAvailability = (): TabulaRoomAvailability => {
  const baseUrl = resolveTabulaRoomBaseUrl();
  return baseUrl
    ? { available: true, baseUrl, unavailableReason: "" }
    : { available: false, baseUrl: "", unavailableReason: ROOM_UNCONFIGURED_MESSAGE };
};
