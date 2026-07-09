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
  shouldStartLiveRoomConnection,
} from "../collaboration/collabRuntime";
import type { RoomEvent, TextChange, TextPatch } from "@tabula-md/tabula";
import {
  isEmptyGeneratedLivePlaceholder,
  isUsableLiveRoomFile,
  type WorkspaceFile,
} from "../workspaceStorage";

// Remote text is applied to the editor immediately and mirrored to workspace storage.
// The short delayed commit is a race-boundary fallback for route changes and pagehide.
const REMOTE_WORKSPACE_COMMIT_DELAY_MS = 80;

type UseCollaborationConnectionRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeSelection?: LiveSelection;
  identity: Collaborator;
  pendingInitialTextRef: MutableRefObject<string | undefined>;
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
  onRemoteTextChange?: (fileId: string, text: string, change?: TextChange) => void;
  onRoomEvent?: (event: RoomEvent) => void;
};

export function useCollaborationConnectionRuntime({
  activeFile,
  activeSelection,
  identity,
  pendingInitialTextRef,
  workspaceDocuments = [],
  setFileText,
  setFileCollaborationStatus,
  setFileCollaboratorCount,
  setFileRecoveryEvent,
  onRemoteTextChange,
  onRoomEvent,
}: UseCollaborationConnectionRuntimeOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    getInitialCollaborationStatus(activeFile),
  );
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const collabRef = useRef<CollabConnection | null>(null);
  const remoteWorkspaceCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRemoteWorkspaceCommitRef = useRef<Map<string, string>>(new Map());
  const workspaceDocumentsRef = useRef(workspaceDocuments);
  const pendingLocalTextQueueRef = useRef<
    Array<{ text: string; patches?: readonly TextPatch[] } | { docLength?: number; patches: readonly TextPatch[] }>
  >([]);
  const isLive = isUsableLiveRoomFile(activeFile);
  const connectionKey =
    activeFile?.roomId
      ? `workspace:${activeFile.roomId}:${activeFile.shareUrl ?? ""}`
      : "idle";

  useEffect(() => {
    workspaceDocumentsRef.current = workspaceDocuments;
  }, [workspaceDocuments]);

  const clearRemoteWorkspaceCommitTimer = useCallback(() => {
    if (remoteWorkspaceCommitTimerRef.current !== null) {
      clearTimeout(remoteWorkspaceCommitTimerRef.current);
      remoteWorkspaceCommitTimerRef.current = null;
    }
  }, []);

  const flushRemoteWorkspaceCommit = useCallback(() => {
    clearRemoteWorkspaceCommitTimer();
    const pendingCommits = pendingRemoteWorkspaceCommitRef.current;
    pendingRemoteWorkspaceCommitRef.current = new Map();
    for (const [fileId, text] of pendingCommits) {
      setFileText(fileId, text);
    }
  }, [clearRemoteWorkspaceCommitTimer, setFileText]);

  const discardRemoteWorkspaceCommit = useCallback(() => {
    clearRemoteWorkspaceCommitTimer();
    pendingRemoteWorkspaceCommitRef.current = new Map();
  }, [clearRemoteWorkspaceCommitTimer]);

  const scheduleRemoteWorkspaceCommit = useCallback((fileId: string, text: string) => {
    pendingRemoteWorkspaceCommitRef.current.set(fileId, text);
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
    pendingLocalTextQueueRef.current = [];
    setCollaborators([]);

    const target = getLiveRoomConnectionTarget(activeFile);
    const pendingInitialText = pendingInitialTextRef.current;
    const workspaceDocumentsSnapshot = workspaceDocumentsRef.current;

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
          documentId: target.fileId,
          documents: workspaceDocumentsSnapshot,
          emitInitialWorkspaceState: !activeFile || !isEmptyGeneratedLivePlaceholder(activeFile),
          initialText: pendingInitialText,
          identity,
          fileTitle: target.fileTitle,
          selection: activeSelection,
          onTextChange: (documentId, nextText, change) => {
            onRemoteTextChange?.(documentId, nextText, change);
            setFileText(documentId, nextText);
            scheduleRemoteWorkspaceCommit(documentId, nextText);
          },
          onStatusChange: (status) => {
            setConnectionStatus(status);
            setFileCollaborationStatus(target.fileId, status);
          },
          onCollaboratorsChange: (nextCollaborators) => {
            setCollaborators(nextCollaborators);
            setFileCollaboratorCount(target.fileId, nextCollaborators.length);
          },
          onRoomEvent,
          onRecoveryEvent: (event) => {
            setFileRecoveryEvent(target.fileId, getRecoveryEventPatch(event));
          },
        });

        collabRef.current = connection;
        const pendingLocalTextQueue = pendingLocalTextQueueRef.current;
        pendingLocalTextQueueRef.current = [];
        for (const pendingLocalText of pendingLocalTextQueue) {
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
      pendingLocalTextQueueRef.current = [];
      setFileCollaborationStatus(target.fileId, "disconnected", getDisconnectedStatusPatch());
    };
  }, [
    connectionAttempt,
    connectionKey,
    setFileCollaborationStatus,
    setFileCollaboratorCount,
    setFileRecoveryEvent,
    onRemoteTextChange,
    onRoomEvent,
    flushRemoteWorkspaceCommit,
    scheduleRemoteWorkspaceCommit,
  ]);

  useEffect(() => {
    collabRef.current?.setIdentity(identity);
  }, [identity]);

  useEffect(() => {
    if (!activeFile?.id || !activeFile.roomId) {
      return;
    }

    collabRef.current?.setActiveDocument({
      documentId: activeFile.id,
      fileTitle: activeFile.title,
      initialText: workspaceDocumentsRef.current.find((document) => document.id === activeFile.id)?.text ?? activeFile.text,
    });
    setFileCollaborationStatus(activeFile.id, connectionStatus);
  }, [
    activeFile?.id,
    activeFile?.roomId,
    activeFile?.text,
    activeFile?.title,
    connectionStatus,
    setFileCollaborationStatus,
  ]);

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
        if (nextText === null) {
          if (patches?.length) {
            pendingLocalTextQueueRef.current.push({ patches, docLength: options.docLength });
          }
          return;
        }

        pendingLocalTextQueueRef.current.push({ text: nextText, patches });
      }
    },
    [discardRemoteWorkspaceCommit, isLive],
  );

  const resetConnection = useCallback((nextStatus: ConnectionStatus = "idle") => {
    flushRemoteWorkspaceCommit();
    collabRef.current?.disconnect();
    collabRef.current = null;
    pendingLocalTextQueueRef.current = [];
    setCollaborators([]);
    setConnectionStatus(nextStatus);
  }, [flushRemoteWorkspaceCommit]);

  const retryConnection = useCallback(() => {
    const activeFileId = activeFile?.id;
    if (!activeFileId || !isUsableLiveRoomFile(activeFile)) {
      return;
    }

    flushRemoteWorkspaceCommit();
    collabRef.current?.disconnect();
    collabRef.current = null;
    pendingLocalTextQueueRef.current = [];
    setCollaborators([]);
    setConnectionStatus("connecting");
    setFileCollaborationStatus(activeFileId, "connecting");
    setConnectionAttempt((currentAttempt) => currentAttempt + 1);
  }, [activeFile, flushRemoteWorkspaceCommit, setFileCollaborationStatus]);

  const publishRoomEvent = useCallback((event: RoomEvent) => {
    collabRef.current?.publishRoomEvent(event);
  }, []);

  return {
    applyLocalText,
    collaborators,
    connectionStatus,
    publishRoomEvent,
    resetConnection,
    retryConnection,
  };
}
