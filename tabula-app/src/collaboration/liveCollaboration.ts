import type { Extension } from "@codemirror/state";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import {
  createWorkspaceRoomCrdt,
  initializeWorkspaceRoomCrdt,
  validateWorkspaceRoomStructureLimits,
  validateWorkspaceRoomStructure,
  ROOM_WIRE_MAX_CRDT_STATE_BYTES,
  WORKSPACE_ROOM_ROOT_ID,
  type TextPatch,
  type WorkspaceRoomComment,
  type WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";
import { createDefaultCollabRuntimeAdapters } from "./collabDefaultAdapters";
import type { CollabRuntimeAdapters } from "./collabRuntimeAdapters";
import { createCollabSessionState } from "./collabSessionState";
import { resolveCollabStartConfig } from "./collabStartConfig";
import {
  createRoomDocumentRegistry,
  type RoomDocumentLease,
  type RoomDocumentHandle,
} from "./runtime/RoomDocumentRegistry";
import { createRoomDocumentProjectionStore } from "./runtime/RoomDocumentProjectionStore";
import { createRoomCommentsStore } from "./runtime/RoomCommentsStore";
import { createRoomStructureStore } from "./runtime/RoomStructureStore";
import { createRoomMetrics } from "./runtime/RoomMetrics";
import { createRoomCrdtStore } from "./runtime/RoomCrdtStore";
import {
  CHECKPOINT_ORIGIN,
  createCheckpointCoordinator,
  type InitialRoomCheckpoint,
  type RoomDurability,
} from "./runtime/CheckpointCoordinator";
import {
  createRoomPresenceController,
  type Collaborator,
  type LiveViewport,
} from "./runtime/RoomPresenceController";
import {
  createRoomSyncController,
  isRemoteSyncOrigin,
  REMOTE_AWARENESS_ORIGIN,
} from "./runtime/RoomSyncController";

export {
  createRoomSession,
  createRoomShareUrl,
  decodeBase64Url,
  decryptEnvelopeForRoom,
  encodeBase64Url,
  encryptBytesForRoom,
  generateRoomId,
  generateRoomKey,
  getTabulaRoomAvailability,
  importRoomKey,
  parseRoomFromHash,
  parseRoomKeyFromHash,
  parseRoomLocation,
  parseRoomShareUrl,
  resolveTabulaRoomBaseUrl,
} from "./collabRoom";
export type { ParsedRoomLocation, RoomSession, TabulaRoomAvailability } from "./collabRoom";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";
export type { RoomDurability } from "./runtime/CheckpointCoordinator";
export type {
  Collaborator,
  LiveSelection,
  LiveViewport,
} from "./runtime/RoomPresenceController";
export type {
  WorkspaceRoomDocumentCommand,
  WorkspaceRoomFolderCommand,
} from "./runtime/RoomCrdtStore";

export type CollabRecoveryEvent = {
  id: string;
  type: "reconnected" | "invalid-message";
  message: string;
  createdAt: string;
};

export type CollabRelativePosition = Y.RelativePosition;

export type CollabEditorBinding = {
  documentId: string;
  extension: Extension;
  yText: Y.Text;
  awareness: Awareness;
  undoManager: Y.UndoManager;
  canApplyTextByteDelta: (byteDelta: number) => boolean;
  createRelativePosition: (index: number) => CollabRelativePosition;
  resolveRelativePosition: (position: CollabRelativePosition) => number | null;
  consumeRemoteProjection?: () => boolean;
};

export type WorkspaceRoomRuntimeSnapshot = {
  status: ConnectionStatus;
  durability: RoomDurability;
  collaborators: Collaborator[];
  editorBinding: CollabEditorBinding | null;
};

export type WorkspaceDocumentSnapshot = {
  id: string;
  title: string;
  text: string;
  parentId?: string | null;
  order?: number;
};

export type WorkspaceFolderSnapshot = {
  id: string;
  title: string;
  parentId: string | null;
  order?: number;
};

type ConnectOptions = {
  roomId: string;
  roomKey: string;
  documentId?: string;
  documents?: readonly WorkspaceDocumentSnapshot[];
  folders?: readonly WorkspaceFolderSnapshot[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
  initialCheckpoint?: InitialRoomCheckpoint | null;
  emitInitialWorkspaceState: boolean;
  identity: Collaborator;
  fileTitle?: string;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
  adapters?: CollabRuntimeAdapters;
};

const AWARENESS_HEARTBEAT_MS = 15_000;
const TEXT_PROJECTION_DELAY_MS = 16;
const COMMENT_PROJECTION_DELAY_MS = 16;
const INVALID_MESSAGE_NOTICE_INTERVAL_MS = 5_000;
const CRDT_STATE_SIZE_CHECK_INTERVAL = 500;
const CRDT_STATE_WARNING_BYTES = Math.floor(ROOM_WIRE_MAX_CRDT_STATE_BYTES * 0.9);

const commentsToList = (commentsByFileId: Record<string, WorkspaceRoomComment[]> | undefined) =>
  Object.values(commentsByFileId ?? {}).flat();

export const createWorkspaceRoomRuntime = ({
  roomId,
  roomKey: encodedRoomKey,
  documentId,
  documents = [],
  folders = [],
  commentsByFileId,
  initialCheckpoint,
  emitInitialWorkspaceState,
  identity,
  fileTitle,
  onRecoveryEvent,
  onOpenFailure,
  onCapacityExceeded,
  adapters = createDefaultCollabRuntimeAdapters(),
}: ConnectOptions) => {
  const abortController = new AbortController();
  const room = createWorkspaceRoomCrdt({ roomId, initialize: emitInitialWorkspaceState });
  const awareness = new Awareness(room.doc);
  const sessionState = createCollabSessionState();
  let activeDocumentId: string | null = documentId ?? documents[0]?.id ?? null;
  const presenceController = createRoomPresenceController({
    room,
    roomId,
    awareness,
    identity,
    activeDocumentId,
    fileTitle,
    nowIso: adapters.clock.nowIso,
  });
  const documentRegistry = createRoomDocumentRegistry({ awareness, documents: room.documents });
  const documentProjectionStore = createRoomDocumentProjectionStore(room.documents);
  const commentsStore = createRoomCommentsStore(room);
  const structureStore = createRoomStructureStore(room);
  const remoteProjectionRevisions = new Map<string, number>();
  const consumedRemoteProjectionRevisions = new Map<string, number>();
  let activeDocumentLease: RoomDocumentLease | null = null;
  let roomKey: CryptoKey | null = null;
  let heartbeat: unknown;
  let stateSizeCheckTimer: unknown;
  let textProjectionTimer: unknown;
  let commentProjectionTimer: unknown;
  let closed = false;
  const pendingTextProjectionIds = new Set<string>();
  let lastInvalidMessageNoticeAt = 0;
  let capacityExceededNotified = false;
  let updatesSinceStateSizeCheck = 0;
  let runtimeSnapshot: WorkspaceRoomRuntimeSnapshot = {
    status: "connecting",
    durability: adapters.roomCheckpointStore.enabled ? "dirty" : "unknown",
    collaborators: [],
    editorBinding: null,
  };
  const runtimeListeners = new Set<() => void>();

  const scheduleTextProjection = (documentId: string) => {
    if (!documentProjectionStore.hasSubscribers(documentId)) return;
    pendingTextProjectionIds.add(documentId);
    if (textProjectionTimer || closed) return;
    textProjectionTimer = adapters.clock.setTimeout(() => {
      textProjectionTimer = undefined;
      const documentIds = [...pendingTextProjectionIds];
      pendingTextProjectionIds.clear();
      if (closed) return;
      for (const id of documentIds) {
        documentProjectionStore.refresh(id);
      }
    }, TEXT_PROJECTION_DELAY_MS);
  };

  const scheduleCommentProjection = () => {
    if (!commentsStore.hasSubscribers() || commentProjectionTimer || closed) return;
    commentProjectionTimer = adapters.clock.setTimeout(() => {
      commentProjectionTimer = undefined;
      if (!closed) commentsStore.refresh();
    }, COMMENT_PROJECTION_DELAY_MS);
  };

  const updateRuntimeSnapshot = (patch: Partial<WorkspaceRoomRuntimeSnapshot>) => {
    const next = { ...runtimeSnapshot, ...patch };
    if (
      next.status === runtimeSnapshot.status &&
      next.durability === runtimeSnapshot.durability &&
      next.collaborators === runtimeSnapshot.collaborators &&
      next.editorBinding === runtimeSnapshot.editorBinding
    ) {
      return;
    }
    runtimeSnapshot = next;
    runtimeListeners.forEach((listener) => listener());
  };

  const setStatus = (status: ConnectionStatus) => updateRuntimeSnapshot({ status });
  const setEditorBinding = (binding: CollabEditorBinding | null) =>
    updateRuntimeSnapshot({ editorBinding: binding });

  if (emitInitialWorkspaceState) {
    initializeWorkspaceRoomCrdt(room, {
      nodes: [
        ...folders.filter((folder) => folder.id !== WORKSPACE_ROOM_ROOT_ID).map((folder) => ({ ...folder, type: "folder" as const })),
        ...documents.map((document) => ({
          id: document.id,
          type: "document" as const,
          parentId: document.parentId ?? WORKSPACE_ROOM_ROOT_ID,
          title: document.title,
          order: document.order,
          markdown: document.text,
        })),
      ],
      comments: commentsToList(commentsByFileId),
    });
  }
  const roomMetrics = createRoomMetrics(room);
  const syncDocumentMetrics = () => {
    const removedDocumentIds = roomMetrics.syncDocuments();
    for (const id of removedDocumentIds) {
      remoteProjectionRevisions.delete(id);
      consumedRemoteProjectionRevisions.delete(id);
    }
    documentRegistry.sync();
  };
  const canApplyTextByteDelta = (byteDelta: number) =>
    roomMetrics.canApplyTextByteDelta(byteDelta);
  const crdtStore = createRoomCrdtStore({
    canApplyTextByteDelta,
    getDocumentByteLength: roomMetrics.getDocumentByteLength,
    room,
  });
  structureStore.refresh();
  syncDocumentMetrics();

  const emitRecoveryEvent = (type: CollabRecoveryEvent["type"], message: string) => {
    onRecoveryEvent?.({ id: adapters.clock.createId(), type, message, createdAt: adapters.clock.nowIso() });
  };

  const emitInvalidMessage = (message: string) => {
    const now = Date.now();
    if (now - lastInvalidMessageNoticeAt < INVALID_MESSAGE_NOTICE_INTERVAL_MS) return;
    lastInvalidMessageNoticeAt = now;
    emitRecoveryEvent("invalid-message", message);
  };

  const notifyCapacityExceeded = () => {
    if (capacityExceededNotified) return;
    capacityExceededNotified = true;
    onCapacityExceeded?.();
  };

  const scheduleStateSizeCheck = () => {
    updatesSinceStateSizeCheck += 1;
    if (updatesSinceStateSizeCheck < CRDT_STATE_SIZE_CHECK_INTERVAL || stateSizeCheckTimer || closed) return;
    updatesSinceStateSizeCheck = 0;
    stateSizeCheckTimer = adapters.clock.setTimeout(() => {
      stateSizeCheckTimer = undefined;
      if (!closed && Y.encodeStateAsUpdate(room.doc).byteLength >= CRDT_STATE_WARNING_BYTES) {
        notifyCapacityExceeded();
      }
    }, 0);
  };

  const publishCollaborators = () =>
    updateRuntimeSnapshot({ collaborators: presenceController.getCollaborators() });

  const projectWorkspace = () => {
    if (closed) return;
    if (!room.meta.has("schemaVersion")) return;
    const structure = validateWorkspaceRoomStructure(room, roomId);
    if (!structure.ok) {
      setStatus("failed");
      onOpenFailure?.("unsupported");
      emitInvalidMessage(structure.message);
      return;
    }
    structureStore.refresh();
    const structureLimits = validateWorkspaceRoomStructureLimits(structureStore.getSnapshot());
    if (!structureLimits.ok) {
      setStatus("failed");
      emitInvalidMessage(structureLimits.message);
      return;
    }
    const metrics = roomMetrics.getSnapshot();
    if (!metrics.commentsWithinLimits || !canApplyTextByteDelta(0)) {
      setStatus("failed");
      emitInvalidMessage("This live workspace exceeds the supported content limits.");
      return;
    }
    refreshActiveEditorBinding();
  };

  const createEditorBinding = (handle: RoomDocumentHandle): CollabEditorBinding => {
    const { documentId: nextDocumentId, extension, yText, undoManager } = handle;
    return {
      documentId: nextDocumentId,
      extension,
      yText,
      awareness,
      undoManager,
      canApplyTextByteDelta,
      createRelativePosition: (index) => Y.createRelativePositionFromTypeIndex(yText, index),
      resolveRelativePosition: (position) => {
        const yDoc = yText.doc;
        if (!yDoc) return null;
        const absolute = Y.createAbsolutePositionFromRelativePosition(position, yDoc);
        return absolute?.type === yText ? absolute.index : null;
      },
      consumeRemoteProjection: () => {
        const revision = remoteProjectionRevisions.get(nextDocumentId) ?? 0;
        const consumedRevision = consumedRemoteProjectionRevisions.get(nextDocumentId) ?? 0;
        if (revision <= consumedRevision) return false;
        consumedRemoteProjectionRevisions.set(nextDocumentId, revision);
        return true;
      },
    };
  };

  const refreshActiveEditorBinding = () => {
    const currentHandle = activeDocumentLease?.handle;
    const nextText = activeDocumentId ? room.documents.get(activeDocumentId) : undefined;
    if (
      currentHandle &&
      currentHandle.documentId === activeDocumentId &&
      currentHandle.yText === nextText
    ) {
      return;
    }
    activeDocumentLease?.release();
    activeDocumentLease = activeDocumentId ? documentRegistry.acquire(activeDocumentId) : null;
    setEditorBinding(activeDocumentLease ? createEditorBinding(activeDocumentLease.handle) : null);
  };

  const isCheckpointLeader = () =>
    presenceController.getActiveActorIds()[0] === presenceController.getIdentity().id;
  const checkpointCoordinator = createCheckpointCoordinator({
    room,
    roomId,
    store: adapters.roomCheckpointStore,
    clock: adapters.clock,
    signal: abortController.signal,
    isClosed: () => closed,
    isLeader: isCheckpointLeader,
    isWithinLimits: () => {
      const metrics = roomMetrics.getSnapshot();
      return metrics.commentsWithinLimits && canApplyTextByteDelta(0);
    },
    onCapacityExceeded: notifyCapacityExceeded,
    onDurabilityChange: (durability) => updateRuntimeSnapshot({ durability }),
    onSaveError: () => emitInvalidMessage("The encrypted live room could not be saved."),
  });
  const syncController = createRoomSyncController({
    roomId,
    doc: room.doc,
    awareness,
    adapters,
    isClosed: () => closed,
    getIdentityId: () => presenceController.getIdentity().id,
    getSenderActor: presenceController.getSenderActor,
    onCapacityExceeded: notifyCapacityExceeded,
    onInvalidMessage: emitInvalidMessage,
    onUnsupportedMessage: () => onOpenFailure?.("unsupported"),
  });

  const loadCheckpoint = async () => {
    if (!roomKey) return false;
    const result = await checkpointCoordinator.load(
      roomKey,
      emitInitialWorkspaceState,
      initialCheckpoint,
    );
    if (result.ok) return true;
    onOpenFailure?.(result.reason);
    setStatus("failed");
    return false;
  };

  const start = async () => {
    const startConfig = await resolveCollabStartConfig({
      encodedRoomKey,
      resolveBaseUrl: adapters.resolveRoomBaseUrl,
      importKey: adapters.crypto.importRoomKey,
    });
    if (closed || abortController.signal.aborted) return;
    if (startConfig.status === "blocked") {
      setStatus("failed");
      onOpenFailure?.("invalid");
      return;
    }
    roomKey = startConfig.roomKey;
    syncController.setRoomKey(roomKey);
    const transportPreparation = adapters.prepareRoomTransport?.().catch(() => undefined);
    if (!(await loadCheckpoint()) || closed || abortController.signal.aborted) return;
    await transportPreparation;
    if (closed || abortController.signal.aborted) return;
    syncDocumentMetrics();
    refreshActiveEditorBinding();
    projectWorkspace();
    presenceController.publishLocalState();

    syncController.connect(startConfig.baseUrl, {
        onConnect: () => { if (!closed) setStatus("connecting"); },
        onJoined: () => {
          if (closed) return;
          const joined = sessionState.markJoined();
          setStatus("connected");
          if (joined.reconnected) emitRecoveryEvent("reconnected", joined.message);
          presenceController.publishLocalState();
          syncController.onJoined();
          checkpointCoordinator.handleJoined();
        },
        onPeerJoined: () => {
          if (closed) return;
          syncController.onPeerJoined();
        },
        onPeers: (message) => {
          presenceController.refreshPeers(message.peers);
          publishCollaborators();
        },
        onError: (message) => emitInvalidMessage(message.error || "A collaboration server message was ignored."),
        onDisconnect: () => {
          if (closed) return;
          syncController.onTransportDisconnected();
          setStatus(sessionState.markOffline("disconnect").status);
        },
        onConnectError: () => {
          if (closed) return;
          const offline = sessionState.markOffline("connect-error");
          setStatus(offline.status);
        },
    });
    heartbeat = adapters.clock.setInterval(() => {
      if (closed) return;
      presenceController.publishLocalState();
      syncController.publishAwareness();
      syncController.pruneChunks();
    }, AWARENESS_HEARTBEAT_MS);
  };

  const handleDocumentUpdate = (update: Uint8Array, origin: unknown) => {
    if (closed) return;
    scheduleStateSizeCheck();
    checkpointCoordinator.handleDocumentUpdate(origin);
    if (isRemoteSyncOrigin(origin) || origin === CHECKPOINT_ORIGIN) return;
    syncController.handleLocalUpdate(update);
  };

  let projectionQueued = false;
  const queueWorkspaceProjection = () => {
    if (closed) return;
    if (projectionQueued) return;
    projectionQueued = true;
    queueMicrotask(() => {
      projectionQueued = false;
      if (!closed) projectWorkspace();
    });
  };
  const handleDocumentsChange = (
    events: Y.YEvent<Y.AbstractType<unknown>>[],
    transaction: Y.Transaction,
  ) => {
    const metricsChange = roomMetrics.applyDocumentEvents(events);
    if (metricsChange.structureChanged) {
      for (const id of metricsChange.removedDocumentIds) {
        remoteProjectionRevisions.delete(id);
        consumedRemoteProjectionRevisions.delete(id);
      }
      documentRegistry.sync();
      refreshActiveEditorBinding();
      queueWorkspaceProjection();
    }
    for (const id of metricsChange.changedDocumentIds) {
      if (isRemoteSyncOrigin(transaction.origin) || transaction.origin === CHECKPOINT_ORIGIN) {
        remoteProjectionRevisions.set(id, (remoteProjectionRevisions.get(id) ?? 0) + 1);
      }
      scheduleTextProjection(id);
      if (commentsStore.hasSubscribers(id) && room.comments.size > 0) scheduleCommentProjection();
    }
  };
  const handleWorkspaceStructureChange = () => queueWorkspaceProjection();
  const handleCommentsChange = () => {
    roomMetrics.refreshComments();
    scheduleCommentProjection();
  };

  const handleAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    publishCollaborators();
    checkpointCoordinator.handleLeadershipChange(runtimeSnapshot.durability);
    if (origin === REMOTE_AWARENESS_ORIGIN && !closed) {
      presenceController.reconcileLocalDisplay();
    }
    syncController.handleAwarenessUpdate(changes, origin);
  };

  room.doc.on("update", handleDocumentUpdate);
  room.documents.observeDeep(handleDocumentsChange);
  room.meta.observe(handleWorkspaceStructureChange);
  room.nodes.observeDeep(handleWorkspaceStructureChange);
  room.comments.observeDeep(handleCommentsChange);
  awareness.on("update", handleAwarenessUpdate);
  syncDocumentMetrics();
  refreshActiveEditorBinding();
  setStatus("connecting");
  void start().catch(() => {
    if (!closed && !abortController.signal.aborted) {
      setStatus("failed");
      onOpenFailure?.("invalid");
    }
  });

  const setActiveDocument = (nextDocument: { documentId: string; fileTitle?: string } | null) => {
    activeDocumentId = nextDocument?.documentId ?? null;
    presenceController.setActiveDocument(nextDocument);
    if (activeDocumentId && room.comments.size > 0) scheduleCommentProjection();
    refreshActiveEditorBinding();
  };

  return {
    subscribe(listener: () => void) {
      runtimeListeners.add(listener);
      return () => runtimeListeners.delete(listener);
    },
    getSnapshot() {
      return runtimeSnapshot;
    },
    subscribeStructure(listener: () => void) {
      return structureStore.subscribe(listener);
    },
    getStructureSnapshot(): WorkspaceRoomStructureSnapshot {
      return structureStore.getSnapshot();
    },
    subscribeDocument(documentId: string, listener: () => void) {
      return documentProjectionStore.subscribe(documentId, listener);
    },
    getDocumentTextSnapshot(documentId: string) {
      return documentProjectionStore.getSnapshot(documentId);
    },
    subscribeComments(documentId: string, listener: () => void) {
      return commentsStore.subscribe(documentId, listener);
    },
    getDocumentCommentsSnapshot(documentId: string) {
      return commentsStore.getSnapshot(documentId);
    },
    applyLocalText(nextText: string, patches?: readonly TextPatch[]) {
      if (!activeDocumentId) return false;
      return crdtStore.applyDocumentText(activeDocumentId, nextText, patches ?? []);
    },
    applyLocalTextPatches(patches: readonly TextPatch[]) {
      if (patches.length === 0) return true;
      if (!activeDocumentId) return false;
      return crdtStore.applyDocumentText(activeDocumentId, null, patches);
    },
    replaceDocumentText: crdtStore.replaceDocumentText,
    createDocument: crdtStore.createDocument,
    createFolder: crdtStore.createFolder,
    renameNode: crdtStore.renameNode,
    moveNode: crdtStore.moveNode,
    setNodeOrder: crdtStore.setNodeOrder,
    deleteNode: crdtStore.deleteNode,
    setActiveDocument,
    setEditorPresenceEnabled(enabled: boolean) {
      presenceController.setEditorPresenceEnabled(enabled);
    },
    setViewport: (viewport: LiveViewport | null) => presenceController.setViewport(viewport),
    setFollowingActor(actorId: string | null) {
      presenceController.setFollowingActor(actorId);
    },
    setIdentity(nextIdentity: Collaborator) {
      presenceController.setIdentity(nextIdentity);
    },
    getEditorBinding: () => runtimeSnapshot.editorBinding,
    materializeDocument: crdtStore.materializeDocument,
    materializeDocumentComments(documentId: string) {
      return commentsStore.materialize(documentId);
    },
    materializeWorkspace: crdtStore.materializeWorkspace,
    getResourceCounts: () => ({
      documentObservers: closed ? 0 : 1,
      ...documentRegistry.getResourceCounts(),
      ...documentProjectionStore.getResourceCounts(),
      ...commentsStore.getResourceCounts(),
      ...syncController.getResourceCounts(),
    }),
    upsertComment: crdtStore.upsertComment,
    deleteComment: crdtStore.deleteComment,
    setCommentResolved: crdtStore.setCommentResolved,
    addCommentReply: crdtStore.addCommentReply,
    disconnect() {
      if (closed) return;
      closed = true;
      checkpointCoordinator.dispose();
      abortController.abort();
      if (stateSizeCheckTimer) adapters.clock.clearTimeout(stateSizeCheckTimer);
      stateSizeCheckTimer = undefined;
      if (textProjectionTimer) adapters.clock.clearTimeout(textProjectionTimer);
      textProjectionTimer = undefined;
      if (commentProjectionTimer) adapters.clock.clearTimeout(commentProjectionTimer);
      commentProjectionTimer = undefined;
      if (heartbeat) adapters.clock.clearInterval(heartbeat);
      room.doc.off("update", handleDocumentUpdate);
      room.documents.unobserveDeep(handleDocumentsChange);
      room.meta.unobserve(handleWorkspaceStructureChange);
      room.nodes.unobserveDeep(handleWorkspaceStructureChange);
      room.comments.unobserveDeep(handleCommentsChange);
      awareness.off("update", handleAwarenessUpdate);
      if (syncController.isConnected() && roomKey) presenceController.clearLocalState();
      syncController.dispose();
      pendingTextProjectionIds.clear();
      activeDocumentLease?.release();
      activeDocumentLease = null;
      documentRegistry.dispose();
      documentProjectionStore.clear();
      commentsStore.dispose();
      structureStore.dispose();
      roomMetrics.dispose();
      remoteProjectionRevisions.clear();
      consumedRemoteProjectionRevisions.clear();
      awareness.destroy();
      room.doc.destroy();
      runtimeSnapshot = {
        status: "disconnected",
        durability: "unknown",
        collaborators: [],
        editorBinding: null,
      };
      runtimeListeners.forEach((listener) => listener());
      runtimeListeners.clear();
    },
    flushRecoveryState() {
      void checkpointCoordinator.saveNow();
    },
  };
};

export type WorkspaceRoomRuntime = ReturnType<typeof createWorkspaceRoomRuntime>;
