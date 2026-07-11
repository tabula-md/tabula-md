import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import {
  addWorkspaceRoomCommentReply,
  applyTextPatches as applyTextPatchesToString,
  createRoomActor,
  createRoomChunkAssembler,
  createWorkspaceRoomCrdt,
  createWorkspaceRoomDocument,
  createWorkspaceRoomFolder,
  decodeRoomWirePacket,
  deleteWorkspaceRoomComment,
  deleteWorkspaceRoomNode,
  encodeRoomWirePackets,
  getWorkspaceRoomDocument,
  getWorkspaceRoomComments,
  getWorkspaceRoomSnapshot,
  hasRoomCapability,
  initializeWorkspaceRoomCrdt,
  moveWorkspaceRoomNode,
  parseRoomActor,
  renameWorkspaceRoomNode,
  setWorkspaceRoomComment,
  setWorkspaceRoomCommentResolved,
  setWorkspaceRoomNodeOrder,
  validateWorkspaceRoomLimits,
  validateWorkspaceRoomStructure,
  ROOM_WIRE_MAX_CRDT_STATE_BYTES,
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_ROOT_ID,
  type RoomActor,
  type RoomActorClient,
  type RoomActorKind,
  type RoomCapability,
  type RoomWireDataPacket,
  type TextPatch,
  type WorkspaceRoomComment,
  type WorkspaceRoomCommentReply,
  type WorkspaceRoomCrdt,
  type WorkspaceRoomSnapshot,
} from "@tabula-md/tabula";
import { isEncryptedEnvelope } from "./collabConnectionModel";
import { createDefaultCollabRuntimeAdapters } from "./collabDefaultAdapters";
import type { CollabRuntimeAdapters } from "./collabRuntimeAdapters";
import { createCollabSessionState } from "./collabSessionState";
import { resolveCollabStartConfig } from "./collabStartConfig";
import {
  decryptWorkspaceRoomCheckpoint,
  encryptWorkspaceRoomCheckpoint,
  ROOM_CHECKPOINT_RETENTION_MS,
} from "./roomCheckpointStore";
import { Utf8TextSizeTracker } from "./utf8TextSizeTracker";

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

export type LiveSelection = {
  documentId?: string;
  from: number;
  to: number;
  columnNumber?: number;
  fromLineNumber?: number;
  lineNumber?: number;
  selectionEndsWithLineBreak?: boolean;
  toLineNumber?: number;
};

export type Collaborator = {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
  activeDocumentId?: string;
  kind?: RoomActorKind;
  client?: RoomActorClient;
  capabilities?: RoomCapability[];
  joinedAt?: string;
  roomId?: string;
  fileTitle?: string;
  selection?: LiveSelection;
};

export type CollabRecoveryEvent = {
  id: string;
  type: "reconnected" | "invalid-message";
  message: string;
  createdAt: string;
};

export type CollabEditorBinding = {
  documentId: string;
  extension: Extension;
  yText: Y.Text;
  awareness: Awareness;
  undoManager: Y.UndoManager;
  canApplyTextByteDelta: (byteDelta: number) => boolean;
  consumeRemoteProjection?: () => boolean;
};

export type WorkspaceRoomRuntimeSnapshot = {
  status: ConnectionStatus;
  collaborators: Collaborator[];
  editorBinding: CollabEditorBinding | null;
};

export type WorkspaceRoomChangeOrigin = {
  actorId: string;
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
  emitInitialWorkspaceState?: boolean;
  initialText?: string;
  identity: Collaborator;
  fileTitle?: string;
  onTextChange: (documentId: string, text: string) => void;
  onCommentsChange?: (commentsByFileId: Record<string, WorkspaceRoomComment[]>) => void;
  onWorkspaceChange?: (snapshot: WorkspaceRoomSnapshot, origin?: WorkspaceRoomChangeOrigin) => void;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
  adapters?: CollabRuntimeAdapters;
};

const REMOTE_SYNC_ORIGIN = Symbol("tabula.remote-sync");
const REMOTE_AWARENESS_ORIGIN = Symbol("tabula.remote-awareness");
const CHECKPOINT_ORIGIN = Symbol("tabula.checkpoint");
const CHECKPOINT_SAVE_DELAY_MS = 5_000;
const AWARENESS_HEARTBEAT_MS = 15_000;
const INVALID_MESSAGE_NOTICE_INTERVAL_MS = 5_000;
const utf8Encoder = new TextEncoder();

type RemoteSyncOrigin = {
  type: typeof REMOTE_SYNC_ORIGIN;
  senderId: string;
};

const isRemoteSyncOrigin = (origin: unknown): origin is RemoteSyncOrigin =>
  Boolean(origin && typeof origin === "object" && (origin as Partial<RemoteSyncOrigin>).type === REMOTE_SYNC_ORIGIN);

const getActor = (identity: Collaborator): RoomActor => createRoomActor({
  id: identity.id,
  kind: identity.kind ?? "human",
  name: identity.name,
  color: identity.color,
  client: identity.client ?? "tabula-md",
  capabilities: identity.capabilities,
  joinedAt: identity.joinedAt,
});

