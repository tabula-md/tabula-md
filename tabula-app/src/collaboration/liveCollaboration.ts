import type { Extension } from "@codemirror/state";
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
  validateWorkspaceRoomStructureLimits,
  validateWorkspaceRoomStructure,
  ROOM_WIRE_MAX_CRDT_STATE_BYTES,
  ROOM_WIRE_CHUNK_BYTES,
  WORKSPACE_ROOM_MAX_COMMENT_LENGTH,
  WORKSPACE_ROOM_MAX_COMMENTS,
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_MAX_DOCUMENTS,
  WORKSPACE_ROOM_MAX_FOLDERS,
  WORKSPACE_ROOM_MAX_REPLIES,
  WORKSPACE_ROOM_ROOT_ID,
  type RoomActor,
  type RoomActorClient,
  type RoomActorKind,
  type RoomCapability,
  type RoomWireDataPacket,
  type EncryptedEnvelope,
  type TextPatch,
  type WorkspaceRoomComment,
  type WorkspaceRoomCommentReply,
  type WorkspaceRoomCrdt,
  type WorkspaceRoomSnapshot,
  type WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";
import { isEncryptedEnvelope } from "./collabConnectionModel";
import { getCollaboratorDisplayList } from "./collabCollaborators";
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
import {
  createRoomDocumentRegistry,
  type RoomDocumentLease,
  type RoomDocumentResource,
} from "./runtime/RoomDocumentRegistry";
import { createRoomStructureStore } from "./runtime/RoomStructureStore";

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

type SendPacketResult = "sent" | "offline" | "failed" | "discarded";

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
  actorName?: string;
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

export type WorkspaceRoomDocumentCommand = {
  id: string;
  title: string;
  markdown?: string;
  parentId?: string | null;
  order?: number;
};

export type WorkspaceRoomFolderCommand = {
  id: string;
  title: string;
  parentId?: string | null;
  order?: number;
};

