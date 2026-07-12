import type { Extension } from "@codemirror/state";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import type {
  RoomActorClient,
  RoomActorKind,
  RoomCapability,
} from "@tabula-md/tabula";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

export type LiveSelection = {
  documentId?: string;
  from: number;
  to: number;
  columnNumber?: number;
  fromLineNumber?: number;
  lineNumber?: number;
  selectionEndsWithLineBreak?: boolean;
  toLineNumber?: number;
};

export type Collaborator = {
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
  selection?: LiveSelection;
};

export type CollabRecoveryEvent = {
  id: string;
  type: "reconnected" | "invalid-message";
  message: string;
  createdAt: string;
};

export type CollabEditorBinding = {
  documentId: string;
  extension: Extension;
  yText: Y.Text;
  awareness: Awareness;
  undoManager: Y.UndoManager;
  canApplyTextByteDelta: (byteDelta: number) => boolean;
  consumeRemoteProjection?: () => boolean;
};

export type WorkspaceRoomRuntimeSnapshot = {
  status: ConnectionStatus;
  collaborators: Collaborator[];
  editorBinding: CollabEditorBinding | null;
};

export type WorkspaceRoomChangeOrigin = {
  actorId: string;
  actorName?: string;
};

export type WorkspaceDocumentSnapshot = {
  id: string;
  title: string;
  text: string;
  parentId?: string | null;
  order?: number;
};

export type WorkspaceFolderSnapshot = {
  id: string;
  title: string;
  parentId: string | null;
  order?: number;
};
