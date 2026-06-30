import type { EncryptedEnvelope, EnvelopeKind } from "./roomProtocol";

type RoomServiceLocation = Pick<Location, "hostname" | "protocol">;
type RoomRouteLocation = Pick<Location, "hash" | "origin" | "pathname">;
type SnapshotFetchResult = "missing" | "restored";

type ResolveTabulaRoomUrlOptions = {
  configuredUrl?: string;
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

export type RoomSession = {
  roomId: string;
  roomKey: string;
  shareUrl: string;
};

export type ParsedRoomLocation = RoomSession;

export const ROOM_UNCONFIGURED_MESSAGE =
  "Live collaboration needs a Tabula Room server. Configure VITE_TABULA_ROOM_URL to start sessions.";

const ROOM_ID_BYTES = 16;
const ROOM_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const ROOM_SERVER_PORT = 3002;
const ROOM_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

export const shouldStoreSnapshotAfterJoin = ({
  hasUnstoredLocalChanges,
  snapshotFetchResult,
}: {
  hasUnstoredLocalChanges: boolean;
  snapshotFetchResult: SnapshotFetchResult;
}) => hasUnstoredLocalChanges || snapshotFetchResult === "missing";

export const encodeBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

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

export const parseRoomFromHash = (hash: string): Pick<RoomSession, "roomId" | "roomKey"> | null => {
  const fragment = hash.replace(/^#/, "").trim();
  if (!fragment.startsWith("room=")) {
    return null;
  }

  const roomValue = fragment.slice("room=".length);
  const [roomId, roomKey, extra] = roomValue.split(",");
  if (
    extra !== undefined ||
    roomValue.includes("&") ||
    !roomId ||
    !ROOM_KEY_PATTERN.test(roomId) ||
    !roomKey ||
    !ROOM_KEY_PATTERN.test(roomKey)
  ) {
    return null;
  }

  try {
    return decodeBase64Url(roomKey).byteLength === ROOM_KEY_BYTES ? { roomId, roomKey } : null;
  } catch {
    return null;
  }
};

export const parseRoomKeyFromHash = (hash: string) => {
  const roomKey = parseRoomFromHash(hash)?.roomKey;
  if (!roomKey || !ROOM_KEY_PATTERN.test(roomKey)) {
    return null;
  }

  try {
    return decodeBase64Url(roomKey).byteLength === ROOM_KEY_BYTES ? roomKey : null;
  } catch {
    return null;
  }
};

export const createRoomShareUrl = (origin: string, roomId: string, roomKey = generateRoomKey()) =>
  `${origin}/#room=${roomId},${roomKey}`;

export const parseRoomLocation = (location: RoomRouteLocation): ParsedRoomLocation | null => {
  if (location.pathname !== "/") {
    return null;
  }

  const parsedRoom = parseRoomFromHash(location.hash);
  if (!parsedRoom) {
    return null;
  }

  return {
    roomId: parsedRoom.roomId,
    roomKey: parsedRoom.roomKey,
    shareUrl: createRoomShareUrl(location.origin, parsedRoom.roomId, parsedRoom.roomKey),
  };
};

export const parseRoomShareUrl = (shareUrl: string): ParsedRoomLocation | null => {
  try {
    return parseRoomLocation(new URL(shareUrl));
  } catch {
    return null;
  }
};

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

const normalizeRoomBaseUrl = (configuredUrl?: string) => {
  const trimmedUrl = configuredUrl?.trim();
  if (!trimmedUrl) {
    return null;
  }

  return trimmedUrl.replace(/\/+$/, "");
};

export const resolveTabulaRoomBaseUrl = ({
  configuredUrl = import.meta.env.VITE_TABULA_ROOM_URL as string | undefined,
  isDev = import.meta.env.DEV,
  location = window.location,
}: ResolveTabulaRoomUrlOptions = {}) => {
  const configuredBaseUrl = normalizeRoomBaseUrl(configuredUrl);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (!isDev) {
    return null;
  }

  const protocol = location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${location.hostname}:${ROOM_SERVER_PORT}`;
};

export const getTabulaRoomAvailability = (): TabulaRoomAvailability => {
  const baseUrl = resolveTabulaRoomBaseUrl();
  return baseUrl
    ? { available: true, baseUrl, unavailableReason: "" }
    : { available: false, baseUrl: "", unavailableReason: ROOM_UNCONFIGURED_MESSAGE };
};
