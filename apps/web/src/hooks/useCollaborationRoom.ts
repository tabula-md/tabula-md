import { useRef } from "react";
import {
  type Collaborator,
  type CollabRecoveryEvent,
  type ConnectionStatus,
  type LiveSelection,
  getTabulaRoomAvailability,
} from "../collab";
import { createCollaborationSessionStartRequest } from "../collabRuntime";
import type { TextChange } from "../textPatches";
import type { WorkspaceFile } from "../workspaceStorage";
import { useCollaborationConnectionRuntime } from "./useCollaborationConnectionRuntime";

type UseCollaborationRoomOptions = {
  activeFile?: WorkspaceFile;
  activeSelection?: LiveSelection;
  identity: Collaborator;
  setFileText: (fileId: string, text: string) => void;
  setFileCollaborationStatus: (
    fileId: string,
    status: ConnectionStatus,
    options?: { collaboratorCount?: number; requireRoom?: boolean },
  ) => void;
  setFileCollaboratorCount: (fileId: string, collaboratorCount: number) => void;
  setFileRoomMeta: (fileId: string, meta: { snapshotCount: number; lastSnapshotAt?: string }) => void;
  setFileRecoveryEvent: (
    fileId: string,
    event: { type: CollabRecoveryEvent["type"]; message: string; createdAt: string },
  ) => void;
  startFileCollaborationSession: (fileId: string, roomId: string, shareUrl: string) => WorkspaceFile | undefined;
  onRemoteTextChange?: (fileId: string, text: string, change?: TextChange) => void;
};

export function useCollaborationRoom({
  activeFile,
  activeSelection,
  identity,
  setFileText,
  setFileCollaborationStatus,
  setFileCollaboratorCount,
  setFileRoomMeta,
  setFileRecoveryEvent,
  startFileCollaborationSession,
  onRemoteTextChange,
}: UseCollaborationRoomOptions) {
  const pendingInitialTextRef = useRef<string | undefined>(undefined);
  const roomAvailability = getTabulaRoomAvailability();
  const { applyLocalText, collaborators, connectionStatus, resetConnection } =
    useCollaborationConnectionRuntime({
      activeFile,
      activeSelection,
      identity,
      pendingInitialTextRef,
      setFileText,
      setFileCollaborationStatus,
      setFileCollaboratorCount,
      setFileRoomMeta,
      setFileRecoveryEvent,
      onRemoteTextChange,
    });

  const startSession = () => {
    const sessionFile = activeFile;
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
    resetCollaborationState: resetConnection,
  };
}
