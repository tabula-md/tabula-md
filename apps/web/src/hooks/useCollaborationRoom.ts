import { useEffect, useRef, useState } from "react";
import {
  type Collaborator,
  type CollabConnection,
  type CollabRecoveryEvent,
  type ConnectionStatus,
  type LiveSelection,
  type RoomMeta,
  createRoomSession,
  createCollabConnection,
  getTabulaRoomAvailability,
  parseRoomShareUrl,
} from "../collab";
import type { TextChange, TextPatch } from "../textPatches";
import type { MarkdownFile } from "../workspaceStorage";

type UseCollaborationRoomOptions = {
  activeFile?: MarkdownFile;
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
  startFileCollaborationSession: (fileId: string, roomId: string, shareUrl: string) => MarkdownFile | undefined;
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
    activeFile?.roomId ? "connecting" : "idle",
  );
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const collabRef = useRef<CollabConnection | null>(null);
  const pendingInitialTextRef = useRef<string | undefined>(undefined);
  const isLive = Boolean(activeFile?.roomId);
  const roomAvailability = getTabulaRoomAvailability();

  useEffect(() => {
    collabRef.current?.disconnect();
    collabRef.current = null;
    setCollaborators([]);

    if (!activeFile?.roomId) {
      setConnectionStatus("idle");
      if (activeFile?.id) {
        setFileCollaborationStatus(activeFile.id, "idle", { collaboratorCount: 0 });
      }
      return;
    }

    const pendingInitialText = pendingInitialTextRef.current;
    const connectedFileId = activeFile.id;
    const connectedRoomId = activeFile.roomId;
    const roomFromShareUrl = activeFile.shareUrl ? parseRoomShareUrl(activeFile.shareUrl) : null;
    pendingInitialTextRef.current = undefined;
    setConnectionStatus("connecting");
    setFileCollaborationStatus(connectedFileId, "connecting");

    if (!roomFromShareUrl || roomFromShareUrl.roomId !== connectedRoomId) {
      const message = "This live file is missing its client-only room key.";
      setConnectionStatus("offline");
      setFileCollaborationStatus(connectedFileId, "offline");
      setFileRecoveryEvent(connectedFileId, {
        type: "invalid-message",
        message,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    collabRef.current = createCollabConnection({
      roomId: connectedRoomId,
      roomKey: roomFromShareUrl.roomKey,
      initialText: pendingInitialText,
      identity,
      fileTitle: activeFile.title,
      selection: activeSelection,
      onTextChange: (nextText, change) => {
        onRemoteTextChange?.(connectedFileId, nextText, change);
        setFileText(connectedFileId, nextText);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
        setFileCollaborationStatus(connectedFileId, status);
      },
      onCollaboratorsChange: (nextCollaborators) => {
        setCollaborators(nextCollaborators);
        setFileCollaboratorCount(connectedFileId, nextCollaborators.length);
      },
      onRoomMetaChange: (meta: RoomMeta) => {
        const latestSnapshot = meta.snapshots[0];
        setFileRoomMeta(connectedFileId, {
          snapshotCount: meta.snapshotCount,
          lastSnapshotAt: latestSnapshot?.createdAt ?? meta.lastSavedAt,
        });
      },
      onRecoveryEvent: (event: CollabRecoveryEvent) => {
        setFileRecoveryEvent(connectedFileId, {
          type: event.type,
          message: event.message,
          createdAt: event.createdAt,
        });
      },
    });

    return () => {
      collabRef.current?.disconnect();
      collabRef.current = null;
      setFileCollaborationStatus(connectedFileId, "offline", {
        collaboratorCount: 0,
        requireRoom: true,
      });
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
    if (!activeFile || !roomAvailability.available) {
      return undefined;
    }

    const nextSession = createRoomSession(window.location.origin);
    pendingInitialTextRef.current = activeFile.text;
    startFileCollaborationSession(activeFile.id, nextSession.roomId, nextSession.shareUrl);
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