const isActor = (value: unknown): value is RoomActor => {
  return parseRoomActor(value) !== null;
};

const getSelectionFromAwarenessState = (
  room: WorkspaceRoomCrdt,
  state: Record<string, unknown>,
): LiveSelection | undefined => {
  const cursor = state.cursor;
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
  const raw = cursor as { anchor?: Y.RelativePosition; head?: Y.RelativePosition };
  if (!raw.anchor || !raw.head) return undefined;
  try {
    const anchor = Y.createAbsolutePositionFromRelativePosition(raw.anchor, room.doc);
    const head = Y.createAbsolutePositionFromRelativePosition(raw.head, room.doc);
    if (!anchor || !head || anchor.type !== head.type) return undefined;
    let documentId: string | undefined;
    room.documents.forEach((text, id) => {
      if (text === anchor.type) documentId = id;
    });
    if (!documentId) return undefined;
    return { documentId, from: Math.min(anchor.index, head.index), to: Math.max(anchor.index, head.index) };
  } catch {
    return undefined;
  }
};

const applyTextPatches = (text: Y.Text, patches: readonly TextPatch[]) => {
  for (const patch of [...patches].sort((first, second) => second.from - first.from)) {
    const from = Math.max(0, Math.min(patch.from, text.length));
    const to = Math.max(from, Math.min(patch.to, text.length));
    if (to > from) text.delete(from, to - from);
    if (patch.insert) text.insert(from, patch.insert);
  }
};

const commentsToList = (commentsByFileId: Record<string, WorkspaceRoomComment[]> | undefined) =>
  Object.values(commentsByFileId ?? {}).flat();

