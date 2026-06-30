import { useEffect, useRef, useState } from "react";
import {
  type Collaborator,
  type CollabConnection,
  type CollabRecoveryEvent,
  type ConnectionStatus,
  type LiveSelection,
  createRoomSession,
  createCollabConnection,
  getTabulaRoomAvailability,
} from "../collab";
import {
  canStartCollaborationSession,
  getDisconnectedStatusPatch,
  getIdleStatusPatch,
  getLiveRoomConnectionTarget,
  getRecoveryEventPatch,
  getRoomMetaPatch,
} from "../collabRuntime";
import type { TextChange, TextPatch } from "../textPatches";
import { isUsableLiveRoomFile, type WorkspaceFile } from "../workspaceStorage";

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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    isUsableLiveRoomFile(activeFile) ? "connecting" : "idle",
  );
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const collabRef = useRef<CollabConnection | null>(null);
  const pendingInitialTextRef = useRef<string | undefined>(undefined);
  const isLive = isUsableLiveRoomFile(activeFile);
  const roomAvailability = getTabulaRoomAvailability();

  useEffect(() => {
    collabRef.current?.disconnect();
    collabRef.current = null;
    setCollaborators([]);

    const target = getLiveRoomConnectionTarget(activeFile);

    if (!target) {
      setConnectionStatus("idle");
      if (activeFile?.id) {
        setFileCollaborationStatus(activeFile.id, "idle", getIdleStatusPatch());
      }
      return;
    }

    const pendingInitialText = pendingInitialTextRef.current;
    pendingInitialTextRef.current = undefined;
    setConnectionStatus("connecting");
    setFileCollaborationStatus(target.fileId, "connecting");

    collabRef.current = createCollabConnection({
      roomId: target.roomId,
      roomKey: target.roomKey,
      initialText: pendingInitialText,
      identity,
      fileTitle: target.fileTitle,
      selection: activeSelection,
      onTextChange: (nextText, change) => {
        onRemoteTextChange?.(target.fileId, nextText, change);
        setFileText(target.fileId, nextText);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
        setFileCollaborationStatus(target.fileId, status);
      },
      onCollaboratorsChange: (nextCollaborators) => {
        setCollaborators(nextCollaborators);
        setFileCollaboratorCount(target.fileId, nextCollaborators.length);
      },
      onRoomMetaChange: (meta) => {
        setFileRoomMeta(target.fileId, getRoomMetaPatch(meta));
      },
      onRecoveryEvent: (event) => {
        setFileRecoveryEvent(target.fileId, getRecoveryEventPatch(event));
      },
    });

    return () => {
      collabRef.current?.disconnect();
      collabRef.current = null;
      setFileCollaborationStatus(target.fileId, "offline", getDisconnectedStatusPatch());
    };
  }, [
    activeFile?.id,
    activeFile?.roomId,
    activeFile?.shareUrl,
    activeFile?.title,
    setFileCollaborationStatus,
    setFileCollaboratorCount,
    setFileRecoveryEvent,
    setFileRoomMeta,
    setFileText,
    onRemoteTextChange,
  ]);

  useEffect(() => {
    collabRef.current?.setIdentity(identity);
  }, [identity]);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    collabRef.current?.setPresence({
      fileTitle: activeFile?.title ?? "Untitled.md",
      selection: activeSelection,
    });
  }, [activeFile?.title, activeSelection, isLive]);

  const startSession = () => {
    const sessionFile = activeFile;
    if (!canStartCollaborationSession({ activeFile: sessionFile, roomAvailability }) || !sessionFile) {
      return undefined;
    }

    const nextSession = createRoomSession(window.location.origin);
    pendingInitialTextRef.current = sessionFile.text;
    startFileCollaborationSession(sessionFile.id, nextSession.roomId, nextSession.shareUrl);
    setConnectionStatus("connecting");
    return { roomId: nextSession.roomId, shareUrl: nextSession.shareUrl };
  };

  const applyLocalText = (nextText: string, patches?: readonly TextPatch[]) => {
    collabRef.current?.applyLocalText(nextText, patches);
  };

  const resetCollaborationState = (nextStatus: ConnectionStatus = "idle") => {
    collabRef.current?.disconnect();
    collabRef.current = null;
    setCollaborators([]);
    setConnectionStatus(nextStatus);
  };

  return {
    canStartSession: Boolean(activeFile) && roomAvailability.available,
    collaborators,
    connectionStatus,
    startSessionUnavailableReason: roomAvailability.unavailableReason,
    startSession,
    applyLocalText,
    resetCollaborationState,
  };
}
