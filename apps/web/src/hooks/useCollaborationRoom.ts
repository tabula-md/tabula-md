import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
  setFiles: Dispatch<SetStateAction<MarkdownFile[]>>;
};

const createShareUrl = (roomId: string) => {
  return createRoomShareUrl(window.location.origin, roomId);
};

export function useCollaborationRoom({ activeFile, activeSelection, identity, setFiles }: UseCollaborationRoomOptions) {
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
      setFiles((currentFiles) =>
        currentFiles.map((file) =>
          file.id === activeFile?.id ? { ...file, connectionStatus: "idle", collaboratorCount: 0 } : file,
        ),
      );
      return;
    }

    const pendingInitialText = pendingInitialTextRef.current;
    const connectedFileId = activeFile.id;
    const connectedRoomId = activeFile.roomId;
    pendingInitialTextRef.current = undefined;
    setConnectionStatus("connecting");
    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.id === connectedFileId ? { ...file, connectionStatus: "connecting" } : file,
      ),
    );

    collabRef.current = createCollabConnection({
      roomId: connectedRoomId,
      initialText: pendingInitialText,
      identity,
      fileTitle: activeFile.title,
      selection: activeSelection,
      onTextChange: (nextText) => {
        setFiles((currentFiles) =>
          currentFiles.map((file) => (file.id === connectedFileId ? { ...file, text: nextText } : file)),
        );
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
        setFiles((currentFiles) =>
          currentFiles.map((file) => (file.id === connectedFileId ? { ...file, connectionStatus: status } : file)),
        );
      },
      onCollaboratorsChange: (nextCollaborators) => {
        setCollaborators(nextCollaborators);
        setFiles((currentFiles) =>
          currentFiles.map((file) =>
            file.id === connectedFileId ? { ...file, collaboratorCount: nextCollaborators.length } : file,
          ),
        );
      },
      onRoomMetaChange: (meta: RoomMeta) => {
        const latestSnapshot = meta.snapshots[0];
        setFiles((currentFiles) =>
          currentFiles.map((file) =>
            file.id === connectedFileId
              ? {
                  ...file,
                  snapshotCount: meta.snapshotCount,
                  lastSnapshotAt: latestSnapshot?.createdAt ?? meta.lastSavedAt,
                }
              : file,
          ),
        );
      },
      onRecoveryEvent: (event: CollabRecoveryEvent) => {
        setFiles((currentFiles) =>
          currentFiles.map((file) =>
            file.id === connectedFileId
              ? {
                  ...file,
                  lastRecoveryMessage: event.message,
                  lastRecoveryAt: event.createdAt,
                }
              : file,
          ),
        );
      },
    });

    return () => {
      collabRef.current?.disconnect();
      collabRef.current = null;
      setFiles((currentFiles) =>
        currentFiles.map((file) =>
          file.id === connectedFileId && file.roomId
            ? { ...file, connectionStatus: "offline", collaboratorCount: 0 }
            : file,
        ),
      );
    };
  }, [activeFile?.id, activeFile?.roomId, activeFile?.title, setFiles]);

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
    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.id === activeFile.id
          ? {
              ...file,
              roomId: nextRoomId,
              shareUrl: nextShareUrl,
              connectionStatus: "connecting",
              snapshotCount: 0,
              lastSnapshotAt: undefined,
              lastRecoveryMessage: undefined,
              lastRecoveryAt: undefined,
            }
          : file,
      ),
    );
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
