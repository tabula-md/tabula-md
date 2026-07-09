import {
  createRoomShareUrl as createRoomShareUrlFromModel,
  decodeBase64Url,
  encodeBase64Url,
  createRoomEnvelope,
  decryptRoomEnvelope,
  generateEncryptionKey,
  getCrypto,
  importEncryptionKey,
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

export {
  decodeBase64Url,
  encodeBase64Url,
  parseRoomFromHash,
  parseRoomKeyFromHash,
  parseRoomLocation,
  parseRoomShareUrl,
};
export type { ParsedRoomLocation, RoomSession };

export const generateRoomKey = () => {
  return generateEncryptionKey(ROOM_KEY_BYTES);
};

export const generateRoomId = () => {
  const bytes = new Uint8Array(ROOM_ID_BYTES);
  getCrypto().getRandomValues(bytes);
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
  return importEncryptionKey(encodedKey, ["encrypt", "decrypt"], ROOM_KEY_BYTES);
};

export const encryptBytesForRoom = async (
  roomKey: CryptoKey,
  roomId: string,
  kind: EnvelopeKind,
  version: number,
  plaintext: Uint8Array,
): Promise<EncryptedEnvelope> => {
  return createRoomEnvelope({
    roomKey,
    roomId,
    kind,
    version,
    plaintext,
  });
};

export const decryptEnvelopeForRoom = async (roomKey: CryptoKey, envelope: EncryptedEnvelope) => {
  return decryptRoomEnvelope({ roomKey, envelope });
};

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
