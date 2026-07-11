import { useRef } from "react";
import {
  type Collaborator,
  type CollabRecoveryEvent,
  type ConnectionStatus,
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
  type WorkspaceRoomSnapshot,
} from "@tabula-md/tabula";
import type {
  WorkspaceFolderSnapshot,
  WorkspaceRoomChangeOrigin,
} from "../collaboration/liveCollaboration";
import type { WorkspaceFile } from "../workspaceStorage";
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
  roomFile?: WorkspaceFile;
  activeDocument?: WorkspaceFile;
  editorPresenceEnabled?: boolean;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  identity: Collaborator;
  workspaceDocuments?: readonly { id: string; title: string; text: string; parentId?: string | null }[];
  workspaceFolders?: readonly WorkspaceFolderSnapshot[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
  setFileText: (fileId: string, text: string) => void;
  setFileCollaborationStatus: (
    fileId: string,
    status: ConnectionStatus,
    options?: { requireRoom?: boolean },
  ) => void;
  setFileRecoveryEvent: (
    fileId: string,
    event: { type: CollabRecoveryEvent["type"]; message: string; createdAt: string },
  ) => void;
  startFileCollaborationSession: (
    fileId: string,
    roomId: string,
    shareUrl: string,
  ) => WorkspaceFile | undefined;
  onRemoteTextChange?: (fileId: string, text: string) => void;
  onCommentsChange?: (commentsByFileId: Record<string, WorkspaceRoomComment[]>) => void;
  onWorkspaceChange?: (snapshot: WorkspaceRoomSnapshot, origin?: WorkspaceRoomChangeOrigin) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
};

export function useCollaborationRoom({
  roomFile,
  activeDocument,
  editorPresenceEnabled,
  getActiveFileSnapshot,
  identity,
  workspaceDocuments,
  workspaceFolders,
  commentsByFileId,
  setFileText,
  setFileCollaborationStatus,
  setFileRecoveryEvent,
  startFileCollaborationSession,
  onRemoteTextChange,
  onCommentsChange,
  onWorkspaceChange,
  onOpenFailure,
  onCapacityExceeded,
}: UseCollaborationRoomOptions) {
  const pendingRoomStartRef = useRef(false);
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
    collaborators,
    connectionStatus,
    editorBinding,
    upsertComment,
    deleteComment,
    setCommentResolved,
    addCommentReply,
    resetConnection,
    retryConnection,
  } =
    useCollaborationConnectionRuntime({
      roomFile,
      activeDocument,
      editorPresenceEnabled,
      identity,
      pendingRoomStartRef,
      workspaceDocuments,
      workspaceFolders,
      commentsByFileId,
      setFileText,
      setFileCollaborationStatus,
      setFileRecoveryEvent,
      onRemoteTextChange,
      onCommentsChange,
      onWorkspaceChange,
      onOpenFailure,
      onCapacityExceeded,
    });

  const startSession = async () => {
    if (startInFlightRef.current) return undefined;
    if (!startValidation.ok) return undefined;
    const sessionFile = getActiveFileSnapshot?.() ?? roomFile;
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
      pendingRoomStartRef.current = true;
      startFileCollaborationSession(sessionFile.id, nextSession.roomId, nextSession.shareUrl);
      return { fileId: sessionFile.id, roomId: nextSession.roomId, shareUrl: nextSession.shareUrl };
    } finally {
      startInFlightRef.current = false;
    }
  };

  return {
    canStartSession:
      Boolean(roomFile) &&
      roomAvailability.available &&
      checkpointAvailability.available &&
      startValidation.ok,
    collaborators,
    connectionStatus,
    startSessionUnavailableReason: !startValidation.ok
      ? startValidation.message
      : roomAvailability.unavailableReason || checkpointAvailability.unavailableReason,
    startSession,
    applyLocalText,
    editorBinding,
    upsertComment,
    deleteComment,
    setCommentResolved,
    addCommentReply,
    resetCollaborationState: resetConnection,
    retryConnection,
  };
}
