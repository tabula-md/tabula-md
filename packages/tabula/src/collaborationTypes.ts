export type CollaborationConnectionStatus = "idle" | "connecting" | "connected" | "offline";

export type CollaborationLiveSelection = {
  from: number;
  to: number;
};

export type CollaborationCollaborator = {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
  roomId?: string;
  fileTitle?: string;
  selection?: CollaborationLiveSelection;
};

export type CollaborationRoomSnapshot = {
  id: string;
  createdAt: string;
  textLength: number;
  updateSize: number;
  version: number;
};

export type CollaborationRoomMeta = {
  roomId: string;
  version: number;
  snapshotCount: number;
  lastSavedAt?: string;
  lastUpdatedAt?: string;
  snapshots: CollaborationRoomSnapshot[];
};
