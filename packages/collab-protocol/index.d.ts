export type ConnectionStatus = "idle" | "connecting" | "connected" | "offline";

export type LiveSelection = {
  from: number;
  to: number;
};

export type Collaborator = {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
  fileTitle?: string;
  selection?: LiveSelection;
};

export type RoomSnapshot = {
  id: string;
  createdAt: string;
  textLength: number;
  updateSize: number;
  version: number;
};

export type RoomMeta = {
  roomId: string;
  version: number;
  snapshotCount: number;
  lastSavedAt?: string;
  lastUpdatedAt?: string;
  snapshots: RoomSnapshot[];
};

export type CollabRecoveryEvent = {
  id: string;
  type: "reconnected" | "resynced" | "invalid-message";
  message: string;
  createdAt: string;
};

export type RoomTokenRole = "write" | "read";

export type RoomTokenPayload = {
  v: 1;
  iss: "tabula-collab";
  roomId: string;
  userId: string;
  role: RoomTokenRole;
  iat: number;
  exp: number;
};

export type RoomTokenRequest = {
  roomId: string;
  userId: string;
  role?: RoomTokenRole;
};

export type RoomTokenResponse = {
  token: string;
  payload: RoomTokenPayload;
};

export declare const COLLAB_MESSAGE_TYPE: Readonly<{
  SYNC: 0;
  AWARENESS: 1;
  ROOM_META: 2;
}>;

export declare const DEFAULT_COLLAB_WS_PORT: "1234";

export declare const createCollabRoomPath: (roomId: string) => string;
export declare const createCollabSnapshotsPath: (roomId: string) => string;
export declare const createCollabTokenPath: () => "/collab/token";
export declare const matchCollabRoomPath: (pathname: string) => string | null;
export declare const matchCollabTokenPath: (pathname: string) => boolean;
export declare const matchCollabSnapshotsPath: (pathname: string) => string | null;
export declare const sanitizeRoomId: (roomId: string) => string;
export declare const encodeCollabMessage: (type: number, payload: Uint8Array) => Uint8Array;
