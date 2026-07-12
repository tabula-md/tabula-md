import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
} from "react";
import type {
  WorkspaceRoomComment,
  WorkspaceRoomCommentReply,
  WorkspaceRoomStructureSnapshot,
  TextPatch,
} from "@tabula-md/tabula";
import type {
  WorkspaceRoomRuntime,
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
  WorkspaceFolderSnapshot,
  LiveViewport,
  WorkspaceRoomDocumentCommand,
  WorkspaceRoomFolderCommand,
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

const EMPTY_RUNTIME_SNAPSHOT: WorkspaceRoomRuntimeSnapshot = {
  status: "idle",
  durability: "unknown",
  collaborators: [],
  editorBinding: null,
};

type PendingWorkspaceCommand =
  | { type: "create-document"; input: WorkspaceRoomDocumentCommand }
  | { type: "create-folder"; input: WorkspaceRoomFolderCommand }
  | { type: "rename-node"; nodeId: string; title: string }
  | { type: "move-node"; nodeId: string; parentId: string }
  | { type: "set-node-order"; nodeId: string; order: number }
  | { type: "delete-node"; nodeId: string }
  | { type: "replace-document-text"; documentId: string; text: string };

const applyWorkspaceCommand = (
  runtime: WorkspaceRoomRuntime,
  command: PendingWorkspaceCommand,
) => {
  switch (command.type) {
    case "create-document":
      return runtime.createDocument(command.input);
    case "create-folder":
      return runtime.createFolder(command.input);
    case "rename-node":
      return runtime.renameNode(command.nodeId, command.title);
    case "move-node":
      return runtime.moveNode(command.nodeId, command.parentId);
    case "set-node-order":
      return runtime.setNodeOrder(command.nodeId, command.order);
    case "delete-node":
      return runtime.deleteNode(command.nodeId);
    case "replace-document-text":
      return runtime.replaceDocumentText(command.documentId, command.text);
  }
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
  setFileCollaborationStatus: (
    fileId: string,
    status: ConnectionStatus,
    options?: { requireRoom?: boolean },
  ) => void;
  setFileRecoveryEvent: (
    fileId: string,
    event: { type: CollabRecoveryEvent["type"]; message: string; createdAt: string },
  ) => void;
  onCommentsChange?: (commentsByFileId: Record<string, WorkspaceRoomComment[]>) => void;
  onWorkspaceStructureChange?: (
    snapshot: WorkspaceRoomStructureSnapshot,
    origin: WorkspaceRoomChangeOrigin | undefined,
    readDocumentText: (documentId: string) => string | null,
  ) => void;
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
  setFileCollaborationStatus,
  setFileRecoveryEvent,
  onCommentsChange,
  onWorkspaceStructureChange,
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
  const pendingWorkspaceCommandQueueRef = useRef<PendingWorkspaceCommand[]>([]);
  const isLive = isUsableLiveRoomFile(roomFile);
  const connectionKey = roomFile?.roomId ? `workspace:${roomFile.roomId}:${roomFile.shareUrl ?? ""}` : "idle";
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
  const activeDocumentId = activeDocument?.id;
  const subscribeToActiveDocument = useCallback(
    (listener: () => void) =>
      runtime && activeDocumentId
        ? runtime.subscribeDocument(activeDocumentId, listener)
        : () => undefined,
    [activeDocumentId, runtime],
  );
  const getActiveDocumentSnapshot = useCallback(
    () => activeDocumentId
      ? runtime?.getDocumentTextSnapshot(activeDocumentId) ?? activeDocument?.text ?? null
      : null,
    [activeDocument?.text, activeDocumentId, runtime],
  );
  const activeDocumentText = useSyncExternalStore(
    subscribeToActiveDocument,
    getActiveDocumentSnapshot,
    getActiveDocumentSnapshot,
  );
  const runtimeConnectionStatus = runtime ? runtimeSnapshot.status : preRuntimeConnectionStatus;
  const connectionStatus = isLive && !browserOnline ? "disconnected" : runtimeConnectionStatus;
  const durability = runtimeSnapshot.durability;
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
    collabRef.current?.disconnect();
    collabRef.current = null;
    setRuntime(null);
    pendingLocalTextQueueRef.current = [];
    pendingWorkspaceCommandQueueRef.current = [];

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
          onCommentsChange,
          onWorkspaceStructureChange,
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
        const workspaceCommands = pendingWorkspaceCommandQueueRef.current;
        pendingWorkspaceCommandQueueRef.current = [];
        for (const command of workspaceCommands) applyWorkspaceCommand(connection, command);
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
      pendingWorkspaceCommandQueueRef.current = [];
      setFileCollaborationStatus(target.fileId, "disconnected", getDisconnectedStatusPatch());
    };
  }, [
    connectionAttempt,
    connectionKey,
    setFileCollaborationStatus,
    setFileRecoveryEvent,
    onCommentsChange,
    onWorkspaceStructureChange,
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

  const dispatchWorkspaceCommand = useCallback((command: PendingWorkspaceCommand) => {
    const connection = collabRef.current;
    if (connection) return applyWorkspaceCommand(connection, command);
    if (!isLive) return false;
    pendingWorkspaceCommandQueueRef.current.push(command);
    return true;
  }, [isLive]);

  const resetConnection = useCallback((nextStatus: ConnectionStatus = "idle") => {
    collabRef.current?.disconnect();
    collabRef.current = null;
    setRuntime(null);
    pendingLocalTextQueueRef.current = [];
    pendingWorkspaceCommandQueueRef.current = [];
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
    activeDocumentText,
    createDocument: (input: WorkspaceRoomDocumentCommand) =>
      dispatchWorkspaceCommand({ type: "create-document", input }),
    createFolder: (input: WorkspaceRoomFolderCommand) =>
      dispatchWorkspaceCommand({ type: "create-folder", input }),
    renameNode: (nodeId: string, title: string) =>
      dispatchWorkspaceCommand({ type: "rename-node", nodeId, title }),
    moveNode: (nodeId: string, parentId: string) =>
      dispatchWorkspaceCommand({ type: "move-node", nodeId, parentId }),
    setNodeOrder: (nodeId: string, order: number) =>
      dispatchWorkspaceCommand({ type: "set-node-order", nodeId, order }),
    deleteNode: (nodeId: string) =>
      dispatchWorkspaceCommand({ type: "delete-node", nodeId }),
    replaceDocumentText: (documentId: string, text: string) =>
      dispatchWorkspaceCommand({ type: "replace-document-text", documentId, text }),
    setFollowingActor: (actorId: string | null) => collabRef.current?.setFollowingActor(actorId),
    setViewport: (viewport: LiveViewport | null) => collabRef.current?.setViewport(viewport),
    collaborators,
    connectionStatus,
    durability,
    editorBinding,
    materializeWorkspace: () => collabRef.current?.materializeWorkspace(),
    resetConnection,
    retryConnection,
    upsertComment: (comment: WorkspaceRoomComment) => collabRef.current?.upsertComment(comment),
    deleteComment: (commentId: string) => collabRef.current?.deleteComment(commentId),
    setCommentResolved: (commentId: string, resolved: boolean) => collabRef.current?.setCommentResolved(commentId, resolved),
    addCommentReply: (commentId: string, reply: WorkspaceRoomCommentReply) => collabRef.current?.addCommentReply(commentId, reply),
  };
}
