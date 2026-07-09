import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { CollabConnection } from "../collaboration/liveCollaboration";
import type {
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
  LiveSelection,
} from "../collaboration";
import {
  getDisconnectedStatusPatch,
  getIdleStatusPatch,
  getInitialCollaborationStatus,
  getLiveRoomConnectionTarget,
  getRecoveryEventPatch,
  getRoomMetaPatch,
  shouldStartLiveRoomConnection,
} from "../collaboration/collabRuntime";
import type { TextChange, TextPatch } from "@tabula-md/tabula";
import { isUsableLiveRoomFile, type WorkspaceFile } from "../workspaceStorage";

const REMOTE_WORKSPACE_COMMIT_DELAY_MS = 80;

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
  const remoteWorkspaceCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRemoteWorkspaceCommitRef = useRef<{ fileId: string; text: string } | null>(null);
  const pendingLocalTextRef = useRef<
    { text: string; patches?: readonly TextPatch[] } | { docLength?: number; patches: readonly TextPatch[] } | null
  >(null);
  const isLive = isUsableLiveRoomFile(activeFile);

  const clearRemoteWorkspaceCommitTimer = useCallback(() => {
    if (remoteWorkspaceCommitTimerRef.current !== null) {
      clearTimeout(remoteWorkspaceCommitTimerRef.current);
      remoteWorkspaceCommitTimerRef.current = null;
    }
  }, []);

  const flushRemoteWorkspaceCommit = useCallback(() => {
    clearRemoteWorkspaceCommitTimer();
    const pendingCommit = pendingRemoteWorkspaceCommitRef.current;
    pendingRemoteWorkspaceCommitRef.current = null;
    if (pendingCommit) {
      setFileText(pendingCommit.fileId, pendingCommit.text);
    }
  }, [clearRemoteWorkspaceCommitTimer, setFileText]);

  const discardRemoteWorkspaceCommit = useCallback(() => {
    clearRemoteWorkspaceCommitTimer();
    pendingRemoteWorkspaceCommitRef.current = null;
  }, [clearRemoteWorkspaceCommitTimer]);

  const scheduleRemoteWorkspaceCommit = useCallback((fileId: string, text: string) => {
    pendingRemoteWorkspaceCommitRef.current = { fileId, text };
    clearRemoteWorkspaceCommitTimer();
    remoteWorkspaceCommitTimerRef.current = setTimeout(
      flushRemoteWorkspaceCommit,
      REMOTE_WORKSPACE_COMMIT_DELAY_MS,
    );
  }, [clearRemoteWorkspaceCommitTimer, flushRemoteWorkspaceCommit]);

  useEffect(() => {
    window.addEventListener("pagehide", flushRemoteWorkspaceCommit);
    return () => window.removeEventListener("pagehide", flushRemoteWorkspaceCommit);
  }, [flushRemoteWorkspaceCommit]);

  useEffect(() => {
    const flushRecoveryState = () => collabRef.current?.flushRecoveryState();
    window.addEventListener("pagehide", flushRecoveryState);
    return () => window.removeEventListener("pagehide", flushRecoveryState);
  }, []);

  useEffect(() => {
    flushRemoteWorkspaceCommit();
    collabRef.current?.disconnect();
    collabRef.current = null;
    pendingLocalTextRef.current = null;
    setCollaborators([]);

    const target = getLiveRoomConnectionTarget(activeFile);
    const pendingInitialText = pendingInitialTextRef.current;

    if (
      !target ||
      !shouldStartLiveRoomConnection({
        file: activeFile,
        hasPendingInitialText: pendingInitialText !== undefined,
      })
    ) {
      pendingInitialTextRef.current = undefined;
      const nextStatus = target ? "disconnected" : "idle";
      setConnectionStatus(nextStatus);
      if (activeFile?.id) {
        setFileCollaborationStatus(
          activeFile.id,
          nextStatus,
          target ? getDisconnectedStatusPatch() : getIdleStatusPatch(),
        );
      }
      return;
    }

    pendingInitialTextRef.current = undefined;
    setConnectionStatus("connecting");
    setFileCollaborationStatus(target.fileId, "connecting");

    let disposed = false;
    void import("../collaboration/liveCollaboration")
      .then(({ createCollabConnection }) => {
        if (disposed) {
          return;
        }

        const connection = createCollabConnection({
          roomId: target.roomId,
          roomKey: target.roomKey,
          initialText: pendingInitialText,
          identity,
          fileTitle: target.fileTitle,
          selection: activeSelection,
          onTextChange: (nextText, change) => {
            onRemoteTextChange?.(target.fileId, nextText, change);
            scheduleRemoteWorkspaceCommit(target.fileId, nextText);
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

        collabRef.current = connection;
        const pendingLocalText = pendingLocalTextRef.current;
        pendingLocalTextRef.current = null;
        if (pendingLocalText) {
          if ("text" in pendingLocalText) {
            connection.applyLocalText(pendingLocalText.text, pendingLocalText.patches);
          } else {
            connection.applyLocalTextPatches(pendingLocalText.patches, pendingLocalText.docLength);
          }
        }
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        setConnectionStatus("failed");
        setFileCollaborationStatus(target.fileId, "failed", getDisconnectedStatusPatch());
      });

    return () => {
      disposed = true;
      flushRemoteWorkspaceCommit();
      collabRef.current?.disconnect();
      collabRef.current = null;
      pendingLocalTextRef.current = null;
      setFileCollaborationStatus(target.fileId, "disconnected", getDisconnectedStatusPatch());
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
    onRemoteTextChange,
    flushRemoteWorkspaceCommit,
    scheduleRemoteWorkspaceCommit,
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

  const applyLocalText = useCallback(
    (nextText: string | null, patches?: readonly TextPatch[], options: { docLength?: number } = {}) => {
      discardRemoteWorkspaceCommit();
      const connection = collabRef.current;
      if (connection) {
        if (nextText === null) {
          if (patches?.length) {
            connection.applyLocalTextPatches(patches, options.docLength);
          }
          return;
        }

        connection.applyLocalText(nextText, patches);
        return;
      }

      if (isLive) {
        pendingLocalTextRef.current =
          nextText === null
            ? patches?.length
              ? { patches, docLength: options.docLength }
              : null
            : { text: nextText, patches };
      }
    },
    [discardRemoteWorkspaceCommit, isLive],
  );

  const resetConnection = useCallback((nextStatus: ConnectionStatus = "idle") => {
    flushRemoteWorkspaceCommit();
    collabRef.current?.disconnect();
    collabRef.current = null;
    pendingLocalTextRef.current = null;
    setCollaborators([]);
    setConnectionStatus(nextStatus);
  }, [flushRemoteWorkspaceCommit]);

  return {
    applyLocalText,
    collaborators,
    connectionStatus,
    resetConnection,
  };
}
