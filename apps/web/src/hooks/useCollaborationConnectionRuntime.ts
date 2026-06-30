import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  createCollabConnection,
  type Collaborator,
  type CollabConnection,
  type CollabRecoveryEvent,
  type ConnectionStatus,
  type LiveSelection,
} from "../collaboration";
import {
  getDisconnectedStatusPatch,
  getIdleStatusPatch,
  getInitialCollaborationStatus,
  getLiveRoomConnectionTarget,
  getRecoveryEventPatch,
  getRoomMetaPatch,
} from "../collaboration";
import type { TextChange, TextPatch } from "../textPatches";
import { isUsableLiveRoomFile, type WorkspaceFile } from "../workspaceStorage";

type UseCollaborationConnectionRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeSelection?: LiveSelection;
  identity: Collaborator;
  pendingInitialTextRef: MutableRefObject<string | undefined>;
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
  onRemoteTextChange?: (fileId: string, text: string, change?: TextChange) => void;
};

export function useCollaborationConnectionRuntime({
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
}: UseCollaborationConnectionRuntimeOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    getInitialCollaborationStatus(activeFile),
  );
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const collabRef = useRef<CollabConnection | null>(null);
  const isLive = isUsableLiveRoomFile(activeFile);

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

  const applyLocalText = useCallback((nextText: string, patches?: readonly TextPatch[]) => {
    collabRef.current?.applyLocalText(nextText, patches);
  }, []);

  const resetConnection = useCallback((nextStatus: ConnectionStatus = "idle") => {
    collabRef.current?.disconnect();
    collabRef.current = null;
    setCollaborators([]);
    setConnectionStatus(nextStatus);
  }, []);

  return {
    applyLocalText,
    collaborators,
    connectionStatus,
    resetConnection,
  };
}
