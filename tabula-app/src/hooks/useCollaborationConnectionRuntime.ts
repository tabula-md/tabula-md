import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
} from "react";
import type {
  WorkspaceRoomComment,
  WorkspaceRoomCommentReply,
  WorkspaceRoomSnapshot,
  TextPatch,
} from "@tabula-md/tabula";
import type {
  WorkspaceRoomRuntime,
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
  WorkspaceFolderSnapshot,
  WorkspaceRoomRuntimeSnapshot,
  WorkspaceRoomChangeOrigin,
} from "../collaboration/liveCollaboration";
import {
  getDisconnectedStatusPatch,
  getIdleStatusPatch,
  getInitialCollaborationStatus,
  getLiveRoomConnectionTarget,
  getRecoveryEventPatch,
  shouldStartLiveRoomConnection,
} from "../collaboration/collabRuntime";
import { isUsableLiveRoomFile, type WorkspaceFile } from "../workspaceStorage";

const getWorkspaceSignature = (
  documents: readonly { id: string; title: string; parentId?: string | null; order?: number }[],
  folders: readonly WorkspaceFolderSnapshot[],
) => JSON.stringify({
  documents: documents.map(({ id, title, parentId, order }) => [id, title, parentId ?? null, order ?? 0]),
  folders: folders.map(({ id, title, parentId, order }) => [id, title, parentId, order ?? 0]),
});

const EMPTY_RUNTIME_SNAPSHOT: WorkspaceRoomRuntimeSnapshot = {
  status: "idle",
  collaborators: [],
  editorBinding: null,
};

type UseCollaborationConnectionRuntimeOptions = {
  roomFile?: WorkspaceFile;
  activeDocument?: WorkspaceFile;
  editorPresenceEnabled?: boolean;
  identity: Collaborator;
  pendingRoomStartRef: MutableRefObject<boolean>;
  workspaceDocuments?: readonly { id: string; title: string; text: string; parentId?: string | null; order?: number }[];
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
  onRemoteTextChange?: (fileId: string, text: string) => void;
  onCommentsChange?: (commentsByFileId: Record<string, WorkspaceRoomComment[]>) => void;
  onWorkspaceChange?: (snapshot: WorkspaceRoomSnapshot, origin?: WorkspaceRoomChangeOrigin) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
};

