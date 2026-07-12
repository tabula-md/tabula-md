import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
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
  LiveViewport,
  WorkspaceRoomDocumentCommand,
  WorkspaceRoomFolderCommand,
  WorkspaceRoomRuntimeSnapshot,
} from "../collaboration/liveCollaboration";
import {
  getInitialCollaborationStatus,
  getLiveRoomConnectionTarget,
} from "../collaboration/collabRuntime";
import type { LocationRoom, WorkspaceFile } from "../workspaceStorage";

const EMPTY_RUNTIME_SNAPSHOT: WorkspaceRoomRuntimeSnapshot = {
  status: "idle",
  durability: "unknown",
  collaborators: [],
  editorBinding: null,
};
const EMPTY_COMMENTS: readonly WorkspaceRoomComment[] = Object.freeze([]);

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
  room?: LocationRoom | null;
  activeDocument?: Pick<WorkspaceFile, "id" | "title">;
  editorPresenceEnabled?: boolean;
  identity: Collaborator;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
};

export function useCollaborationConnectionRuntime({
  room,
  activeDocument,
  editorPresenceEnabled = true,
  identity,
  onRecoveryEvent,
  onOpenFailure,
  onCapacityExceeded,
}: UseCollaborationConnectionRuntimeOptions) {
  const [preRuntimeConnectionStatus, setPreRuntimeConnectionStatus] = useState<ConnectionStatus>(
    () => getInitialCollaborationStatus(room),
  );
  const [runtime, setRuntime] = useState<WorkspaceRoomRuntime | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const collabRef = useRef<WorkspaceRoomRuntime | null>(null);
  const pendingLocalTextQueueRef = useRef<Array<{ text?: string; patches: readonly TextPatch[] }>>([]);
  const pendingWorkspaceCommandQueueRef = useRef<PendingWorkspaceCommand[]>([]);
  const isLive = Boolean(room);
  const connectionKey = room ? `workspace:${room.roomId}:${room.shareUrl}` : "idle";
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
  const subscribeToStructure = useCallback(
    (listener: () => void) => runtime?.subscribeStructure(listener) ?? (() => undefined),
    [runtime],
  );
  const getStructureSnapshot = useCallback(
    (): WorkspaceRoomStructureSnapshot | null => runtime?.getStructureSnapshot() ?? null,
    [runtime],
  );
  const structureSnapshot = useSyncExternalStore(
    subscribeToStructure,
    getStructureSnapshot,
    getStructureSnapshot,
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
      ? runtime?.getDocumentTextSnapshot(activeDocumentId) ?? null
      : null,
    [activeDocumentId, runtime],
  );
  const activeDocumentText = useSyncExternalStore(
    subscribeToActiveDocument,
    getActiveDocumentSnapshot,
    getActiveDocumentSnapshot,
  );
  const subscribeToActiveComments = useCallback(
    (listener: () => void) =>
      runtime && activeDocumentId
        ? runtime.subscribeComments(activeDocumentId, listener)
        : () => undefined,
    [activeDocumentId, runtime],
  );
  const getActiveCommentsSnapshot = useCallback(
    () => activeDocumentId
      ? runtime?.getDocumentCommentsSnapshot(activeDocumentId) ?? EMPTY_COMMENTS
      : EMPTY_COMMENTS,
    [activeDocumentId, runtime],
  );
  const activeDocumentComments = useSyncExternalStore(
    subscribeToActiveComments,
    getActiveCommentsSnapshot,
    getActiveCommentsSnapshot,
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
    collabRef.current?.disconnect();
    collabRef.current = null;
    setRuntime(null);
    pendingLocalTextQueueRef.current = [];
    pendingWorkspaceCommandQueueRef.current = [];

    const target = getLiveRoomConnectionTarget({
      room,
      document: activeDocument,
    });
    if (!target) {
      setPreRuntimeConnectionStatus("idle");
      return;
    }

    setPreRuntimeConnectionStatus("connecting");
    let disposed = false;
    let effectRuntime: WorkspaceRoomRuntime | null = null;
    void import("../collaboration/liveCollaboration")
      .then(({ createWorkspaceRoomRuntime }) => {
        if (disposed) return;
        const connection = createWorkspaceRoomRuntime({
          roomId: target.roomId,
          roomKey: target.roomKey,
          documentId: target.fileId,
          emitInitialWorkspaceState: false,
          identity,
          fileTitle: target.fileTitle,
          onOpenFailure,
          onCapacityExceeded,
          onRecoveryEvent,
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
        onOpenFailure?.("invalid");
      });

    return () => {
      disposed = true;
      effectRuntime?.disconnect();
      if (collabRef.current === effectRuntime) collabRef.current = null;
      setRuntime((current) => current === effectRuntime ? null : current);
      pendingLocalTextQueueRef.current = [];
      pendingWorkspaceCommandQueueRef.current = [];
    };
  }, [
    connectionAttempt,
    connectionKey,
    onRecoveryEvent,
    onOpenFailure,
    onCapacityExceeded,
  ]);

  useEffect(() => collabRef.current?.setIdentity(identity), [identity]);

  useEffect(() => {
    collabRef.current?.setEditorPresenceEnabled(editorPresenceEnabled);
  }, [editorPresenceEnabled]);

  useEffect(() => {
    if (!runtime) return;
    const nextDocument = activeDocument && room
      ? { documentId: activeDocument.id, fileTitle: activeDocument.title }
      : null;
    collabRef.current?.setActiveDocument(nextDocument);
  }, [activeDocument?.id, activeDocument?.title, room, runtime]);

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
    if (!room) return;
    resetConnection("connecting");
    setConnectionAttempt((attempt) => attempt + 1);
  }, [room, resetConnection]);

  return {
    applyLocalText,
    activeDocumentText,
    activeDocumentComments,
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
    materializeDocument: (documentId: string) => collabRef.current?.materializeDocument(documentId) ?? null,
    materializeDocumentComments: (documentId: string) =>
      collabRef.current?.materializeDocumentComments(documentId) ?? EMPTY_COMMENTS,
    resetConnection,
    retryConnection,
    structureSnapshot,
    upsertComment: (comment: WorkspaceRoomComment) => collabRef.current?.upsertComment(comment),
    deleteComment: (commentId: string) => collabRef.current?.deleteComment(commentId),
    setCommentResolved: (commentId: string, resolved: boolean) => collabRef.current?.setCommentResolved(commentId, resolved),
    addCommentReply: (commentId: string, reply: WorkspaceRoomCommentReply) => collabRef.current?.addCommentReply(commentId, reply),
  };
}
