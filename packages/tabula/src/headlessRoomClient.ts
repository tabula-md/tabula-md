import * as Y from "yjs";
import { Awareness, removeAwarenessStates } from "y-protocols/awareness";
import { getCrypto, importEncryptionKey } from "./data/encryption";
import {
  parseRoomActor,
  type RoomActor,
} from "./roomCollaboration";
import {
  getTextPatchesForChange,
  type TextPatch,
} from "./textPatches";
import {
  parseRoomShareUrl,
  ROOM_KEY_BYTES,
} from "./roomShareLinkModel";
import {
  ROOM_CHECKPOINT_RETENTION_MS,
  decryptWorkspaceRoomCheckpoint,
  encryptWorkspaceRoomCheckpoint,
  type WorkspaceRoomCheckpointStore,
} from "./workspaceRoomCheckpoint";
import {
  addWorkspaceRoomCommentReply,
  createWorkspaceRoomCrdt,
  createWorkspaceRoomDocument,
  createWorkspaceRoomFolder,
  deleteWorkspaceRoomComment,
  deleteWorkspaceRoomNode,
  getWorkspaceRoomSnapshot,
  getWorkspaceRoomStructureSnapshot,
  initializeWorkspaceRoomCrdt,
  moveWorkspaceRoomNode,
  renameWorkspaceRoomNode,
  setWorkspaceRoomComment,
  setWorkspaceRoomCommentResolved,
  validateWorkspaceRoomStructure,
  type WorkspaceRoomCrdt,
} from "./workspaceRoomCrdt";
import {
  validateWorkspaceRoomLimits,
  WORKSPACE_ROOM_ROOT_ID,
  type WorkspaceRoomComment,
  type WorkspaceRoomCommentReply,
  type WorkspaceRoomNode,
  type WorkspaceRoomSnapshot,
} from "./workspaceRoomModel";
import {
  createWorkspaceRoomSyncController,
  isRemoteSyncOrigin,
  type WorkspaceRoomSyncAdapters,
  type WorkspaceRoomTransportHandlers,
} from "./workspaceRoomSync";

const HEADLESS_CHECKPOINT_ORIGIN = Symbol("tabula.headless-checkpoint");
const HEADLESS_LOCAL_ORIGIN = Symbol("tabula.headless-local");
const CHECKPOINT_DELAY_MS = 5_000;

export type HeadlessRoomConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "offline"
  | "failed"
  | "closed";

export type HeadlessRoomHydrationStatus = "waiting-for-state" | "ready" | "failed";

export type HeadlessRoomCheckpointStatus =
  | "disabled"
  | "missing"
  | "loaded"
  | "saved"
  | "failed";

export type HeadlessRoomCollaborator = {
  actor: RoomActor;
  activeDocumentId?: string;
  fileTitle?: string;
  selection?: HeadlessRoomSelection;
  lastSeen: number;
};

export type HeadlessRoomSelection = {
  documentId: string;
  from: number;
  to: number;
};

export type HeadlessRoomClientState = {
  roomId: string;
  actor: RoomActor;
  status: HeadlessRoomConnectionStatus;
  hydrationStatus: HeadlessRoomHydrationStatus;
  checkpointStatus: HeadlessRoomCheckpointStatus;
  collaborators: HeadlessRoomCollaborator[];
  version: number;
  lastError?: string;
};

export type HeadlessRoomClientOptions = {
  roomUrl: string;
  roomServerUrl: string;
  actor: RoomActor;
  adapters: WorkspaceRoomSyncAdapters;
  checkpointStore?: WorkspaceRoomCheckpointStore;
  initialWorkspace?: WorkspaceRoomSnapshot;
};

export type HeadlessRoomExpectedNode = {
  title?: string;
  parentId?: string | null;
  revision?: string;
};

