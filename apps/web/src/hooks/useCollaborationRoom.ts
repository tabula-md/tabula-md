import { useEffect, useRef, useState } from "react";
import {
  type Collaborator,
  type CollabConnection,
  type CollabRecoveryEvent,
  type ConnectionStatus,
  type LiveSelection,
  type RoomMeta,
  createRoomShareUrl,
  createCollabConnection,
} from "../collab";
import { randomId, syncUrlForFile, type MarkdownFile } from "../workspaceStorage";

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
};

const createShareUrl = (roomId: string) => {
  return createRoomShareUrl(window.location.origin, roomId);
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
}: UseCollaborationRoomOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    activeFile?.roomId ? "connecting" : "idle",
  );
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const collabRef = useRef<CollabConnection | null>(null);
  const pendingInitialTextRef = useRef<string | undefined>(undefined);
  const isLive = Boolean(activeFile?.roomId);

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
    pendingInitialTextRef.current = undefined;
    setConnectionStatus("connecting");
    setFileCollaborationStatus(connectedFileId, "connecting");

    collabRef.current = createCollabConnection({
      roomId: connectedRoomId,
      initialText: pendingInitialText,
      identity,
      fileTitle: activeFile.title,
      selection: activeSelection,
      onTextChange: (nextText) => {
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
    activeFile?.title,
    setFileCollaborationStatus,
    setFileCollaboratorCount,
    setFileRecoveryEvent,
    setFileRoomMeta,
    setFileText,
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
    if (!activeFile) {
      return undefined;
    }

    const nextRoomId = randomId();
    const nextShareUrl = createShareUrl(nextRoomId);
    pendingInitialTextRef.current = activeFile.text;
    syncUrlForFile({ roomId: nextRoomId, shareUrl: nextShareUrl });
    startFileCollaborationSession(activeFile.id, nextRoomId, nextShareUrl);
    setConnectionStatus("connecting");
    return { roomId: nextRoomId, shareUrl: nextShareUrl };
  };

  const applyLocalText = (nextText: string) => {
    collabRef.current?.applyLocalText(nextText);
  };

  const resetCollaborationState = (nextStatus: ConnectionStatus = "idle") => {
    collabRef.current?.disconnect();
    collabRef.current = null;
    setCollaborators([]);
    setConnectionStatus(nextStatus);
  };

  return {
    collaborators,
    connectionStatus,
    startSession,
    applyLocalText,
    resetCollaborationState,
  };
}
