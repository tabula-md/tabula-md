import type {
  RoomActorClient,
  RoomActorKind,
  RoomCapability,
} from "./roomCollaboration";

export type CollaborationConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

export type CollaborationLiveSelection = {
  documentId?: string;
  from: number;
  to: number;
  columnNumber?: number;
  fromLineNumber?: number;
  lineNumber?: number;
  selectionEndsWithLineBreak?: boolean;
  toLineNumber?: number;
};

export type CollaborationCollaborator = {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
  activeDocumentId?: string;
  kind?: RoomActorKind;
  client?: RoomActorClient;
  capabilities?: RoomCapability[];
  joinedAt?: string;
  roomId?: string;
  fileTitle?: string;
  selection?: CollaborationLiveSelection;
};
