import { useRef } from "react";
import {
  type Collaborator,
  type CollabRecoveryEvent,
} from "../collaboration";
import { getTabulaRoomAvailability } from "../collaboration/collabRoom";
import { createCollaborationSessionStartRequest } from "../collaboration/collabRuntime";
import {
  getRoomCheckpointAvailability,
  persistInitialWorkspaceRoomCheckpoint,
} from "../collaboration/roomCheckpointStore";
import {
  WORKSPACE_ROOM_ROOT_ID,
  WORKSPACE_ROOM_SCHEMA_VERSION,
  validateWorkspaceRoomLimits,
  type WorkspaceRoomComment,
} from "@tabula-md/tabula";
import type {
  WorkspaceFolderSnapshot,
} from "../collaboration/liveCollaboration";
import type { WorkspaceFile } from "../workspaceStorage";
import type { RoomWorkspaceSession } from "../workspace/session/WorkspaceSession";
import { useCollaborationConnectionRuntime } from "./useCollaborationConnectionRuntime";

export const validateCollaborationStartWorkspace = ({
  documents,
  folders,
  commentsByFileId = {},
}: {
  documents: readonly { id: string; title: string; text: string; parentId?: string | null; order?: number }[];
  folders: readonly WorkspaceFolderSnapshot[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
}) => validateWorkspaceRoomLimits({
  roomId: "preflight",
  schemaVersion: WORKSPACE_ROOM_SCHEMA_VERSION,
  rootId: WORKSPACE_ROOM_ROOT_ID,
  nodes: [
    {
      id: WORKSPACE_ROOM_ROOT_ID,
      type: "folder",
      parentId: null,
      title: "Workspace",
      order: 0,
      createdAt: "",
      updatedAt: "",
    },
    ...folders
      .filter((folder) => folder.id !== WORKSPACE_ROOM_ROOT_ID)
      .map((folder) => ({
        id: folder.id,
        type: "folder" as const,
        parentId: folder.parentId ?? WORKSPACE_ROOM_ROOT_ID,
        title: folder.title,
        order: folder.order ?? 0,
        createdAt: "",
        updatedAt: "",
      })),
    ...documents.map((document) => ({
      id: document.id,
      type: "document" as const,
      parentId: document.parentId ?? WORKSPACE_ROOM_ROOT_ID,
      title: document.title,
      order: document.order ?? 0,
      createdAt: "",
      updatedAt: "",
    })),
  ],
  documents: Object.fromEntries(documents.map((document) => [document.id, document.text])),
  commentsByFileId,
});

type UseCollaborationRoomOptions = {
  session?: RoomWorkspaceSession | null;
  activeDocument?: WorkspaceFile;
  editorPresenceEnabled?: boolean;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  identity: Collaborator;
  workspaceDocuments?: readonly { id: string; title: string; text: string; parentId?: string | null }[];
  workspaceFolders?: readonly WorkspaceFolderSnapshot[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
};

export function useCollaborationRoom({
  session,
  activeDocument,
  editorPresenceEnabled,
  getActiveFileSnapshot,
  identity,
  workspaceDocuments,
  workspaceFolders,
  commentsByFileId,
  onRecoveryEvent,
  onOpenFailure,
  onCapacityExceeded,
}: UseCollaborationRoomOptions) {
  const startInFlightRef = useRef(false);
  const roomAvailability = getTabulaRoomAvailability();
  const checkpointAvailability = getRoomCheckpointAvailability();
  const startValidation = validateCollaborationStartWorkspace({
    documents: workspaceDocuments ?? [],
    folders: workspaceFolders ?? [],
    commentsByFileId,
  });
  const {
    applyLocalText,
    activeDocumentText,
    activeDocumentComments,
    createDocument,
    createFolder,
    renameNode,
    moveNode,
    setNodeOrder,
    deleteNode,
    replaceDocumentText,
    setFollowingActor,
    setViewport,
    collaborators,
    connectionStatus,
    durability,
    editorBinding,
    materializeWorkspace,
    materializeDocument,
    materializeDocumentComments,
    structureSnapshot,
    upsertComment,
    deleteComment,
    setCommentResolved,
    addCommentReply,
    resetConnection,
    retryConnection,
  } =
    useCollaborationConnectionRuntime({
      session,
      activeDocument,
      editorPresenceEnabled,
      identity,
      onRecoveryEvent,
      onOpenFailure,
      onCapacityExceeded,
    });

  const startSession = async () => {
    if (startInFlightRef.current) return undefined;
    if (!startValidation.ok) return undefined;
    const sessionFile = getActiveFileSnapshot?.() ?? activeDocument;
    const nextSession = createCollaborationSessionStartRequest({
      activeFile: sessionFile,
      origin: window.location.origin,
      roomAvailability,
    });
    if (!sessionFile || !nextSession) {
      return undefined;
    }

    startInFlightRef.current = true;
    try {
      const documents = (workspaceDocuments ?? []).map((document) =>
        document.id === sessionFile.id
          ? { ...document, text: sessionFile.text }
          : document,
      );
      await persistInitialWorkspaceRoomCheckpoint({
        roomId: nextSession.roomId,
        roomKey: nextSession.roomKey,
        documents,
        folders: workspaceFolders ?? [],
        commentsByFileId,
      });
      return { fileId: sessionFile.id, roomId: nextSession.roomId, shareUrl: nextSession.shareUrl };
    } finally {
      startInFlightRef.current = false;
    }
  };

  return {
    canStartSession:
      Boolean(activeDocument) &&
      roomAvailability.available &&
      checkpointAvailability.available &&
      startValidation.ok,
    collaborators,
    connectionStatus,
    durability,
    startSessionUnavailableReason: !startValidation.ok
      ? startValidation.message
      : roomAvailability.unavailableReason || checkpointAvailability.unavailableReason,
    startSession,
    applyLocalText,
    activeDocumentText,
    activeDocumentComments,
    createDocument,
    createFolder,
    renameNode,
    moveNode,
    setNodeOrder,
    deleteNode,
    replaceDocumentText,
    setFollowingActor,
    setViewport,
    editorBinding,
    materializeWorkspace,
    materializeDocument,
    materializeDocumentComments,
    structureSnapshot,
    upsertComment,
    deleteComment,
    setCommentResolved,
    addCommentReply,
    resetCollaborationState: resetConnection,
    retryConnection,
  };
}