export const createWorkspaceRoomRuntime = ({
  roomId,
  roomKey: encodedRoomKey,
  documentId = "document",
  documents = [],
  folders = [],
  commentsByFileId,
  emitInitialWorkspaceState = true,
  initialText,
  identity,
  fileTitle,
  onTextChange,
  onCommentsChange,
  onWorkspaceChange,
  onRecoveryEvent,
  onOpenFailure,
  onCapacityExceeded,
  adapters = createDefaultCollabRuntimeAdapters(),
}: ConnectOptions) => {
  const abortController = new AbortController();
  const room = createWorkspaceRoomCrdt({ roomId, initialize: emitInitialWorkspaceState });
  const awareness = new Awareness(room.doc);
  const chunkAssembler = createRoomChunkAssembler();
  const sessionState = createCollabSessionState();
  const undoManagers = new Map<string, Y.UndoManager>();
  const documentByteLengths = new Map<string, number>();
  const documentSizeTrackers = new Map<string, Utf8TextSizeTracker>();
  const remoteProjectionRevisions = new Map<string, number>();
  const consumedRemoteProjectionRevisions = new Map<string, number>();
  const textObservers = new Map<
    string,
    {
      text: Y.Text;
      listener: (event: Y.YTextEvent, transaction: Y.Transaction) => void;
    }
  >();
  let activeDocumentId: string | null = documentId;
  let editorPresenceEnabled = true;
  let currentFileTitle: string | undefined = fileTitle;
  let currentIdentity: Collaborator = {
    ...identity,
    joinedAt: identity.joinedAt ?? adapters.clock.nowIso(),
  };
  let roomKey: CryptoKey | null = null;
  let transport: ReturnType<CollabRuntimeAdapters["createRoomTransport"]> | null = null;
  let heartbeat: unknown;
  let checkpointTimer: unknown;
  let commentProjectionTimer: unknown;
  let checkpointGeneration = 0;
  let checkpointSaveInFlight = false;
  let checkpointSaveRequested = false;
  let envelopeVersion = 0;
  let closed = false;
  let hasHydratedWorkspace = false;
  let outboundQueue = Promise.resolve();
  let inboundQueue = Promise.resolve();
  let lastInvalidMessageNoticeAt = 0;
  let capacityExceededNotified = false;
  let runtimeSnapshot: WorkspaceRoomRuntimeSnapshot = {
    status: "connecting",
    collaborators: [],
    editorBinding: null,
  };
  const runtimeListeners = new Set<() => void>();
  let commentByteLength = 0;
  let roomContentByteLength = 0;

  const getCommentByteLength = () =>
    Object.values(getWorkspaceRoomComments(room)).flat().reduce(
      (total, comment) => total + utf8Encoder.encode(comment.body).byteLength +
        comment.replies.reduce((replyTotal, reply) => replyTotal + utf8Encoder.encode(reply.body).byteLength, 0),
      0,
    );

  const refreshRoomContentByteLength = () => {
    roomContentByteLength = commentByteLength;
    for (const byteLength of documentByteLengths.values()) roomContentByteLength += byteLength;
  };

  const refreshAllDocumentByteLengths = () => {
    documentByteLengths.clear();
    documentSizeTrackers.clear();
    room.documents.forEach((text, id) => {
      const tracker = new Utf8TextSizeTracker(text.toString());
      documentSizeTrackers.set(id, tracker);
      documentByteLengths.set(id, tracker.byteLength);
    });
    refreshRoomContentByteLength();
  };

  const refreshCommentByteLength = () => {
    commentByteLength = getCommentByteLength();
    refreshRoomContentByteLength();
  };

  const scheduleCommentProjection = () => {
    if (!onCommentsChange || commentProjectionTimer || closed) return;
    commentProjectionTimer = adapters.clock.setTimeout(() => {
      commentProjectionTimer = undefined;
      if (!closed) onCommentsChange(getWorkspaceRoomComments(room));
    }, 120);
  };

  const canApplyTextByteDelta = (byteDelta: number) =>
    Number.isFinite(byteDelta) &&
    roomContentByteLength + byteDelta >= 0 &&
    roomContentByteLength + byteDelta <= WORKSPACE_ROOM_MAX_CONTENT_BYTES;

  const updateRuntimeSnapshot = (patch: Partial<WorkspaceRoomRuntimeSnapshot>) => {
    const next = { ...runtimeSnapshot, ...patch };
    if (
      next.status === runtimeSnapshot.status &&
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
    const normalizedDocuments = documents.length > 0
      ? documents.map((document) => document.id === documentId && initialText !== undefined ? { ...document, text: initialText } : document)
      : [{
          id: documentId,
          title: fileTitle ?? "Untitled",
          text: initialText ?? "",
          parentId: WORKSPACE_ROOM_ROOT_ID,
          order: 0,
        }];
    initializeWorkspaceRoomCrdt(room, {
      nodes: [
        ...folders.filter((folder) => folder.id !== WORKSPACE_ROOM_ROOT_ID).map((folder) => ({ ...folder, type: "folder" as const })),
        ...normalizedDocuments.map((document) => ({
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
  refreshAllDocumentByteLengths();
  refreshCommentByteLength();

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

  const publishCollaborators = () => {
    const collaborators: Collaborator[] = [];
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === awareness.clientID || !state || typeof state !== "object") return;
      const actor = (state as Record<string, unknown>).actor;
      if (!isActor(actor) || actor.id === currentIdentity.id || !hasRoomCapability(actor, "presence")) return;
      collaborators.push({
        id: actor.id,
        name: actor.name,
        color: actor.color ?? "#2563eb",
        kind: actor.kind,
        client: actor.client,
        capabilities: actor.capabilities,
        joinedAt: actor.joinedAt,
        roomId,
        activeDocumentId: typeof state.activeDocumentId === "string" ? state.activeDocumentId : undefined,
        fileTitle: typeof state.fileTitle === "string" ? state.fileTitle : undefined,
        selection: getSelectionFromAwarenessState(room, state as Record<string, unknown>),
        lastSeen: typeof state.lastSeen === "number" ? state.lastSeen : Date.now(),
      });
    });
    collaborators.sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id));
    updateRuntimeSnapshot({ collaborators });
  };

  const projectWorkspace = (origin?: unknown) => {
    if (closed) return;
    if (!room.meta.has("schemaVersion")) return;
    const structure = validateWorkspaceRoomStructure(room, roomId);
    if (!structure.ok) {
      setStatus("failed");
      onOpenFailure?.("unsupported");
      emitInvalidMessage(structure.message);
      return;
    }
    const snapshot = getWorkspaceRoomSnapshot(room);
    const limits = validateWorkspaceRoomLimits(snapshot);
    if (!limits.ok) {
      setStatus("failed");
      emitInvalidMessage(limits.message);
      return;
    }
    hasHydratedWorkspace = true;
    onWorkspaceChange?.(
      snapshot,
      isRemoteSyncOrigin(origin) ? { actorId: origin.senderId } : undefined,
    );
    refreshTextObservers();
  };

  const refreshTextObservers = () => {
    for (const [id, observer] of textObservers) {
      const current = room.documents.get(id);
      if (current === observer.text) continue;
      observer.text.unobserve(observer.listener);
      textObservers.delete(id);
      undoManagers.get(id)?.destroy();
      undoManagers.delete(id);
    }
    room.documents.forEach((text, id) => {
      if (textObservers.has(id)) return;
      const listener = (event: Y.YTextEvent, transaction: Y.Transaction) => {
        const tracker = documentSizeTrackers.get(id) ?? new Utf8TextSizeTracker(text.toString());
        documentSizeTrackers.set(id, tracker);
        documentByteLengths.set(id, tracker.applyDelta(event.delta));
        refreshRoomContentByteLength();
        if (isRemoteSyncOrigin(transaction.origin) || transaction.origin === CHECKPOINT_ORIGIN) {
          remoteProjectionRevisions.set(id, (remoteProjectionRevisions.get(id) ?? 0) + 1);
          onTextChange(id, text.toString());
        }
        if (room.comments.size > 0) scheduleCommentProjection();
      };
      text.observe(listener);
      textObservers.set(id, { text, listener });
      if (!undoManagers.has(id)) undoManagers.set(id, new Y.UndoManager(text));
    });
    setEditorBinding(getEditorBinding(activeDocumentId));
  };

  const getEditorBinding = (nextDocumentId?: string | null): CollabEditorBinding | null => {
    if (!nextDocumentId) return null;
    const yText = room.documents.get(nextDocumentId);
    if (!yText) return null;
    let undoManager = undoManagers.get(nextDocumentId);
    if (!undoManager) {
      undoManager = new Y.UndoManager(yText);
      undoManagers.set(nextDocumentId, undoManager);
    }
    return {
      documentId: nextDocumentId,
      extension: [
        yCollab(yText, awareness, { undoManager }),
        keymap.of(yUndoManagerKeymap),
      ],
      yText,
      awareness,
      undoManager,
      canApplyTextByteDelta,
      consumeRemoteProjection: () => {
        const revision = remoteProjectionRevisions.get(nextDocumentId) ?? 0;
        const consumedRevision = consumedRemoteProjectionRevisions.get(nextDocumentId) ?? 0;
        if (revision <= consumedRevision) return false;
        consumedRemoteProjectionRevisions.set(nextDocumentId, revision);
        return true;
      },
    };
  };

  const getActiveActors = () => {
    const ids = new Set([currentIdentity.id]);
    awareness.getStates().forEach((state) => {
      const actor = state?.actor;
      if (isActor(actor)) ids.add(actor.id);
    });
    return [...ids].sort();
  };

  const isCheckpointLeader = () => getActiveActors()[0] === currentIdentity.id;

  const validateCheckpointUpdate = (update: Uint8Array) => {
    if (update.byteLength > ROOM_WIRE_MAX_CRDT_STATE_BYTES) {
      throw new Error("The collaboration state exceeds the supported size.");
    }
    const validationDoc = new Y.Doc();
    const validationRoom = createWorkspaceRoomCrdt({
      roomId,
      doc: validationDoc,
      initialize: false,
    });
    try {
      Y.applyUpdate(validationDoc, update);
      const structure = validateWorkspaceRoomStructure(validationRoom, roomId);
      if (!structure.ok) throw new Error(structure.message);
      const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(validationRoom));
      if (!limits.ok) throw new Error(limits.message);
    } finally {
      validationDoc.destroy();
    }
  };

  const clearCheckpointTimer = () => {
    if (!checkpointTimer) return;
    adapters.clock.clearTimeout(checkpointTimer);
    checkpointTimer = undefined;
  };

  const persistCurrentCheckpoint = async (expectedGeneration: number) => {
    if (!roomKey) return null;
    refreshAllDocumentByteLengths();
    const structure = validateWorkspaceRoomStructure(room, roomId);
    if (!structure.ok) return null;
    const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(room));
    if (!limits.ok) return null;
    const update = Y.encodeStateAsUpdate(room.doc);
    if (update.byteLength > ROOM_WIRE_MAX_CRDT_STATE_BYTES) {
      notifyCapacityExceeded();
      return null;
    }
    const encryptedCheckpoint = await encryptWorkspaceRoomCheckpoint({ roomId, update, roomKey });
    if (closed || abortController.signal.aborted) return null;
    return adapters.roomCheckpointStore.saveEncryptedCheckpoint(roomId, {
      expectedGeneration,
      encryptedCheckpoint,
      expiresAt: Date.now() + ROOM_CHECKPOINT_RETENTION_MS,
    }, abortController.signal);
  };

  const saveCheckpointNow = async (): Promise<void> => {
    clearCheckpointTimer();
    if (closed || !roomKey || !adapters.roomCheckpointStore.enabled || !isCheckpointLeader()) return;
    if (checkpointSaveInFlight) {
      checkpointSaveRequested = true;
      return;
    }
    checkpointSaveInFlight = true;
    try {
      const result = await persistCurrentCheckpoint(checkpointGeneration);
      if (!result) return;
      if (result.ok) {
        checkpointGeneration = result.generation;
      } else {
        const latest = await adapters.roomCheckpointStore.loadEncryptedCheckpoint(roomId, abortController.signal);
        if (latest?.status === "ready") {
          checkpointGeneration = latest.generation;
          const latestUpdate = await decryptWorkspaceRoomCheckpoint({
            encryptedCheckpoint: latest.encryptedCheckpoint,
            roomId,
            roomKey,
          });
          validateCheckpointUpdate(latestUpdate);
          Y.applyUpdate(room.doc, latestUpdate, CHECKPOINT_ORIGIN);
          const retried = await persistCurrentCheckpoint(checkpointGeneration);
          if (retried) checkpointGeneration = retried.generation;
        }
      }
    } catch {
      if (!abortController.signal.aborted) emitInvalidMessage("The encrypted live room could not be saved.");
    } finally {
      checkpointSaveInFlight = false;
      if (checkpointSaveRequested) {
        checkpointSaveRequested = false;
        void saveCheckpointNow();
      }
    }
  };

  const scheduleCheckpointSave = () => {
    if (closed || !roomKey || !adapters.roomCheckpointStore.enabled || !isCheckpointLeader()) return;
    clearCheckpointTimer();
    checkpointTimer = adapters.clock.setTimeout(() => {
      checkpointTimer = undefined;
      void saveCheckpointNow();
    }, CHECKPOINT_SAVE_DELAY_MS);
  };

  const sendPacket = (packet: RoomWireDataPacket, volatile = false) => {
    if (packet.type === "sync.message" && packet.payload.byteLength > ROOM_WIRE_MAX_CRDT_STATE_BYTES) {
      notifyCapacityExceeded();
      return;
    }
    outboundQueue = outboundQueue.then(async () => {
      if (closed || !roomKey || !transport?.connected) return;
      const packets = encodeRoomWirePackets(packet, adapters.clock.createId);
      for (const plaintext of packets) {
        if (closed || !transport?.connected) return;
        envelopeVersion += 1;
        const envelope = await adapters.crypto.encryptEnvelope(roomKey, roomId, "room-event", envelopeVersion, plaintext);
        if (closed || !transport?.connected) return;
        if (volatile) transport.sendVolatileEnvelope(envelope);
        else transport.sendEnvelope(envelope);
      }
    }).catch(() => emitInvalidMessage("A live collaboration update could not be sent."));
  };

  const sendSyncStep1 = () => {
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, room.doc);
    sendPacket({ type: "sync.message", senderId: currentIdentity.id, payload: encoding.toUint8Array(encoder) });
  };

  const publishAwareness = (clients = [awareness.clientID], volatile = true) => {
    const payload = encodeAwarenessUpdate(awareness, clients);
    sendPacket({ type: "awareness.updated", senderId: currentIdentity.id, payload }, volatile);
  };

  const setLocalAwareness = () => {
    const actor = getActor(currentIdentity);
    const nextState: Record<string, unknown> = {
      ...awareness.getLocalState(),
      actor,
      user: { name: actor.name, color: actor.color ?? "#2563eb", colorLight: `${actor.color ?? "#2563eb"}33` },
      lastSeen: Date.now(),
    };
    if (activeDocumentId) {
      nextState.activeDocumentId = activeDocumentId;
      nextState.fileTitle = currentFileTitle;
    } else {
      delete nextState.activeDocumentId;
      delete nextState.fileTitle;
    }
    awareness.setLocalState(nextState);
    if (!editorPresenceEnabled && awareness.getLocalState()?.cursor != null) {
      awareness.setLocalStateField("cursor", null);
    }
  };

  const getSenderActor = (senderId: string) => {
    for (const state of awareness.getStates().values()) {
      const actor = state?.actor;
      if (isActor(actor) && actor.id === senderId) return actor;
    }
    return null;
  };

  const handleSyncMessage = (packet: RoomWireDataPacket) => {
    const probe = decoding.createDecoder(packet.payload);
    const messageType = decoding.readVarUint(probe);
    const senderActor = getSenderActor(packet.senderId);
    if (
      messageType !== syncProtocol.messageYjsSyncStep1 &&
      (!senderActor || !hasRoomCapability(senderActor, "write"))
    ) return;
    const decoder = decoding.createDecoder(packet.payload);
    const reply = encoding.createEncoder();
    syncProtocol.readSyncMessage(decoder, reply, room.doc, {
      type: REMOTE_SYNC_ORIGIN,
      senderId: packet.senderId,
    } satisfies RemoteSyncOrigin, () => {
      emitInvalidMessage("A malformed collaboration update was ignored.");
    });
    if (encoding.length(reply) > 0) {
      sendPacket({ type: "sync.message", senderId: currentIdentity.id, payload: encoding.toUint8Array(reply) });
    }
  };

  const handleDataPacket = (packet: RoomWireDataPacket) => {
    if (packet.senderId === currentIdentity.id) return;
    if (packet.type === "awareness.updated") {
      applyAwarenessUpdate(awareness, packet.payload, REMOTE_AWARENESS_ORIGIN);
      return;
    }
    handleSyncMessage(packet);
  };

  const routeEnvelope = (value: unknown) => {
    inboundQueue = inboundQueue.then(async () => {
      if (closed || !roomKey) return;
      if (!isEncryptedEnvelope(value) || value.roomId !== roomId || value.kind !== "room-event") {
        emitInvalidMessage("A collaboration server message was ignored.");
        return;
      }
      try {
        const plaintext = await adapters.crypto.decryptEnvelope(roomKey, value);
        const decoded = decodeRoomWirePacket(plaintext);
        if (!decoded.ok) {
          if (decoded.reason === "unsupported") onOpenFailure?.("unsupported");
          emitInvalidMessage("An unsupported collaboration message was ignored.");
          return;
        }
        if (decoded.packet.type === "sync.chunk") {
          const assembled = chunkAssembler.push(decoded.packet);
          if (assembled) handleDataPacket(assembled);
        } else {
          handleDataPacket(decoded.packet);
        }
      } catch {
        emitInvalidMessage("An encrypted collaboration message could not be opened.");
      }
    });
  };

  const loadCheckpoint = async () => {
    if (!roomKey || !adapters.roomCheckpointStore.enabled) return true;
    const loaded = await adapters.roomCheckpointStore.loadEncryptedCheckpoint(roomId, abortController.signal);
    if (!loaded) return true;
    checkpointGeneration = loaded.generation;
    if (loaded.status === "expired") {
      onOpenFailure?.("expired");
      setStatus("failed");
      return false;
    }
    try {
      const update = await decryptWorkspaceRoomCheckpoint({
        encryptedCheckpoint: loaded.encryptedCheckpoint,
        roomId,
        roomKey,
      });
      validateCheckpointUpdate(update);
      Y.applyUpdate(room.doc, update, CHECKPOINT_ORIGIN);
      return true;
    } catch {
      onOpenFailure?.("unsupported");
      setStatus("failed");
      return false;
    }
  };

  const refreshAwarenessPeers = (peerIds: readonly string[]) => {
    const allowed = new Set(peerIds);
    const staleClientIds: number[] = [];
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === awareness.clientID) return;
      const actor = state?.actor;
      if (isActor(actor) && !allowed.has(actor.id)) staleClientIds.push(clientId);
    });
    if (staleClientIds.length > 0) removeAwarenessStates(awareness, staleClientIds, "transport.peers");
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
    if (!(await loadCheckpoint()) || closed || abortController.signal.aborted) return;
    refreshTextObservers();
    projectWorkspace();
    setLocalAwareness();

    transport = adapters.createRoomTransport({
      baseUrl: startConfig.baseUrl,
      roomId,
      clientId: currentIdentity.id,
      handlers: {
        onConnect: () => { if (!closed) setStatus("connecting"); },
        onJoined: () => {
          if (closed) return;
          const joined = sessionState.markJoined();
          setStatus("connected");
          if (joined.reconnected) emitRecoveryEvent("reconnected", joined.message);
          setLocalAwareness();
          publishAwareness([awareness.clientID], false);
          sendSyncStep1();
          if (checkpointGeneration === 0) void saveCheckpointNow();
          else scheduleCheckpointSave();
        },
        onPeerJoined: () => {
          if (closed) return;
          publishAwareness([awareness.clientID], false);
          sendSyncStep1();
        },
        onMessage: routeEnvelope,
        onPeers: (message) => {
          refreshAwarenessPeers(message.peers);
          publishCollaborators();
        },
        onError: (message) => emitInvalidMessage(message.error || "A collaboration server message was ignored."),
        onDisconnect: () => {
          if (closed) return;
          setStatus(sessionState.markOffline("disconnect").status);
        },
        onConnectError: () => {
          if (closed) return;
          const offline = sessionState.markOffline("connect-error");
          setStatus(offline.status);
        },
      },
    });
    if (closed || abortController.signal.aborted) {
      transport.disconnect();
      transport = null;
      return;
    }
    transport.connect();
    heartbeat = adapters.clock.setInterval(() => {
      if (closed) return;
      setLocalAwareness();
      publishAwareness();
      chunkAssembler.prune();
    }, AWARENESS_HEARTBEAT_MS);
  };

  const handleDocumentUpdate = (update: Uint8Array, origin: unknown) => {
    if (closed || isRemoteSyncOrigin(origin) || origin === CHECKPOINT_ORIGIN) return;
    const encoder = encoding.createEncoder();
    syncProtocol.writeUpdate(encoder, update);
    sendPacket({ type: "sync.message", senderId: currentIdentity.id, payload: encoding.toUint8Array(encoder) });
    scheduleCheckpointSave();
  };

  let projectionQueued = false;
  let queuedWorkspaceOrigin: unknown;
  const queueWorkspaceProjection = (origin?: unknown) => {
    if (closed) return;
    if (isRemoteSyncOrigin(origin)) queuedWorkspaceOrigin = origin;
    else if (queuedWorkspaceOrigin === undefined) queuedWorkspaceOrigin = origin;
    if (projectionQueued) return;
    projectionQueued = true;
    queueMicrotask(() => {
      projectionQueued = false;
      const nextOrigin = queuedWorkspaceOrigin;
      queuedWorkspaceOrigin = undefined;
      if (!closed) projectWorkspace(nextOrigin);
    });
  };
  const handleDocumentsChange = (_event: unknown, transaction: Y.Transaction) => {
    refreshAllDocumentByteLengths();
    refreshTextObservers();
    queueWorkspaceProjection(transaction.origin);
  };
  const handleWorkspaceStructureChange = (_event: unknown, transaction: Y.Transaction) =>
    queueWorkspaceProjection(transaction.origin);
  const handleCommentsChange = () => {
    refreshCommentByteLength();
    scheduleCommentProjection();
  };

  const handleAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    publishCollaborators();
    if (origin !== REMOTE_AWARENESS_ORIGIN && !closed) {
      publishAwareness([...changes.added, ...changes.updated, ...changes.removed]);
    }
  };

  room.doc.on("update", handleDocumentUpdate);
  room.documents.observe(handleDocumentsChange);
  room.meta.observe(handleWorkspaceStructureChange);
  room.nodes.observeDeep(handleWorkspaceStructureChange);
  room.comments.observeDeep(handleCommentsChange);
  awareness.on("update", handleAwarenessUpdate);
  refreshTextObservers();
  setStatus("connecting");
  void start().catch(() => {
    if (!closed && !abortController.signal.aborted) {
      setStatus("failed");
      onOpenFailure?.("invalid");
    }
  });

  const setWorkspace = ({
    documents: nextDocuments,
    folders: nextFolders = [],
  }: {
    documents: readonly WorkspaceDocumentSnapshot[];
    folders?: readonly WorkspaceFolderSnapshot[];
  }) => {
    if (closed || (!emitInitialWorkspaceState && !hasHydratedWorkspace)) return;
    const candidateIds = [
      ...nextFolders.filter((folder) => folder.id !== WORKSPACE_ROOM_ROOT_ID).map((folder) => folder.id),
      ...nextDocuments.map((document) => document.id),
    ];
    if (new Set(candidateIds).size !== candidateIds.length) return false;
    const validationDoc = new Y.Doc();
    const validationRoom = createWorkspaceRoomCrdt({ roomId, doc: validationDoc });
    try {
      const documentIds = new Set(nextDocuments.map((document) => document.id));
      initializeWorkspaceRoomCrdt(validationRoom, {
        nodes: [
          ...nextFolders.filter((folder) => folder.id !== WORKSPACE_ROOM_ROOT_ID).map((folder) => ({
            ...folder,
            type: "folder" as const,
          })),
          ...nextDocuments.map((document) => ({
            ...document,
            type: "document" as const,
            markdown: room.documents.get(document.id)?.toString() ?? document.text,
          })),
        ],
        comments: commentsToList(getWorkspaceRoomComments(room)).filter((comment) => documentIds.has(comment.fileId)),
      });
      const structure = validateWorkspaceRoomStructure(validationRoom, roomId);
      const limits = structure.ok
        ? validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(validationRoom))
        : structure;
      if (!limits.ok) {
        emitInvalidMessage(limits.message);
        return false;
      }
    } finally {
      validationDoc.destroy();
    }
    const desiredIds = new Set<string>([WORKSPACE_ROOM_ROOT_ID]);
    room.doc.transact(() => {
      for (const folder of nextFolders) {
        if (folder.id === WORKSPACE_ROOM_ROOT_ID) continue;
        desiredIds.add(folder.id);
        if (!room.nodes.has(folder.id)) createWorkspaceRoomFolder(room, folder);
        else {
          renameWorkspaceRoomNode(room, folder.id, folder.title);
          moveWorkspaceRoomNode(room, folder.id, folder.parentId ?? WORKSPACE_ROOM_ROOT_ID);
          setWorkspaceRoomNodeOrder(room, folder.id, folder.order ?? 0);
        }
      }
      for (const document of nextDocuments) {
        desiredIds.add(document.id);
        if (!room.nodes.has(document.id)) {
          createWorkspaceRoomDocument(room, { ...document, markdown: document.text });
        } else {
          renameWorkspaceRoomNode(room, document.id, document.title);
          moveWorkspaceRoomNode(room, document.id, document.parentId ?? WORKSPACE_ROOM_ROOT_ID);
          setWorkspaceRoomNodeOrder(room, document.id, document.order ?? 0);
        }
      }
      for (const nodeId of room.nodes.keys()) {
        if (!desiredIds.has(nodeId)) deleteWorkspaceRoomNode(room, nodeId);
      }
    }, "tabula.workspace.reconcile");
    return true;
  };

  const setActiveDocument = (nextDocument: { documentId: string; fileTitle?: string } | null) => {
    activeDocumentId = nextDocument?.documentId ?? null;
    currentFileTitle = nextDocument?.fileTitle;
    awareness.setLocalStateField("cursor", null);
    setLocalAwareness();
    setEditorBinding(getEditorBinding(activeDocumentId));
  };

  return {
    subscribe(listener: () => void) {
      runtimeListeners.add(listener);
      return () => runtimeListeners.delete(listener);
    },
    getSnapshot() {
      return runtimeSnapshot;
    },
    applyLocalText(nextText: string, patches?: readonly TextPatch[]) {
      if (!activeDocumentId) return false;
      const text = getWorkspaceRoomDocument(room, activeDocumentId);
      if (!text) return false;
      const currentText = text.toString();
      const patchedText = patches?.length ? applyTextPatchesToString(currentText, patches) : nextText;
      const byteDelta = utf8Encoder.encode(nextText).byteLength -
        (documentByteLengths.get(activeDocumentId) ?? utf8Encoder.encode(currentText).byteLength);
      if (!canApplyTextByteDelta(byteDelta)) return false;
      room.doc.transact(() => {
        if (patches?.length && patchedText === nextText) applyTextPatches(text, patches);
        else if (text.toString() !== nextText) {
          if (text.length) text.delete(0, text.length);
          if (nextText) text.insert(0, nextText);
        }
      }, "tabula.text.local");
      return true;
    },
    applyLocalTextPatches(patches: readonly TextPatch[]) {
      if (patches.length === 0) return true;
      if (!activeDocumentId) return false;
      const text = getWorkspaceRoomDocument(room, activeDocumentId);
      if (!text) return false;
      const currentText = text.toString();
      const nextText = applyTextPatchesToString(currentText, patches);
      if (nextText === null) return false;
      const byteDelta = utf8Encoder.encode(nextText).byteLength -
        (documentByteLengths.get(activeDocumentId) ?? utf8Encoder.encode(currentText).byteLength);
      if (!canApplyTextByteDelta(byteDelta)) return false;
      room.doc.transact(() => applyTextPatches(text, patches), "tabula.text.local");
      return true;
    },
    setActiveDocument,
    setEditorPresenceEnabled(enabled: boolean) {
      editorPresenceEnabled = enabled;
      if (!enabled) awareness.setLocalStateField("cursor", null);
    },
    setWorkspaceDocuments(nextDocuments: readonly WorkspaceDocumentSnapshot[], nextFolders?: readonly WorkspaceFolderSnapshot[]) {
      setWorkspace({ documents: nextDocuments, folders: nextFolders });
    },
    setIdentity(nextIdentity: Collaborator) {
      currentIdentity = {
        ...nextIdentity,
        joinedAt: nextIdentity.joinedAt ?? currentIdentity.joinedAt ?? adapters.clock.nowIso(),
      };
      setLocalAwareness();
    },
    getEditorBinding: () => getEditorBinding(activeDocumentId),
    upsertComment(comment: WorkspaceRoomComment) {
      const current = room.comments.get(comment.id);
      const currentBody = typeof current?.get("body") === "string" ? current.get("body") as string : "";
      const currentReplies = current?.get("replies");
      let currentReplyBytes = 0;
      if (currentReplies instanceof Y.Map) {
        currentReplies.forEach((reply) => {
          if (reply instanceof Y.Map && typeof reply.get("body") === "string") {
            currentReplyBytes += utf8Encoder.encode(reply.get("body") as string).byteLength;
          }
        });
      }
      const nextBytes = utf8Encoder.encode(comment.body.trim()).byteLength + comment.replies.reduce(
        (total, reply) => total + utf8Encoder.encode(reply.body).byteLength,
        0,
      );
      const byteDelta = nextBytes - utf8Encoder.encode(currentBody).byteLength - currentReplyBytes;
      if (!canApplyTextByteDelta(byteDelta)) return false;
      let applied = false;
      room.doc.transact(() => {
        applied = setWorkspaceRoomComment(room, comment);
      }, "tabula.comment.upsert");
      return applied;
    },
    deleteComment(commentId: string) {
      room.doc.transact(() => deleteWorkspaceRoomComment(room, commentId), "tabula.comment.delete");
    },
    setCommentResolved(commentId: string, resolved: boolean) {
      room.doc.transact(() => setWorkspaceRoomCommentResolved(room, commentId, resolved), "tabula.comment.resolve");
    },
    addCommentReply(commentId: string, reply: WorkspaceRoomCommentReply) {
      if (!canApplyTextByteDelta(utf8Encoder.encode(reply.body.trim()).byteLength)) return false;
      let applied = false;
      room.doc.transact(() => {
        applied = addWorkspaceRoomCommentReply(room, commentId, reply);
      }, "tabula.comment.reply");
      return applied;
    },
    disconnect() {
      if (closed) return;
      closed = true;
      abortController.abort();
      clearCheckpointTimer();
      if (commentProjectionTimer) adapters.clock.clearTimeout(commentProjectionTimer);
      commentProjectionTimer = undefined;
      if (heartbeat) adapters.clock.clearInterval(heartbeat);
      room.doc.off("update", handleDocumentUpdate);
      room.documents.unobserve(handleDocumentsChange);
      room.meta.unobserve(handleWorkspaceStructureChange);
      room.nodes.unobserveDeep(handleWorkspaceStructureChange);
      room.comments.unobserveDeep(handleCommentsChange);
      awareness.off("update", handleAwarenessUpdate);
      const localState = awareness.getLocalState();
      if (localState && transport?.connected && roomKey) {
        removeAwarenessStates(awareness, [awareness.clientID], "tabula.disconnect");
      }
      transport?.disconnect();
      transport = null;
      chunkAssembler.clear();
      for (const observer of textObservers.values()) observer.text.unobserve(observer.listener);
      textObservers.clear();
      documentByteLengths.clear();
      documentSizeTrackers.clear();
      remoteProjectionRevisions.clear();
      consumedRemoteProjectionRevisions.clear();
      for (const undoManager of undoManagers.values()) undoManager.destroy();
      undoManagers.clear();
      awareness.destroy();
      room.doc.destroy();
      runtimeSnapshot = { status: "disconnected", collaborators: [], editorBinding: null };
      runtimeListeners.forEach((listener) => listener());
      runtimeListeners.clear();
    },
    flushRecoveryState() {
      void saveCheckpointNow();
    },
  };
};

export type WorkspaceRoomRuntime = ReturnType<typeof createWorkspaceRoomRuntime>;
