import { useRef } from "react";
import {
  type Collaborator,
  type CollabRecoveryEvent,
  type ConnectionStatus,
  type LiveSelection,
} from "../collaboration";
import { getTabulaRoomAvailability } from "../collaboration/collabRoom";
import { createCollaborationSessionStartRequest } from "../collaboration/collabRuntime";
import type { RoomEvent, TextChange } from "@tabula-md/tabula";
import type { WorkspaceFile } from "../workspaceStorage";
import { useCollaborationConnectionRuntime } from "./useCollaborationConnectionRuntime";

type UseCollaborationRoomOptions = {
  activeFile?: WorkspaceFile;
  activeSelection?: LiveSelection;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  identity: Collaborator;
  workspaceDocuments?: readonly { id: string; title: string; text: string; parentId?: string | null }[];
  setFileText: (fileId: string, text: string) => void;
  setFileCollaborationStatus: (
    fileId: string,
    status: ConnectionStatus,
    options?: { collaboratorCount?: number; requireRoom?: boolean },
  ) => void;
  setFileCollaboratorCount: (fileId: string, collaboratorCount: number) => void;
  setFileRecoveryEvent: (
    fileId: string,
    event: { type: CollabRecoveryEvent["type"]; message: string; createdAt: string },
  ) => void;
  startFileCollaborationSession: (
    fileId: string,
    roomId: string,
    shareUrl: string,
  ) => WorkspaceFile | undefined;
  onRemoteTextChange?: (fileId: string, text: string, change?: TextChange) => void;
  onRoomEvent?: (event: RoomEvent) => void;
};

export function useCollaborationRoom({
  activeFile,
  activeSelection,
  getActiveFileSnapshot,
  identity,
  workspaceDocuments,
  setFileText,
  setFileCollaborationStatus,
  setFileCollaboratorCount,
  setFileRecoveryEvent,
  startFileCollaborationSession,
  onRemoteTextChange,
  onRoomEvent,
}: UseCollaborationRoomOptions) {
  const pendingInitialTextRef = useRef<string | undefined>(undefined);
  const roomAvailability = getTabulaRoomAvailability();
  const {
    applyLocalText,
    collaborators,
    connectionStatus,
    publishRoomEvent,
    resetConnection,
    retryConnection,
  } =
    useCollaborationConnectionRuntime({
      activeFile,
      activeSelection,
      identity,
      pendingInitialTextRef,
      workspaceDocuments,
      setFileText,
      setFileCollaborationStatus,
      setFileCollaboratorCount,
      setFileRecoveryEvent,
      onRemoteTextChange,
      onRoomEvent,
    });

  const startSession = () => {
    const sessionFile = getActiveFileSnapshot?.() ?? activeFile;
    const nextSession = createCollaborationSessionStartRequest({
      activeFile: sessionFile,
      origin: window.location.origin,
      roomAvailability,
    });
    if (!sessionFile || !nextSession) {
      return undefined;
    }

    pendingInitialTextRef.current = nextSession.initialText;
    startFileCollaborationSession(sessionFile.id, nextSession.roomId, nextSession.shareUrl);
    return { roomId: nextSession.roomId, shareUrl: nextSession.shareUrl };
  };

  return {
    canStartSession: Boolean(activeFile) && roomAvailability.available,
    collaborators,
    connectionStatus,
    startSessionUnavailableReason: roomAvailability.unavailableReason,
    startSession,
    applyLocalText,
    publishRoomEvent,
    resetCollaborationState: resetConnection,
    retryConnection,
  };
}