export type HeadlessRoomChange =
  | { type: "folder.create"; folderId?: string; parentId?: string | null; title: string }
  | {
    type: "document.create";
    documentId?: string;
    parentId?: string | null;
    title: string;
    markdown?: string;
  }
  | {
    type: "document.write";
    documentId: string;
    markdown: string;
    expectedRevision: string;
    preferredPatches?: readonly TextPatch[];
  }
  | {
    type: "node.update";
    nodeId: string;
    title?: string;
    parentId?: string | null;
    expected?: HeadlessRoomExpectedNode;
  }
  | { type: "node.delete"; nodeId: string; expected?: HeadlessRoomExpectedNode }
  | { type: "comment.upsert"; comment: WorkspaceRoomComment }
  | { type: "comment.reply"; commentId: string; reply: WorkspaceRoomCommentReply }
  | { type: "comment.resolve"; commentId: string; resolved: boolean }
  | { type: "comment.delete"; commentId: string };

export type HeadlessRoomChangeResult =
  | { type: "folder.create"; folderId: string }
  | { type: "document.create"; documentId: string }
  | { type: "document.write"; documentId: string; revision: string }
  | { type: "node.update"; nodeId: string }
  | { type: "node.delete"; nodeId: string }
  | { type: "comment.upsert"; commentId: string }
  | { type: "comment.reply"; commentId: string; replyId: string }
  | { type: "comment.resolve"; commentId: string; resolved: boolean }
  | { type: "comment.delete"; commentId: string };

export type HeadlessRoomClient = ReturnType<typeof createHeadlessRoomClientRuntime>;

const disabledCheckpointStore: WorkspaceRoomCheckpointStore = {
  enabled: false,
  loadEncryptedCheckpoint: async () => null,
  saveEncryptedCheckpoint: async () => ({ ok: false, reason: "conflict", generation: 0 }),
};

