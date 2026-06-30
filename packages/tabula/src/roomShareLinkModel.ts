import { decodeBase64Url } from "./jsonShareLinkModel";

export type RoomRouteLocation = {
  hash: string;
  origin: string;
  pathname: string;
};

export type RoomSession = {
  roomId: string;
  roomKey: string;
  shareUrl: string;
};

export type ParsedRoomLocation = RoomSession;

export const ROOM_ID_BYTES = 16;
export const ROOM_KEY_BYTES = 32;
export const ROOM_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

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

export const createRoomShareUrl = (origin: string, roomId: string, roomKey: string) =>
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