export function useCollaborationConnectionRuntime({
  roomFile,
  activeDocument,
  editorPresenceEnabled = true,
  identity,
  pendingRoomStartRef,
  workspaceDocuments = [],
  workspaceFolders = [],
  commentsByFileId,
  setFileText,
  setFileCollaborationStatus,
  setFileRecoveryEvent,
  onRemoteTextChange,
  onCommentsChange,
  onWorkspaceChange,
  onOpenFailure,
  onCapacityExceeded,
}: UseCollaborationConnectionRuntimeOptions) {
  const [preRuntimeConnectionStatus, setPreRuntimeConnectionStatus] = useState<ConnectionStatus>(
    () => getInitialCollaborationStatus(roomFile),
  );
  const [runtime, setRuntime] = useState<WorkspaceRoomRuntime | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const collabRef = useRef<WorkspaceRoomRuntime | null>(null);
  const workspaceDocumentsRef = useRef(workspaceDocuments);
  const workspaceFoldersRef = useRef(workspaceFolders);
  const pendingLocalTextQueueRef = useRef<Array<{ text?: string; patches: readonly TextPatch[] }>>([]);
  const isLive = isUsableLiveRoomFile(roomFile);
  const connectionKey = roomFile?.roomId ? `workspace:${roomFile.roomId}:${roomFile.shareUrl ?? ""}` : "idle";
  const workspaceSignature = useMemo(
    () => getWorkspaceSignature(workspaceDocuments, workspaceFolders),
    [workspaceDocuments, workspaceFolders],
  );
  const subscribeToRuntime = useCallback(
    (listener: () => void) => runtime?.subscribe(listener) ?? (() => undefined),
    [runtime],
  );
  const getRuntimeSnapshot = useCallback(
    () => runtime?.getSnapshot() ?? EMPTY_RUNTIME_SNAPSHOT,
    [runtime],
  );
  const runtimeSnapshot = useSyncExternalStore(
    subscribeToRuntime,
    getRuntimeSnapshot,
    getRuntimeSnapshot,
  );
  const runtimeConnectionStatus = runtime ? runtimeSnapshot.status : preRuntimeConnectionStatus;
  const connectionStatus = isLive && !browserOnline ? "disconnected" : runtimeConnectionStatus;
  const collaborators = runtimeSnapshot.collaborators;
  const editorBinding =
    runtimeSnapshot.editorBinding?.documentId === activeDocument?.id
      ? runtimeSnapshot.editorBinding
      : null;

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    workspaceDocumentsRef.current = workspaceDocuments;
    workspaceFoldersRef.current = workspaceFolders;
  }, [workspaceDocuments, workspaceFolders]);

  useEffect(() => {
    collabRef.current?.setWorkspaceDocuments(workspaceDocumentsRef.current, workspaceFoldersRef.current);
  }, [workspaceSignature]);

  useEffect(() => {
    collabRef.current?.disconnect();
    collabRef.current = null;
    setRuntime(null);
    pendingLocalTextQueueRef.current = [];

    const target = getLiveRoomConnectionTarget(roomFile);
    const pendingRoomStart = pendingRoomStartRef.current;
    const documentSnapshot = workspaceDocumentsRef.current;
    const folderSnapshot = workspaceFoldersRef.current;
    if (!target || !shouldStartLiveRoomConnection({ file: roomFile, hasPendingStart: pendingRoomStart })) {
      pendingRoomStartRef.current = false;
      const nextStatus = target ? "disconnected" : "idle";
      setPreRuntimeConnectionStatus(nextStatus);
      if (roomFile?.id) {
        setFileCollaborationStatus(roomFile.id, nextStatus, target ? getDisconnectedStatusPatch() : getIdleStatusPatch());
      }
      return;
    }

    pendingRoomStartRef.current = false;
    setPreRuntimeConnectionStatus("connecting");
    setFileCollaborationStatus(target.fileId, "connecting");
    let disposed = false;
    let effectRuntime: WorkspaceRoomRuntime | null = null;
    void import("../collaboration/liveCollaboration")
      .then(({ createWorkspaceRoomRuntime }) => {
        if (disposed) return;
        const connection = createWorkspaceRoomRuntime({
          roomId: target.roomId,
          roomKey: target.roomKey,
          documentId: target.fileId,
          documents: documentSnapshot,
          folders: folderSnapshot,
          commentsByFileId,
          emitInitialWorkspaceState: false,
          identity,
          fileTitle: target.fileTitle,
          onTextChange: (documentId, text) => {
            setFileText(documentId, text);
            onRemoteTextChange?.(documentId, text);
          },
          onCommentsChange,
          onWorkspaceChange,
          onOpenFailure,
          onCapacityExceeded,
          onRecoveryEvent: (event) => setFileRecoveryEvent(target.fileId, getRecoveryEventPatch(event)),
        });
        effectRuntime = connection;
        collabRef.current = connection;
        setRuntime(connection);
        const queue = pendingLocalTextQueueRef.current;
        pendingLocalTextQueueRef.current = [];
        for (const pending of queue) {
          if (pending.text !== undefined) connection.applyLocalText(pending.text, pending.patches);
          else connection.applyLocalTextPatches(pending.patches);
        }
      })
      .catch(() => {
        if (disposed) return;
        setPreRuntimeConnectionStatus("failed");
        setFileCollaborationStatus(target.fileId, "failed", getDisconnectedStatusPatch());
        onOpenFailure?.("invalid");
      });

    return () => {
      disposed = true;
      effectRuntime?.disconnect();
      if (collabRef.current === effectRuntime) collabRef.current = null;
      setRuntime((current) => current === effectRuntime ? null : current);
      pendingLocalTextQueueRef.current = [];
      setFileCollaborationStatus(target.fileId, "disconnected", getDisconnectedStatusPatch());
    };
  }, [
    connectionAttempt,
    connectionKey,
    setFileCollaborationStatus,
    setFileRecoveryEvent,
    setFileText,
    onRemoteTextChange,
    onCommentsChange,
    onWorkspaceChange,
    onOpenFailure,
    onCapacityExceeded,
  ]);

  useEffect(() => {
    if (!roomFile?.id || !runtime) return;
    setFileCollaborationStatus(roomFile.id, connectionStatus);
  }, [
    roomFile?.id,
    runtime,
    connectionStatus,
    setFileCollaborationStatus,
  ]);

  useEffect(() => collabRef.current?.setIdentity(identity), [identity]);

  useEffect(() => {
    collabRef.current?.setEditorPresenceEnabled(editorPresenceEnabled);
  }, [editorPresenceEnabled]);

  useEffect(() => {
    if (!runtime) return;
    const nextDocument = activeDocument && activeDocument.roomId === roomFile?.roomId
      ? { documentId: activeDocument.id, fileTitle: activeDocument.title }
      : null;
    collabRef.current?.setActiveDocument(nextDocument);
  }, [activeDocument?.id, activeDocument?.roomId, activeDocument?.title, roomFile?.roomId, runtime]);

  useEffect(() => {
    const flush = () => collabRef.current?.flushRecoveryState();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const applyLocalText = useCallback((nextText: string | null, patches: readonly TextPatch[] = []) => {
    const connection = collabRef.current;
    if (connection) {
      if (nextText === null) connection.applyLocalTextPatches(patches);
      else connection.applyLocalText(nextText, patches);
      return;
    }
    if (isLive && patches.length > 0) pendingLocalTextQueueRef.current.push({ text: nextText ?? undefined, patches });
  }, [isLive]);

  const resetConnection = useCallback((nextStatus: ConnectionStatus = "idle") => {
    collabRef.current?.disconnect();
    collabRef.current = null;
    setRuntime(null);
    pendingLocalTextQueueRef.current = [];
    setPreRuntimeConnectionStatus(nextStatus);
  }, []);

  const retryConnection = useCallback(() => {
    if (!roomFile?.id || !isUsableLiveRoomFile(roomFile)) return;
    resetConnection("connecting");
    setFileCollaborationStatus(roomFile.id, "connecting");
    setConnectionAttempt((attempt) => attempt + 1);
  }, [roomFile, resetConnection, setFileCollaborationStatus]);

  return {
    applyLocalText,
    collaborators,
    connectionStatus,
    editorBinding,
    resetConnection,
    retryConnection,
    upsertComment: (comment: WorkspaceRoomComment) => collabRef.current?.upsertComment(comment),
    deleteComment: (commentId: string) => collabRef.current?.deleteComment(commentId),
    setCommentResolved: (commentId: string, resolved: boolean) => collabRef.current?.setCommentResolved(commentId, resolved),
    addCommentReply: (commentId: string, reply: WorkspaceRoomCommentReply) => collabRef.current?.addCommentReply(commentId, reply),
  };
}
