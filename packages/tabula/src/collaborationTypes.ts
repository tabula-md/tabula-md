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
  | "suspended"
  | "disconnected"
  | "failed";

export type RoomPresenceState = "active" | "idle" | "away";

export const readRoomPresenceState = (value: unknown): RoomPresenceState =>
  value === "idle" || value === "away" ? value : "active";

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
  presenceState?: RoomPresenceState;
  activeDocumentId?: string;
  kind?: RoomActorKind;
  client?: RoomActorClient;
  capabilities?: RoomCapability[];
  joinedAt?: string;
  roomId?: string;
  fileTitle?: string;
  selection?: CollaborationLiveSelection;
};
