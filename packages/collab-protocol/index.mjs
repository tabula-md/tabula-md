export const COLLAB_MESSAGE_TYPE = Object.freeze({
  SYNC: 0,
  AWARENESS: 1,
  ROOM_META: 2,
});

export const DEFAULT_COLLAB_WS_PORT = "1234";

export const createCollabRoomPath = (roomId) => `/collab/${encodeURIComponent(roomId)}`;

export const createCollabSnapshotsPath = (roomId) => `${createCollabRoomPath(roomId)}/snapshots`;

export const createCollabTokenPath = () => "/collab/token";

export const matchCollabRoomPath = (pathname) => {
  const match = pathname.match(/^\/collab\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const matchCollabTokenPath = (pathname) => pathname === createCollabTokenPath();

export const matchCollabSnapshotsPath = (pathname) => {
  const match = pathname.match(/^\/collab\/([^/]+)\/snapshots$/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const sanitizeRoomId = (roomId) => roomId.replace(/[^a-zA-Z0-9_-]/g, "_");

export const encodeCollabMessage = (type, payload) => {
  const message = new Uint8Array(payload.length + 1);
  message[0] = type;
  message.set(payload, 1);
  return message;
};