type ConnectOptions = {
  roomId: string;
  roomKey: string;
  documentId?: string;
  documents?: readonly WorkspaceDocumentSnapshot[];
  folders?: readonly WorkspaceFolderSnapshot[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
  emitInitialWorkspaceState: boolean;
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
const TEXT_PROJECTION_DELAY_MS = 16;
const COMMENT_PROJECTION_DELAY_MS = 16;
const INVALID_MESSAGE_NOTICE_INTERVAL_MS = 5_000;
const MAX_INBOUND_ENVELOPES = 64;
const MAX_INBOUND_BUFFER_CHARS = 32 * 1024 * 1024;
const MAX_ENCRYPTED_ENVELOPE_CHARS = Math.ceil((ROOM_WIRE_CHUNK_BYTES + 2_048) * 4 / 3);
const CRDT_STATE_SIZE_CHECK_INTERVAL = 500;
const CRDT_STATE_WARNING_BYTES = Math.floor(ROOM_WIRE_MAX_CRDT_STATE_BYTES * 0.9);
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
  emitInitialWorkspaceState,
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
  const documentRegistry = createRoomDocumentRegistry({ awareness, documents: room.documents });
  const structureStore = createRoomStructureStore(room);
  const documentByteLengths = new Map<string, number>();
  const documentSizeTrackers = new Map<string, Utf8TextSizeTracker>();
  const indexedDocumentTexts = new Map<string, Y.Text>();
  const documentIdsByText = new WeakMap<Y.Text, string>();
  const remoteProjectionRevisions = new Map<string, number>();
  const consumedRemoteProjectionRevisions = new Map<string, number>();
  let activeDocumentLease: RoomDocumentLease | null = null;
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
  let stateSizeCheckTimer: unknown;
  let textProjectionTimer: unknown;
  let commentProjectionTimer: unknown;
  let checkpointGeneration = 0;
  let checkpointSaveInFlight = false;
  let checkpointSaveRequested = false;
  let envelopeVersion = 0;
  let closed = false;
  let hasHydratedWorkspace = false;
  let outboundQueue: Promise<SendPacketResult> = Promise.resolve("sent");
  let pendingLocalUpdate: Uint8Array | null = null;
  let localUpdateSendInFlight = false;
  let awarenessSendInFlight = false;
  let pendingAwarenessReliable = false;
  let syncStep1SendInFlight = false;
  let syncStep1Pending = false;
  const pendingAwarenessClients = new Set<number>();
  const inboundEnvelopes: Array<{ envelope: EncryptedEnvelope; bufferedChars: number }> = [];
  const pendingTextProjectionIds = new Set<string>();
  let inboundBufferedChars = 0;
  let inboundProcessing = false;
  let lastInvalidMessageNoticeAt = 0;
  let capacityExceededNotified = false;
  let updatesSinceStateSizeCheck = 0;
  let runtimeSnapshot: WorkspaceRoomRuntimeSnapshot = {
    status: "connecting",
    collaborators: [],
    editorBinding: null,
  };
  const runtimeListeners = new Set<() => void>();
  let commentByteLength = 0;
  let commentsWithinLimits = true;
  let roomContentByteLength = 0;

  const refreshCommentMetrics = () => {
    const comments = Object.values(getWorkspaceRoomComments(room)).flat();
    commentsWithinLimits =
      comments.length <= WORKSPACE_ROOM_MAX_COMMENTS &&
      comments.every((comment) =>
        comment.body.length <= WORKSPACE_ROOM_MAX_COMMENT_LENGTH &&
        comment.replies.length <= WORKSPACE_ROOM_MAX_REPLIES &&
        comment.replies.every((reply) => reply.body.length <= WORKSPACE_ROOM_MAX_COMMENT_LENGTH),
      );
    commentByteLength = comments.reduce(
      (total, comment) => total + utf8Encoder.encode(comment.body).byteLength +
        comment.replies.reduce((replyTotal, reply) => replyTotal + utf8Encoder.encode(reply.body).byteLength, 0),
      0,
    );
  };

  const refreshRoomContentByteLength = () => {
    roomContentByteLength = commentByteLength;
    for (const byteLength of documentByteLengths.values()) roomContentByteLength += byteLength;
  };

  const syncDocumentMetrics = () => {
    const currentDocumentIds = new Set<string>();
    room.documents.forEach((text, id) => {
      currentDocumentIds.add(id);
      documentIdsByText.set(text, id);
      if (indexedDocumentTexts.get(id) === text && documentSizeTrackers.has(id)) return;
      indexedDocumentTexts.set(id, text);
      const nextTracker = new Utf8TextSizeTracker(text.toString());
      documentSizeTrackers.set(id, nextTracker);
      documentByteLengths.set(id, nextTracker.byteLength);
    });
    for (const id of [...indexedDocumentTexts.keys()]) {
      if (currentDocumentIds.has(id)) continue;
      indexedDocumentTexts.delete(id);
      documentSizeTrackers.delete(id);
      documentByteLengths.delete(id);
      remoteProjectionRevisions.delete(id);
      consumedRemoteProjectionRevisions.delete(id);
    }
    documentRegistry.sync();
    refreshRoomContentByteLength();
  };

  const refreshCommentByteLength = () => {
    refreshCommentMetrics();
    refreshRoomContentByteLength();
  };

  const scheduleTextProjection = (documentId: string) => {
    if (documentId !== activeDocumentId) return;
    pendingTextProjectionIds.add(documentId);
    if (textProjectionTimer || closed) return;
    textProjectionTimer = adapters.clock.setTimeout(() => {
      textProjectionTimer = undefined;
      const documentIds = [...pendingTextProjectionIds];
      pendingTextProjectionIds.clear();
      if (closed) return;
      for (const id of documentIds) {
        if (id !== activeDocumentId) continue;
        const text = room.documents.get(id);
        if (text) onTextChange(id, text.toString());
      }
    }, TEXT_PROJECTION_DELAY_MS);
  };

  const scheduleCommentProjection = () => {
    if (!onCommentsChange || commentProjectionTimer || closed) return;
    commentProjectionTimer = adapters.clock.setTimeout(() => {
      commentProjectionTimer = undefined;
      if (!closed) onCommentsChange(getWorkspaceRoomComments(room));
    }, COMMENT_PROJECTION_DELAY_MS);
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
      ? documents
      : [{
          id: documentId,
          title: fileTitle ?? "Untitled",
          text: "",
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
  structureStore.refresh();
  syncDocumentMetrics();
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

  const getAwarenessActors = () => {
    const actors = new Map<string, RoomActor>();
    awareness.getStates().forEach((state) => {
      const actor = state?.actor;
      if (isActor(actor)) actors.set(actor.id, actor);
    });
    const localActor = getActor(currentIdentity);
    actors.set(localActor.id, localActor);
    return [...actors.values()];
  };

  const getActorDisplay = (actorId: string) =>
    getCollaboratorDisplayList(getAwarenessActors()).find((actor) => actor.id === actorId);

  const getSenderActor = (senderId: string) => {
    for (const state of awareness.getStates().values()) {
      const actor = state?.actor;
      if (isActor(actor) && actor.id === senderId) return actor;
    }
    return null;
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
    structureStore.refresh();
    const structureLimits = validateWorkspaceRoomStructureLimits(structureStore.getSnapshot());
    if (!structureLimits.ok) {
      setStatus("failed");
      emitInvalidMessage(structureLimits.message);
      return;
    }
    if (!commentsWithinLimits || roomContentByteLength > WORKSPACE_ROOM_MAX_CONTENT_BYTES) {
      setStatus("failed");
      emitInvalidMessage("This live workspace exceeds the supported content limits.");
      return;
    }
    hasHydratedWorkspace = true;
    const remoteActor = isRemoteSyncOrigin(origin) ? getSenderActor(origin.senderId) : null;
    if (onWorkspaceChange) {
      onWorkspaceChange(getWorkspaceRoomSnapshot(room), isRemoteSyncOrigin(origin)
        ? {
            actorId: origin.senderId,
            actorName: getActorDisplay(origin.senderId)?.name ?? remoteActor?.name,
          }
        : undefined);
    }
    refreshActiveEditorBinding();
  };

  const createEditorBinding = (resource: RoomDocumentResource): CollabEditorBinding => {
    const { documentId: nextDocumentId, extension, yText, undoManager } = resource;
    return {
      documentId: nextDocumentId,
      extension,
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

  const refreshActiveEditorBinding = () => {
    const currentResource = activeDocumentLease?.resource;
    const nextText = activeDocumentId ? room.documents.get(activeDocumentId) : undefined;
    if (
      currentResource &&
      currentResource.documentId === activeDocumentId &&
      currentResource.yText === nextText
    ) {
      return;
    }
    activeDocumentLease?.release();
    activeDocumentLease = activeDocumentId ? documentRegistry.acquire(activeDocumentId) : null;
    setEditorBinding(activeDocumentLease ? createEditorBinding(activeDocumentLease.resource) : null);
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
    const structure = validateWorkspaceRoomStructure(room, roomId);
    if (!structure.ok) return null;
    if (!commentsWithinLimits || roomContentByteLength > WORKSPACE_ROOM_MAX_CONTENT_BYTES) return null;
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
      return Promise.resolve<SendPacketResult>("discarded");
    }
    const task: Promise<SendPacketResult> = outboundQueue.then(async () => {
      if (closed || !roomKey || !transport?.connected) return "offline";
      const packets = encodeRoomWirePackets(packet, adapters.clock.createId);
      for (const plaintext of packets) {
        if (closed || !transport?.connected) return "offline";
        envelopeVersion += 1;
        const envelope = await adapters.crypto.encryptEnvelope(roomKey, roomId, "room-event", envelopeVersion, plaintext);
        if (closed || !transport?.connected) return "offline";
        if (volatile) transport.sendVolatileEnvelope(envelope);
        else transport.sendEnvelope(envelope);
      }
      return "sent";
    });
    outboundQueue = task.catch(() => {
      emitInvalidMessage("A live collaboration update could not be sent.");
      return "failed";
    });
    return outboundQueue;
  };

  const flushSyncStep1 = () => {
    if (closed || syncStep1SendInFlight || !syncStep1Pending) return;
    syncStep1Pending = false;
    syncStep1SendInFlight = true;
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, room.doc);
    void sendPacket({
      type: "sync.message",
      senderId: currentIdentity.id,
      payload: encoding.toUint8Array(encoder),
    }).finally(() => {
      syncStep1SendInFlight = false;
      flushSyncStep1();
    });
  };

  const sendSyncStep1 = () => {
    syncStep1Pending = true;
    flushSyncStep1();
  };

  const flushAwareness = () => {
    if (closed || awarenessSendInFlight || pendingAwarenessClients.size === 0) return;
    const clients = [...pendingAwarenessClients];
    const volatile = !pendingAwarenessReliable;
    pendingAwarenessClients.clear();
    pendingAwarenessReliable = false;
    awarenessSendInFlight = true;
    const payload = encodeAwarenessUpdate(awareness, clients);
    void sendPacket({ type: "awareness.updated", senderId: currentIdentity.id, payload }, volatile)
      .finally(() => {
        awarenessSendInFlight = false;
        flushAwareness();
      });
  };

  const publishAwareness = (clients = [awareness.clientID], volatile = true) => {
    for (const clientId of clients) pendingAwarenessClients.add(clientId);
    if (!volatile) pendingAwarenessReliable = true;
    flushAwareness();
  };

  const flushLocalUpdates = () => {
    if (closed || localUpdateSendInFlight || !pendingLocalUpdate || !transport?.connected) return;
    const update = pendingLocalUpdate;
    pendingLocalUpdate = null;
    localUpdateSendInFlight = true;
    const encoder = encoding.createEncoder();
    syncProtocol.writeUpdate(encoder, update);
    void sendPacket({
      type: "sync.message",
      senderId: currentIdentity.id,
      payload: encoding.toUint8Array(encoder),
    }).then((result) => {
      if (result === "offline" && !closed) {
        pendingLocalUpdate = pendingLocalUpdate
          ? Y.mergeUpdates([update, pendingLocalUpdate])
          : update;
      }
    }).finally(() => {
      localUpdateSendInFlight = false;
      flushLocalUpdates();
    });
  };

  const setLocalAwareness = () => {
    const actor = getActor(currentIdentity);
    const displayActor = getActorDisplay(actor.id) ?? actor;
    const displayColor = displayActor.color ?? "#2563eb";
    const nextState: Record<string, unknown> = {
      ...awareness.getLocalState(),
      actor,
      user: { name: displayActor.name, color: displayColor, colorLight: `${displayColor}33` },
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

  const handleSyncMessage = async (packet: RoomWireDataPacket) => {
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
      await sendPacket({
        type: "sync.message",
        senderId: currentIdentity.id,
        payload: encoding.toUint8Array(reply),
      });
    }
  };

  const handleDataPacket = async (packet: RoomWireDataPacket) => {
    if (packet.senderId === currentIdentity.id) return;
    if (packet.type === "awareness.updated") {
      applyAwarenessUpdate(awareness, packet.payload, REMOTE_AWARENESS_ORIGIN);
      return;
    }
    await handleSyncMessage(packet);
  };

  const processEnvelope = async (envelope: EncryptedEnvelope) => {
    if (closed || !roomKey) return;
    try {
      const plaintext = await adapters.crypto.decryptEnvelope(roomKey, envelope);
      const decoded = decodeRoomWirePacket(plaintext);
      if (!decoded.ok) {
        if (decoded.reason === "unsupported") onOpenFailure?.("unsupported");
        emitInvalidMessage("An unsupported collaboration message was ignored.");
        return;
      }
      if (decoded.packet.type === "sync.chunk") {
        const assembled = chunkAssembler.push(decoded.packet);
        if (assembled) await handleDataPacket(assembled);
      } else {
        await handleDataPacket(decoded.packet);
      }
    } catch {
      emitInvalidMessage("An encrypted collaboration message could not be opened.");
    }
  };

  const drainInboundEnvelopes = async () => {
    if (inboundProcessing) return;
    inboundProcessing = true;
    try {
      while (!closed && inboundEnvelopes.length > 0) {
        const next = inboundEnvelopes.shift()!;
        inboundBufferedChars -= next.bufferedChars;
        await processEnvelope(next.envelope);
      }
    } finally {
      inboundProcessing = false;
    }
  };

  const routeEnvelope = (value: unknown) => {
    if (closed) return;
    if (!isEncryptedEnvelope(value) || value.roomId !== roomId || value.kind !== "room-event") {
      emitInvalidMessage("A collaboration server message was ignored.");
      return;
    }
    const bufferedChars = value.ciphertext.length + value.iv.length;
    if (
      value.ciphertext.length > MAX_ENCRYPTED_ENVELOPE_CHARS ||
      inboundEnvelopes.length >= MAX_INBOUND_ENVELOPES ||
      inboundBufferedChars + bufferedChars > MAX_INBOUND_BUFFER_CHARS
    ) {
      emitInvalidMessage("An oversized collaboration message was ignored.");
      return;
    }
    inboundEnvelopes.push({ envelope: value, bufferedChars });
    inboundBufferedChars += bufferedChars;
    void drainInboundEnvelopes();
  };

  const loadCheckpoint = async () => {
    if (!roomKey) return false;
    if (!adapters.roomCheckpointStore.enabled) {
      if (emitInitialWorkspaceState) return true;
      onOpenFailure?.("invalid");
      setStatus("failed");
      return false;
    }
    const loaded = await adapters.roomCheckpointStore.loadEncryptedCheckpoint(roomId, abortController.signal);
    if (!loaded) {
      if (emitInitialWorkspaceState) return true;
      onOpenFailure?.("invalid");
      setStatus("failed");
      return false;
    }
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
    syncDocumentMetrics();
    refreshActiveEditorBinding();
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
          flushLocalUpdates();
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
    if (closed) return;
    scheduleStateSizeCheck();
    if (isRemoteSyncOrigin(origin) || origin === CHECKPOINT_ORIGIN) return;
    pendingLocalUpdate = pendingLocalUpdate ? Y.mergeUpdates([pendingLocalUpdate, update]) : update;
    flushLocalUpdates();
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
  const handleDocumentsChange = (
    events: Y.YEvent<Y.AbstractType<unknown>>[],
    transaction: Y.Transaction,
  ) => {
    const structureChanged = events.some((event) => event.target === room.documents);
    if (structureChanged) {
      syncDocumentMetrics();
      refreshActiveEditorBinding();
      queueWorkspaceProjection(transaction.origin);
    }
    for (const event of events) {
      if (!(event instanceof Y.YTextEvent)) continue;
      const text = event.target;
      const id = documentIdsByText.get(text);
      if (!id) continue;
      const tracker = documentSizeTrackers.get(id) ?? new Utf8TextSizeTracker(text.toString());
      documentSizeTrackers.set(id, tracker);
      documentByteLengths.set(id, tracker.applyDelta(event.delta));
      if (isRemoteSyncOrigin(transaction.origin) || transaction.origin === CHECKPOINT_ORIGIN) {
        remoteProjectionRevisions.set(id, (remoteProjectionRevisions.get(id) ?? 0) + 1);
      }
      scheduleTextProjection(id);
      if (id === activeDocumentId && room.comments.size > 0) scheduleCommentProjection();
    }
    refreshRoomContentByteLength();
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
    if (origin === REMOTE_AWARENESS_ORIGIN && !closed) {
      const localState = awareness.getLocalState();
      const currentUser = localState?.user;
      const currentDisplayName = currentUser && typeof currentUser === "object"
        ? (currentUser as Record<string, unknown>).name
        : undefined;
      const currentDisplayColor = currentUser && typeof currentUser === "object"
        ? (currentUser as Record<string, unknown>).color
        : undefined;
      const nextDisplay = getActorDisplay(currentIdentity.id) ?? currentIdentity;
      if (currentDisplayName !== nextDisplay.name || currentDisplayColor !== nextDisplay.color) {
        setLocalAwareness();
      }
    }
    if (origin !== REMOTE_AWARENESS_ORIGIN && !closed) {
      publishAwareness([...changes.added, ...changes.updated, ...changes.removed]);
    }
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
    if (activeDocumentId) {
      const text = room.documents.get(activeDocumentId);
      if (text) onTextChange(activeDocumentId, text.toString());
      if (room.comments.size > 0) scheduleCommentProjection();
    }
    refreshActiveEditorBinding();
  };

  const canCreateNode = (type: "document" | "folder") => {
    const structure = structureStore.getSnapshot();
    const currentCount = structure.nodes.filter((node) => node.type === type).length -
      (type === "folder" ? 1 : 0);
    return type === "document"
      ? currentCount < WORKSPACE_ROOM_MAX_DOCUMENTS
      : currentCount < WORKSPACE_ROOM_MAX_FOLDERS;
  };

  const createDocument = (input: WorkspaceRoomDocumentCommand) => {
    const markdown = input.markdown ?? "";
    if (
      !canCreateNode("document") ||
      !canApplyTextByteDelta(utf8Encoder.encode(markdown).byteLength)
    ) {
      return false;
    }
    return createWorkspaceRoomDocument(room, { ...input, markdown });
  };

  const createFolder = (input: WorkspaceRoomFolderCommand) => {
    if (!canCreateNode("folder")) return false;
    return createWorkspaceRoomFolder(room, input);
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
    createDocument,
    createFolder,
    renameNode(nodeId: string, title: string) {
      return renameWorkspaceRoomNode(room, nodeId, title);
    },
    moveNode(nodeId: string, parentId: string) {
      return moveWorkspaceRoomNode(room, nodeId, parentId);
    },
    setNodeOrder(nodeId: string, order: number) {
      return setWorkspaceRoomNodeOrder(room, nodeId, order);
    },
    deleteNode(nodeId: string) {
      if (!room.nodes.has(nodeId) || nodeId === WORKSPACE_ROOM_ROOT_ID) return false;
      deleteWorkspaceRoomNode(room, nodeId);
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
    getEditorBinding: () => runtimeSnapshot.editorBinding,
    materializeDocument(documentId: string) {
      return room.documents.get(documentId)?.toString() ?? null;
    },
    materializeWorkspace: () => getWorkspaceRoomSnapshot(room),
    getResourceCounts: () => ({
      documentObservers: 1,
      ...documentRegistry.getResourceCounts(),
    }),
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
      const localState = awareness.getLocalState();
      if (localState && transport?.connected && roomKey) {
        removeAwarenessStates(awareness, [awareness.clientID], "tabula.disconnect");
      }
      transport?.disconnect();
      transport = null;
      pendingLocalUpdate = null;
      pendingAwarenessClients.clear();
      syncStep1Pending = false;
      pendingTextProjectionIds.clear();
      inboundEnvelopes.length = 0;
      inboundBufferedChars = 0;
      chunkAssembler.clear();
      activeDocumentLease?.release();
      activeDocumentLease = null;
      documentRegistry.dispose();
      structureStore.dispose();
      documentByteLengths.clear();
      documentSizeTrackers.clear();
      indexedDocumentTexts.clear();
      remoteProjectionRevisions.clear();
      consumedRemoteProjectionRevisions.clear();
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