const sha256Text = async (text: string) => {
  const digest = await getCrypto().subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getActorFromAwareness = (awareness: Awareness, actorId: string) => {
  for (const state of awareness.getStates().values()) {
    const actor = parseRoomActor(state?.actor);
    if (actor?.id === actorId) return actor;
  }
  return null;
};

const flattenComments = (snapshot: WorkspaceRoomSnapshot) =>
  Object.values(snapshot.commentsByFileId).flat();

const getDocumentIdForType = (room: WorkspaceRoomCrdt, type: unknown) => {
  let documentId: string | undefined;
  room.documents.forEach((text, id) => {
    if (text === type) documentId = id;
  });
  return documentId;
};

const readPresenceSelection = (
  room: WorkspaceRoomCrdt,
  presence: Record<string, unknown>,
): HeadlessRoomSelection | undefined => {
  const cursor = presence.cursor;
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
  const raw = cursor as { anchor?: Y.RelativePosition; head?: Y.RelativePosition };
  if (!raw.anchor || !raw.head) return undefined;
  try {
    const anchor = Y.createAbsolutePositionFromRelativePosition(raw.anchor, room.doc);
    const head = Y.createAbsolutePositionFromRelativePosition(raw.head, room.doc);
    if (!anchor || !head || anchor.type !== head.type) return undefined;
    const documentId = getDocumentIdForType(room, anchor.type);
    return documentId
      ? { documentId, from: Math.min(anchor.index, head.index), to: Math.max(anchor.index, head.index) }
      : undefined;
  } catch {
    return undefined;
  }
};

export const createHeadlessRoomClientRuntime = ({
  roomUrl,
  roomServerUrl,
  actor: rawActor,
  adapters,
  checkpointStore = disabledCheckpointStore,
  initialWorkspace,
}: HeadlessRoomClientOptions) => {
  const parsedRoom = parseRoomShareUrl(roomUrl);
  if (!parsedRoom) throw new Error("A valid private Tabula Room URL is required.");
  const actor = parseRoomActor(rawActor);
  if (!actor) throw new Error("A valid Tabula Room actor is required.");
  if (initialWorkspace && initialWorkspace.roomId !== parsedRoom.roomId) {
    throw new Error("The initial workspace belongs to a different Room.");
  }
  const roomId = parsedRoom.roomId;
  const roomKeyValue = parsedRoom.roomKey;
  const doc = new Y.Doc();
  const room = createWorkspaceRoomCrdt({
    roomId,
    doc,
    initialize: Boolean(initialWorkspace),
  });
  if (initialWorkspace) {
    initializeWorkspaceRoomCrdt(room, {
      nodes: initialWorkspace.nodes
        .filter((node) => node.id !== initialWorkspace.rootId)
        .map((node) => ({
          ...node,
          markdown: node.type === "document" ? initialWorkspace.documents[node.id] ?? "" : undefined,
        })),
      comments: flattenComments(initialWorkspace),
    });
    const structure = validateWorkspaceRoomStructure(room, roomId);
    if (!structure.ok) {
      doc.destroy();
      throw new Error(structure.message);
    }
    const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(room));
    if (!limits.ok) {
      doc.destroy();
      throw new Error(limits.message);
    }
  }
  const awareness = new Awareness(doc);
  const listeners = new Set<(state: HeadlessRoomClientState) => void>();
  const hydrationWaiters = new Set<{
    resolve: (status: HeadlessRoomHydrationStatus) => void;
    timer: unknown;
  }>();
  let status: HeadlessRoomConnectionStatus = "idle";
  let hydrationStatus: HeadlessRoomHydrationStatus = initialWorkspace ? "ready" : "waiting-for-state";
  let checkpointStatus: HeadlessRoomCheckpointStatus = checkpointStore.enabled ? "missing" : "disabled";
  let lastError = "";
  let version = initialWorkspace ? 1 : 0;
  let roomKey: CryptoKey | null = null;
  let checkpointGeneration = 0;
  let checkpointTimer: unknown;
  let checkpointInFlight: Promise<void> | null = null;
  let connectedOnce = false;
  let activeDocumentId: string | undefined;

  const collaborators = (): HeadlessRoomCollaborator[] => {
    const result: HeadlessRoomCollaborator[] = [];
    awareness.getStates().forEach((presence, clientId) => {
      if (clientId === awareness.clientID) return;
      const collaborator = parseRoomActor(presence?.actor);
      if (!collaborator || collaborator.id === actor.id || !collaborator.capabilities.includes("presence")) return;
      result.push({
        actor: collaborator,
        activeDocumentId: typeof presence?.activeDocumentId === "string" ? presence.activeDocumentId : undefined,
        fileTitle: typeof presence?.fileTitle === "string" ? presence.fileTitle : undefined,
        selection: readPresenceSelection(room, presence as Record<string, unknown>),
        lastSeen: typeof presence?.lastSeen === "number" ? presence.lastSeen : Date.now(),
      });
    });
    return result.sort((left, right) =>
      left.actor.name.localeCompare(right.actor.name) || left.actor.id.localeCompare(right.actor.id));
  };

  const getState = (): HeadlessRoomClientState => ({
    roomId,
    actor,
    status,
    hydrationStatus,
    checkpointStatus,
    collaborators: collaborators(),
    version,
    ...(lastError ? { lastError } : {}),
  });

  const emit = () => {
    const state = getState();
    listeners.forEach((listener) => listener(state));
  };

  const setError = (message: string, fail = false) => {
    lastError = message;
    if (fail) status = "failed";
    emit();
  };

  const settleHydration = (result: HeadlessRoomHydrationStatus) => {
    hydrationWaiters.forEach((waiter) => {
      adapters.clock.clearTimeout(waiter.timer);
      waiter.resolve(result);
    });
    hydrationWaiters.clear();
  };

  const markHydrated = () => {
    if (hydrationStatus === "ready") return true;
    const structure = validateWorkspaceRoomStructure(room, roomId);
    if (!structure.ok) {
      hydrationStatus = "failed";
      setError(structure.message, true);
      settleHydration("failed");
      return false;
    }
    const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(room));
    if (!limits.ok) {
      hydrationStatus = "failed";
      setError(limits.message, true);
      settleHydration("failed");
      return false;
    }
    hydrationStatus = "ready";
    settleHydration("ready");
    emit();
    return true;
  };

  const publishPresence = () => {
    const next: Record<string, unknown> = {
      ...awareness.getLocalState(),
      actor,
      user: { name: actor.name, color: actor.color, colorLight: `${actor.color}33` },
      lastSeen: Date.now(),
    };
    if (activeDocumentId) next.activeDocumentId = activeDocumentId;
    else delete next.activeDocumentId;
    awareness.setLocalState(next);
  };

  const removeStalePresence = (peerIds: readonly string[]) => {
    const allowed = new Set(peerIds);
    const stale: number[] = [];
    awareness.getStates().forEach((presence, clientId) => {
      if (clientId === awareness.clientID) return;
      const collaborator = parseRoomActor(presence?.actor);
      if (collaborator && !allowed.has(collaborator.id)) stale.push(clientId);
    });
    if (stale.length > 0) removeAwarenessStates(awareness, stale, "tabula.headless-peers");
  };

  const syncController = createWorkspaceRoomSyncController({
    roomId,
    doc,
    awareness,
    adapters,
    isClosed: () => status === "closed",
    getIdentityId: () => actor.id,
    getSenderActor: (senderId) => getActorFromAwareness(awareness, senderId),
    onCapacityExceeded: () => setError("The live workspace exceeds the supported collaboration size.", true),
    onInvalidMessage: (message) => setError(message),
    onRemoteSyncApplied: ({ changed }) => {
      if (changed) markHydrated();
    },
    onUnsupportedMessage: () => setError("This Room uses an unsupported collaboration protocol.", true),
  });

  const ensureRoomKey = async () => {
    roomKey ??= await importEncryptionKey(roomKeyValue, ["encrypt", "decrypt"], ROOM_KEY_BYTES);
    syncController.setRoomKey(roomKey);
    return roomKey;
  };

  const saveCheckpoint = async () => {
    if (!checkpointStore.enabled || status === "closed" || hydrationStatus !== "ready") return;
    if (checkpointInFlight) return checkpointInFlight;
    checkpointInFlight = (async () => {
      try {
        const key = await ensureRoomKey();
        const save = async (expectedGeneration: number) => checkpointStore.saveEncryptedCheckpoint(roomId, {
          expectedGeneration,
          encryptedCheckpoint: await encryptWorkspaceRoomCheckpoint({
            roomId,
            update: Y.encodeStateAsUpdate(doc),
            roomKey: key,
          }),
          expiresAt: Date.now() + ROOM_CHECKPOINT_RETENTION_MS,
        });
        let result = await save(checkpointGeneration);
        if (!result.ok) {
          const latest = await checkpointStore.loadEncryptedCheckpoint(roomId);
          if (latest?.status === "ready") {
            const checkpointDoc = new Y.Doc();
            try {
              Y.applyUpdate(checkpointDoc, Y.encodeStateAsUpdate(doc));
              Y.applyUpdate(checkpointDoc, await decryptWorkspaceRoomCheckpoint({
                encryptedCheckpoint: latest.encryptedCheckpoint,
                roomId,
                roomKey: key,
              }));
              const checkpointRoom = createWorkspaceRoomCrdt({ roomId, doc: checkpointDoc, initialize: false });
              const valid = validateWorkspaceRoomStructure(checkpointRoom, roomId);
              if (!valid.ok) throw new Error(valid.message);
              const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(checkpointRoom));
              if (!limits.ok) throw new Error(limits.message);
              Y.applyUpdate(doc, Y.encodeStateAsUpdate(checkpointDoc, Y.encodeStateVector(doc)), HEADLESS_CHECKPOINT_ORIGIN);
            } finally {
              checkpointDoc.destroy();
            }
            checkpointGeneration = latest.generation;
            result = await save(latest.generation);
          }
        }
        if (!result.ok) throw new Error("Room checkpoint changed during save.");
        checkpointGeneration = result.generation;
        checkpointStatus = "saved";
        emit();
      } catch (error) {
        checkpointStatus = "failed";
        setError(error instanceof Error ? error.message : "Room checkpoint could not be saved.");
      }
    })().finally(() => {
      checkpointInFlight = null;
    });
    return checkpointInFlight;
  };

  const scheduleCheckpoint = () => {
    if (!checkpointStore.enabled || hydrationStatus !== "ready" || status === "closed") return;
    if (checkpointTimer) adapters.clock.clearTimeout(checkpointTimer);
    checkpointTimer = adapters.clock.setTimeout(() => {
      checkpointTimer = undefined;
      void saveCheckpoint();
    }, CHECKPOINT_DELAY_MS);
  };

  const loadCheckpoint = async () => {
    if (!checkpointStore.enabled || initialWorkspace) return;
    try {
      const loaded = await checkpointStore.loadEncryptedCheckpoint(roomId);
      if (!loaded) {
        checkpointStatus = "missing";
        return;
      }
      checkpointGeneration = loaded.generation;
      if (loaded.status === "expired") throw new Error("This live Room has expired.");
      const key = await ensureRoomKey();
      const checkpointDoc = new Y.Doc();
      try {
        Y.applyUpdate(checkpointDoc, await decryptWorkspaceRoomCheckpoint({
          encryptedCheckpoint: loaded.encryptedCheckpoint,
          roomId,
          roomKey: key,
        }));
        const checkpointRoom = createWorkspaceRoomCrdt({ roomId, doc: checkpointDoc, initialize: false });
        const structure = validateWorkspaceRoomStructure(checkpointRoom, roomId);
        if (!structure.ok) throw new Error(structure.message);
        const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(checkpointRoom));
        if (!limits.ok) throw new Error(limits.message);
        Y.applyUpdate(doc, Y.encodeStateAsUpdate(checkpointDoc), HEADLESS_CHECKPOINT_ORIGIN);
      } finally {
        checkpointDoc.destroy();
      }
      checkpointStatus = "loaded";
      markHydrated();
    } catch (error) {
      checkpointStatus = "failed";
      hydrationStatus = "failed";
      throw error;
    }
  };

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (!isRemoteSyncOrigin(origin) && origin !== HEADLESS_CHECKPOINT_ORIGIN) {
      syncController.handleLocalUpdate(update);
    }
    version += 1;
    if (room.meta.has("schemaVersion")) markHydrated();
    scheduleCheckpoint();
    emit();
  });
  awareness.on("update", (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    syncController.handleAwarenessUpdate(changes, origin);
    emit();
  });
  publishPresence();

  const waitForHydration = (timeoutMs: number): Promise<HeadlessRoomHydrationStatus> => {
    if (hydrationStatus !== "waiting-for-state" || timeoutMs <= 0) return Promise.resolve(hydrationStatus);
    return new Promise((resolve) => {
      const timer = adapters.clock.setTimeout(() => {
        hydrationWaiters.delete(waiter);
        resolve(hydrationStatus);
      }, Math.min(30_000, Math.max(0, timeoutMs)));
      const waiter = { resolve, timer };
      hydrationWaiters.add(waiter);
    });
  };

  const assertReadable = () => {
    if (!actor.capabilities.includes("read")) throw new Error("This Room actor does not have read capability.");
    if (hydrationStatus !== "ready") throw new Error("The Room is waiting for workspace state.");
  };

  const assertWritable = () => {
    assertReadable();
    if (!actor.capabilities.includes("write")) throw new Error("This Room actor does not have write capability.");
  };

  const assertExpectedNode = async (
    draftRoom: WorkspaceRoomCrdt,
    nodeId: string,
    expected: HeadlessRoomExpectedNode | undefined,
  ) => {
    const node = getWorkspaceRoomStructureSnapshot(draftRoom).nodes.find((candidate) => candidate.id === nodeId);
    if (!node) throw new Error(`Workspace node was not found: ${nodeId}`);
    if (expected?.title !== undefined && node.title !== expected.title) {
      throw new Error(`Workspace node changed before the operation: ${nodeId}`);
    }
    if (expected?.parentId !== undefined && node.parentId !== expected.parentId) {
      throw new Error(`Workspace node moved before the operation: ${nodeId}`);
    }
    if (expected?.revision !== undefined && node.type === "document") {
      const markdown = draftRoom.documents.get(nodeId)?.toString() ?? "";
      if (await sha256Text(markdown) !== expected.revision) {
        throw new Error(`Workspace document changed before the operation: ${nodeId}`);
      }
    }
    return node;
  };

  const mutateWorkspace = async <T>(mutator: (draftRoom: WorkspaceRoomCrdt) => T | Promise<T>) => {
    assertWritable();
    const draftDoc = new Y.Doc();
    Y.applyUpdate(draftDoc, Y.encodeStateAsUpdate(doc));
    const draftRoom = createWorkspaceRoomCrdt({ roomId, doc: draftDoc, initialize: false });
    try {
      const result = await mutator(draftRoom);
      const structure = validateWorkspaceRoomStructure(draftRoom, roomId);
      if (!structure.ok) throw new Error(structure.message);
      const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(draftRoom));
      if (!limits.ok) throw new Error(limits.message);
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(draftDoc, Y.encodeStateVector(doc)), HEADLESS_LOCAL_ORIGIN);
      return result;
    } finally {
      draftDoc.destroy();
    }
  };

  const applyTextChange = async (
    draftRoom: WorkspaceRoomCrdt,
    change: Extract<HeadlessRoomChange, { type: "document.write" }>,
  ) => {
    await assertExpectedNode(draftRoom, change.documentId, { revision: change.expectedRevision });
    const text = draftRoom.documents.get(change.documentId);
    if (!text) throw new Error(`Workspace document was not found: ${change.documentId}`);
    const patches = getTextPatchesForChange(text.toString(), change.markdown, change.preferredPatches);
    for (const patch of [...patches].sort((left, right) => right.from - left.from || right.to - left.to)) {
      if (patch.to > patch.from) text.delete(patch.from, patch.to - patch.from);
      if (patch.insert) text.insert(patch.from, patch.insert);
    }
    return sha256Text(change.markdown);
  };

  const applyChanges = (changes: readonly HeadlessRoomChange[]) => mutateWorkspace(async (draftRoom) => {
    const results: HeadlessRoomChangeResult[] = [];
    for (const change of changes) {
      switch (change.type) {
        case "folder.create": {
          const folderId = change.folderId ?? adapters.clock.createId();
          const created = createWorkspaceRoomFolder(draftRoom, {
            id: folderId,
            parentId: change.parentId ?? WORKSPACE_ROOM_ROOT_ID,
            title: change.title,
            order: Math.max(0, ...getWorkspaceRoomStructureSnapshot(draftRoom).nodes.map((node) => node.order)) + 1,
          });
          if (!created) throw new Error("Workspace folder could not be created.");
          results.push({ type: change.type, folderId });
          break;
        }
        case "document.create": {
          const documentId = change.documentId ?? adapters.clock.createId();
          const created = createWorkspaceRoomDocument(draftRoom, {
            id: documentId,
            parentId: change.parentId ?? WORKSPACE_ROOM_ROOT_ID,
            title: change.title,
            order: Math.max(0, ...getWorkspaceRoomStructureSnapshot(draftRoom).nodes.map((node) => node.order)) + 1,
            markdown: change.markdown ?? "",
          });
          if (!created) throw new Error("Workspace document could not be created.");
          results.push({ type: change.type, documentId });
          break;
        }
        case "document.write":
          results.push({
            type: change.type,
            documentId: change.documentId,
            revision: await applyTextChange(draftRoom, change),
          });
          break;
        case "node.update":
          await assertExpectedNode(draftRoom, change.nodeId, change.expected);
          if (change.title !== undefined && !renameWorkspaceRoomNode(draftRoom, change.nodeId, change.title)) {
            throw new Error("Workspace node could not be renamed.");
          }
          if (
            change.parentId !== undefined &&
            !moveWorkspaceRoomNode(draftRoom, change.nodeId, change.parentId ?? WORKSPACE_ROOM_ROOT_ID)
          ) {
            throw new Error("Workspace node could not be moved.");
          }
          results.push({ type: change.type, nodeId: change.nodeId });
          break;
        case "node.delete":
          await assertExpectedNode(draftRoom, change.nodeId, change.expected);
          deleteWorkspaceRoomNode(draftRoom, change.nodeId);
          results.push({ type: change.type, nodeId: change.nodeId });
          break;
        case "comment.upsert":
          if (!setWorkspaceRoomComment(draftRoom, change.comment)) {
            throw new Error("Workspace comment could not be saved.");
          }
          results.push({ type: change.type, commentId: change.comment.id });
          break;
        case "comment.reply":
          if (!addWorkspaceRoomCommentReply(draftRoom, change.commentId, change.reply)) {
            throw new Error("Workspace comment reply could not be saved.");
          }
          results.push({ type: change.type, commentId: change.commentId, replyId: change.reply.id });
          break;
        case "comment.resolve":
          if (!draftRoom.comments.has(change.commentId)) throw new Error("Workspace comment was not found.");
          setWorkspaceRoomCommentResolved(draftRoom, change.commentId, change.resolved);
          results.push({ type: change.type, commentId: change.commentId, resolved: change.resolved });
          break;
        case "comment.delete":
          deleteWorkspaceRoomComment(draftRoom, change.commentId);
          results.push({ type: change.type, commentId: change.commentId });
          break;
      }
    }
    return results;
  });

  const connect = async ({ waitForStateMs = 5_000 }: { waitForStateMs?: number } = {}) => {
    if (connectedOnce || status !== "idle") throw new Error("This headless Room client has already connected.");
    connectedOnce = true;
    status = "connecting";
    emit();
    try {
      await ensureRoomKey();
      await loadCheckpoint();
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const handlers: Omit<WorkspaceRoomTransportHandlers, "onMessage"> = {
          onConnect: () => {
            status = "connecting";
            emit();
          },
          onJoined: () => {
            status = "connected";
            syncController.onJoined();
            publishPresence();
            emit();
            if (!settled) {
              settled = true;
              resolve();
            }
          },
          onPeerJoined: () => syncController.onPeerJoined(),
          onPeers: (message) => {
            removeStalePresence(message.peers);
            emit();
          },
          onError: (message) => setError(message.error ?? "Room relay error."),
          onDisconnect: () => {
            if (status !== "closed") status = "offline";
            syncController.onTransportDisconnected();
            emit();
          },
          onConnectError: () => {
            setError("Live Room connection failed.", true);
            if (!settled) {
              settled = true;
              reject(new Error(lastError));
            }
          },
        };
        syncController.connect(roomServerUrl, handlers);
      });
      await waitForHydration(waitForStateMs);
      return getState();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Live Room connection failed.", true);
      throw error;
    }
  };

  return {
    roomId,
    actor,
    connect,
    subscribe(listener: (state: HeadlessRoomClientState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState,
    waitForHydration,
    getWorkspaceSnapshot() {
      assertReadable();
      return getWorkspaceRoomSnapshot(room);
    },
    async readDocument(documentId: string) {
      assertReadable();
      const node = getWorkspaceRoomStructureSnapshot(room).nodes.find(
        (candidate): candidate is WorkspaceRoomNode & { type: "document" } =>
          candidate.id === documentId && candidate.type === "document",
      );
      const text = room.documents.get(documentId);
      if (!node || !text) throw new Error(`Workspace document was not found: ${documentId}`);
      const markdown = text.toString();
      return { ...node, markdown, revision: await sha256Text(markdown) };
    },
    applyChanges,
    async createFolder(input: { folderId?: string; parentId?: string | null; title: string }) {
      const [result] = await applyChanges([{ type: "folder.create", ...input }]);
      if (result?.type !== "folder.create") throw new Error("Workspace folder result was not returned.");
      return { folderId: result.folderId };
    },
    async createDocument(input: {
      documentId?: string;
      parentId?: string | null;
      title: string;
      markdown?: string;
    }) {
      const [result] = await applyChanges([{ type: "document.create", ...input }]);
      if (result?.type !== "document.create") throw new Error("Workspace document result was not returned.");
      return { documentId: result.documentId };
    },
    async writeDocument(input: {
      documentId: string;
      markdown: string;
      expectedRevision: string;
      preferredPatches?: readonly TextPatch[];
    }) {
      const [result] = await applyChanges([{ type: "document.write", ...input }]);
      if (result?.type !== "document.write") throw new Error("Workspace document result was not returned.");
      return { revision: result.revision };
    },
    renameNode(input: { nodeId: string; title: string; expected?: HeadlessRoomExpectedNode }) {
      return applyChanges([{ type: "node.update", ...input }]).then(() => undefined);
    },
    moveNode(input: { nodeId: string; parentId: string | null; expected?: HeadlessRoomExpectedNode }) {
      return applyChanges([{ type: "node.update", ...input }]).then(() => undefined);
    },
    deleteNode(input: { nodeId: string; expected?: HeadlessRoomExpectedNode }) {
      return applyChanges([{ type: "node.delete", ...input }]).then(() => undefined);
    },
    upsertComment(comment: WorkspaceRoomComment) {
      return applyChanges([{ type: "comment.upsert", comment }]).then(() => undefined);
    },
    addCommentReply(commentId: string, reply: WorkspaceRoomCommentReply) {
      return applyChanges([{ type: "comment.reply", commentId, reply }]).then(() => undefined);
    },
    setCommentResolved(commentId: string, resolved: boolean) {
      return applyChanges([{ type: "comment.resolve", commentId, resolved }]).then(() => undefined);
    },
    deleteComment(commentId: string) {
      return applyChanges([{ type: "comment.delete", commentId }]).then(() => undefined);
    },
    setPresence(input: {
      activeDocumentId?: string;
      fileTitle?: string;
      selection?: HeadlessRoomSelection;
    } = {}) {
      activeDocumentId = input.activeDocumentId;
      const current = { ...awareness.getLocalState() } as Record<string, unknown>;
      if (input.fileTitle) current.fileTitle = input.fileTitle;
      else delete current.fileTitle;
      if (input.selection) {
        const text = room.documents.get(input.selection.documentId);
        if (!text) throw new Error(`Workspace document was not found: ${input.selection.documentId}`);
        current.cursor = {
          anchor: Y.createRelativePositionFromTypeIndex(
            text,
            Math.max(0, Math.min(input.selection.from, text.length)),
          ),
          head: Y.createRelativePositionFromTypeIndex(
            text,
            Math.max(0, Math.min(input.selection.to, text.length)),
          ),
        };
      } else {
        delete current.cursor;
      }
      awareness.setLocalState(current);
      publishPresence();
    },
    async flushCheckpoint() {
      if (checkpointTimer) adapters.clock.clearTimeout(checkpointTimer);
      checkpointTimer = undefined;
      await saveCheckpoint();
    },
    async disconnect() {
      if (status === "closed") return;
      if (checkpointTimer) adapters.clock.clearTimeout(checkpointTimer);
      checkpointTimer = undefined;
      await saveCheckpoint();
      status = "closed";
      removeAwarenessStates(awareness, [awareness.clientID], "tabula.headless-disconnect");
      syncController.dispose();
      awareness.destroy();
      hydrationWaiters.forEach((waiter) => {
        adapters.clock.clearTimeout(waiter.timer);
        waiter.resolve(hydrationStatus);
      });
      hydrationWaiters.clear();
      emit();
      listeners.clear();
      doc.destroy();
    },
  };
};
