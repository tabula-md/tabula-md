import type { EnvelopeKind } from "./roomProtocol";
import { createDefaultCollabRuntimeAdapters } from "./collabDefaultAdapters";
import { createCollaboratorRegistry } from "./collabCollaborators";
import { createCollabEnvelopeRouter } from "./collabEnvelopeRouter";
import type { CollabRuntimeAdapters, CollabTextDocumentHandle } from "./collabRuntimeAdapters";
import { createCollabSessionState } from "./collabSessionState";
import { resolveCollabStartConfig } from "./collabStartConfig";
import { createCollabTransportHandlers } from "./collabTransportController";
import { createCollabUpdateBuffer } from "./collabUpdateBuffer";
import {
  createRoomActor,
  createWorkspaceRoomCheckpoint,
  createWorkspaceRoomState,
  encodeBase64Url as encodeBase64UrlBytes,
  encodeRoomEvent,
  LARGE_DOCUMENT_CHAR_THRESHOLD,
  type RoomActorClient,
  type RoomActorKind,
  type RoomCapability,
  type RoomEvent,
  type TextChange,
  type TextPatch,
  type WorkspaceRoomDocument,
  type WorkspaceRoomCheckpoint,
} from "@tabula-md/tabula";
import {
  decryptWorkspaceRoomCheckpoint,
  encryptWorkspaceRoomCheckpoint,
} from "./roomCheckpointStore";

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

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

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

type ConnectOptions = {
  roomId: string;
  roomKey: string;
  documentId?: string;
  documents?: readonly WorkspaceDocumentSnapshot[];
  emitInitialWorkspaceState?: boolean;
  initialText?: string;
  identity: Collaborator;
  fileTitle: string;
  selection?: LiveSelection;
  onTextChange: (documentId: string, text: string, change?: TextChange) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onCollaboratorsChange: (collaborators: Collaborator[]) => void;
  onRoomEvent?: (event: RoomEvent) => void;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
  adapters?: CollabRuntimeAdapters;
};

const PRESENCE_SEND_THROTTLE_MS = 75;
const CHECKPOINT_SAVE_DELAY_MS = 250;

type WorkspaceDocumentSnapshot = {
  id: string;
  title: string;
  text: string;
  parentId?: string | null;
};

export const createCollabConnection = ({
  roomId,
  roomKey: encodedRoomKey,
  documentId,
  documents,
  emitInitialWorkspaceState = true,
  initialText,
  identity,
  fileTitle,
  selection,
  onTextChange,
  onStatusChange,
  onCollaboratorsChange,
  onRoomEvent,
  onRecoveryEvent,
  adapters = createDefaultCollabRuntimeAdapters(),
}: ConnectOptions) => {
  let activeDocumentId = documentId ?? "document";
  const initialDocuments = documents?.length
    ? documents.map((document) =>
        document.id === activeDocumentId && initialText !== undefined
          ? { ...document, text: initialText }
          : document,
      )
    : [{ id: activeDocumentId, title: fileTitle, text: initialText ?? "" }];
  const initialDocumentsById = new Map(initialDocuments.map((document) => [document.id, document]));
  const textDocuments = new Map<string, CollabTextDocumentHandle>();
  for (const document of initialDocuments) {
    textDocuments.set(document.id, adapters.text.createDocument(document.text));
  }
  if (!textDocuments.has(activeDocumentId)) {
    textDocuments.set(activeDocumentId, adapters.text.createDocument(initialText));
  }
  const collaborators = createCollaboratorRegistry();
  let currentFileTitle = fileTitle;
  let currentSelection = selection;
  let currentIdentity = identity;
  let closedByClient = false;
  let heartbeat: unknown;
  let presenceTimer: unknown;
  let checkpointSaveTimer: unknown;
  let checkpointSaveInFlight = false;
  let checkpointSaveRequested = false;
  let checkpointSaveErrorReported = false;
  let suppressLocalTextUpdates = false;
  let roomKey: CryptoKey | null = null;
  let transport: ReturnType<CollabRuntimeAdapters["createRoomTransport"]> | null = null;
  let envelopeVersion = 0;
  let canEmitWorkspaceState = emitInitialWorkspaceState;
  let workspaceDocumentIds: Set<string> | null = emitInitialWorkspaceState
    ? new Set(initialDocuments.map((document) => document.id))
    : null;
  const sessionState = createCollabSessionState();

  const emitRecoveryEvent = (type: CollabRecoveryEvent["type"], message: string) => {
    onRecoveryEvent?.({
      id: adapters.clock.createId(),
      type,
      message,
      createdAt: adapters.clock.nowIso(),
    });
  };

  const publishCollaborators = () => {
    onCollaboratorsChange(collaborators.list());
  };

  const encryptEnvelope = async (kind: EnvelopeKind, plaintext: Uint8Array) => {
    if (!roomKey) {
      throw new Error("Room key is not available");
    }

    envelopeVersion += 1;
    return adapters.crypto.encryptEnvelope(roomKey, roomId, kind, envelopeVersion, plaintext);
  };

  const emitEnvelope = async (kind: EnvelopeKind, plaintext: Uint8Array, options: { volatile?: boolean } = {}) => {
    if (!transport?.connected || !roomKey || sessionState.isBlocked()) {
      return;
    }

    const envelope = await encryptEnvelope(kind, plaintext);
    if (options.volatile) {
      transport.sendVolatileEnvelope(envelope);
      return;
    }
    transport.sendEnvelope(envelope);
  };

  const emitRoomEvent = async (event: RoomEvent, options: { volatile?: boolean } = {}) => {
    await emitEnvelope("room-event", encodeRoomEvent(event), options);
  };

  const getCurrentActor = () =>
    createRoomActor({
      id: currentIdentity.id,
      kind: currentIdentity.kind ?? "human",
      name: currentIdentity.name,
      color: currentIdentity.color,
      client: currentIdentity.client ?? "tabula-md",
      capabilities: currentIdentity.capabilities,
      joinedAt: currentIdentity.joinedAt,
    });

  const workspaceUpdateBuffers = new Map<string, ReturnType<typeof createCollabUpdateBuffer>>();

  const emitTextUpdatedEvent = async (nextDocumentId: string, update: Uint8Array) => {
    const actor = getCurrentActor();
    await emitRoomEvent({
      id: adapters.clock.createId(),
      roomId,
      actorId: actor.id,
      type: "text.updated",
      createdAt: adapters.clock.nowIso(),
      actor,
      documentId: nextDocumentId,
      update: encodeBase64UrlBytes(update),
    });
    scheduleCheckpointSave();
  };

  const getWorkspaceUpdateBuffer = (nextDocumentId: string, nextTextDocument: CollabTextDocumentHandle) => {
    const existingBuffer = workspaceUpdateBuffers.get(nextDocumentId);
    if (existingBuffer) {
      return existingBuffer;
    }

    const nextBuffer = createCollabUpdateBuffer({
      delayMs: 25,
      onFlush: () => {
        void emitTextUpdatedEvent(
          nextDocumentId,
          adapters.text.encodeState(nextTextDocument),
        );
      },
      mergeUpdates: adapters.text.mergeUpdates,
      setTimeoutFn: adapters.clock.setTimeout,
      clearTimeoutFn: adapters.clock.clearTimeout,
    });
    workspaceUpdateBuffers.set(nextDocumentId, nextBuffer);
    return nextBuffer;
  };

  const emitWorkspaceStateEvent = async () => {
    const workspaceTextDocuments = Array.from(textDocuments.entries()).filter(
      ([nextDocumentId]) => !workspaceDocumentIds || workspaceDocumentIds.has(nextDocumentId),
    );
    const workspace = await createWorkspaceRoomState({
      activeDocumentId,
      documents: workspaceTextDocuments.map(([nextDocumentId, nextTextDocument]) => {
        const initialDocument = initialDocumentsById.get(nextDocumentId);
        return {
          id: nextDocumentId,
          title: initialDocument?.title ?? nextDocumentId,
          markdown: adapters.text.getText(nextTextDocument),
          parentId: initialDocument?.parentId,
        };
      }),
      nowIso: adapters.clock.nowIso,
      roomId,
    });

    await emitRoomEvent({
      id: adapters.clock.createId(),
      roomId,
      actorId: currentIdentity.id,
      type: "workspace.updated",
      createdAt: adapters.clock.nowIso(),
      actor: getCurrentActor(),
      workspace,
    });
    scheduleCheckpointSave();
  };

  const emitCurrentDocumentStates = async () => {
    if (!canEmitWorkspaceState) {
      return;
    }

    await emitWorkspaceStateEvent();
    const workspaceTextDocuments = Array.from(textDocuments.entries()).filter(
      ([nextDocumentId]) => !workspaceDocumentIds || workspaceDocumentIds.has(nextDocumentId),
    );
    for (const [nextDocumentId, nextTextDocument] of workspaceTextDocuments) {
      await emitTextUpdatedEvent(
        nextDocumentId,
        adapters.text.encodeState(nextTextDocument),
      );
    }
  };

  const clearPresenceTimer = () => {
    if (!presenceTimer) {
      return;
    }

    adapters.clock.clearTimeout(presenceTimer);
    presenceTimer = undefined;
  };

  const clearCheckpointSaveTimer = () => {
    if (!checkpointSaveTimer) {
      return;
    }

    adapters.clock.clearTimeout(checkpointSaveTimer);
    checkpointSaveTimer = undefined;
  };

  const getCheckpointDocuments = (): WorkspaceRoomDocument[] =>
    Array.from(textDocuments.entries())
      .filter(([nextDocumentId]) => !workspaceDocumentIds || workspaceDocumentIds.has(nextDocumentId))
      .map(([nextDocumentId, nextTextDocument]) => {
        const initialDocument = initialDocumentsById.get(nextDocumentId);
        return {
          id: nextDocumentId,
          title: initialDocument?.title ?? nextDocumentId,
          markdown: adapters.text.getText(nextTextDocument),
          parentId: initialDocument?.parentId ?? null,
        };
      });

  const createCurrentCheckpoint = async (): Promise<WorkspaceRoomCheckpoint> => {
    const documents = getCheckpointDocuments();
    return createWorkspaceRoomCheckpoint({
      activeDocumentId,
      documents,
      nowIso: adapters.clock.nowIso,
      roomId,
    });
  };

  const saveCheckpointNow = async () => {
    if (!adapters.roomCheckpointStore.enabled || !roomKey || closedByClient) {
      return;
    }

    if (checkpointSaveInFlight) {
      checkpointSaveRequested = true;
      return;
    }

    checkpointSaveInFlight = true;
    try {
      const checkpoint = await createCurrentCheckpoint();
      const encryptedCheckpoint = await encryptWorkspaceRoomCheckpoint({
        checkpoint,
        roomKey,
      });
      await adapters.roomCheckpointStore.saveEncryptedCheckpoint(roomId, encryptedCheckpoint);
      checkpointSaveErrorReported = false;
    } catch {
      if (!checkpointSaveErrorReported) {
        checkpointSaveErrorReported = true;
        emitRecoveryEvent("invalid-message", "An encrypted room checkpoint could not be saved.");
      }
    } finally {
      checkpointSaveInFlight = false;
      if (checkpointSaveRequested) {
        checkpointSaveRequested = false;
        void saveCheckpointNow();
      }
    }
  };

  const scheduleCheckpointSave = () => {
    if (!adapters.roomCheckpointStore.enabled || closedByClient || !roomKey) {
      return;
    }

    clearCheckpointSaveTimer();
    checkpointSaveTimer = adapters.clock.setTimeout(() => {
      checkpointSaveTimer = undefined;
      void saveCheckpointNow();
    }, CHECKPOINT_SAVE_DELAY_MS);
  };

  const applyCheckpoint = (checkpoint: WorkspaceRoomCheckpoint) => {
    if (checkpoint.roomId !== roomId) {
      return;
    }

    const documentIds = new Set(checkpoint.documents.map((document) => document.id));
    workspaceDocumentIds = documentIds;
    canEmitWorkspaceState = true;
    if (checkpoint.workspace.activeDocumentId) {
      activeDocumentId = checkpoint.workspace.activeDocumentId;
    }

    handleRoomEvent({
      id: adapters.clock.createId(),
      roomId,
      actorId: currentIdentity.id,
      type: "workspace.updated",
      createdAt: checkpoint.updatedAt,
      actor: getCurrentActor(),
      workspace: checkpoint.workspace,
    });

    suppressLocalTextUpdates = true;
    try {
      for (const document of checkpoint.documents) {
        initialDocumentsById.set(document.id, {
          id: document.id,
          title: document.title,
          text: document.markdown,
          parentId: document.parentId,
        });
        const textDocument = getOrCreateTextDocument(document.id, {
          initialText: document.markdown,
          parentId: document.parentId,
          title: document.title,
        });
        adapters.text.applyLocalText(textDocument, document.markdown);
        onTextChange(document.id, document.markdown);
      }
    } finally {
      suppressLocalTextUpdates = false;
    }
  };

  const loadCheckpoint = async () => {
    if (!adapters.roomCheckpointStore.enabled || !roomKey) {
      return;
    }

    try {
      const encryptedCheckpoint = await adapters.roomCheckpointStore.loadEncryptedCheckpoint(roomId);
      if (!encryptedCheckpoint) {
        return;
      }

      const checkpoint = await decryptWorkspaceRoomCheckpoint({
        encryptedCheckpoint,
        roomId,
        roomKey,
      });
      applyCheckpoint(checkpoint);
    } catch {
      emitRecoveryEvent("invalid-message", "An encrypted room checkpoint could not be loaded.");
    }
  };

  const publishPresence = async () => {
    const createdAt = adapters.clock.nowIso();
    const activeSelection = currentSelection
      ? {
          ...currentSelection,
          documentId: currentSelection.documentId ?? activeDocumentId,
        }
      : undefined;
    await emitRoomEvent(
      {
        id: adapters.clock.createId(),
        roomId,
        actorId: currentIdentity.id,
        type: "presence.updated",
        createdAt,
        actor: getCurrentActor(),
        presence: {
          actorId: currentIdentity.id,
          activeDocumentId,
          selection: activeSelection,
          lastSeen: Date.parse(createdAt) || Date.now(),
        },
        fileTitle: currentFileTitle,
        selection: activeSelection,
      },
      { volatile: true },
    );
  };

  const schedulePresencePublish = () => {
    if (closedByClient) {
      return;
    }

    if (presenceTimer) {
      return;
    }

    presenceTimer = adapters.clock.setTimeout(() => {
      presenceTimer = undefined;
      void publishPresence();
    }, PRESENCE_SEND_THROTTLE_MS);
  };

  const unsubscribeTextUpdates = new Map<string, () => void>();

  const observeTextDocumentUpdates = (
    nextDocumentId: string,
    nextTextDocument: CollabTextDocumentHandle,
  ) => {
    const unsubscribe = adapters.text.observeUpdates(nextTextDocument, (update, origin) => {
      if (closedByClient || suppressLocalTextUpdates || adapters.text.isRemoteOrigin(origin)) {
        return;
      }

      getWorkspaceUpdateBuffer(nextDocumentId, nextTextDocument).push(update);
      scheduleCheckpointSave();
    });
    unsubscribeTextUpdates.set(nextDocumentId, unsubscribe);
  };

  for (const [nextDocumentId, nextTextDocument] of textDocuments.entries()) {
    observeTextDocumentUpdates(nextDocumentId, nextTextDocument);
  }

  const getOrCreateTextDocument = (
    nextDocumentId?: string,
    options: { initialText?: string; parentId?: string | null; title?: string } = {},
  ) => {
    const resolvedDocumentId = nextDocumentId ?? activeDocumentId;

    const existingDocument = textDocuments.get(resolvedDocumentId);
    if (existingDocument) {
      return existingDocument;
    }

    const nextTextDocument = adapters.text.createDocument(options.initialText ?? "");
    textDocuments.set(resolvedDocumentId, nextTextDocument);
    initialDocumentsById.set(resolvedDocumentId, {
      id: resolvedDocumentId,
      title: options.title ?? resolvedDocumentId,
      text: options.initialText ?? "",
      parentId: options.parentId,
    });
    observeTextDocumentUpdates(resolvedDocumentId, nextTextDocument);
    return nextTextDocument;
  };

  const updateWorkspaceDocumentMetadata = (document: WorkspaceDocumentSnapshot) => {
    const existingDocument = initialDocumentsById.get(document.id);
    initialDocumentsById.set(document.id, {
      id: document.id,
      title: document.title,
      text: existingDocument?.text ?? document.text,
      parentId: document.parentId,
    });
  };

  const pruneWorkspaceTextDocuments = (nextDocumentIds: Set<string>) => {
    const nextActiveDocumentId = nextDocumentIds.has(activeDocumentId)
      ? activeDocumentId
      : nextDocumentIds.values().next().value;
    if (nextActiveDocumentId) {
      activeDocumentId = nextActiveDocumentId;
    }

    for (const [nextDocumentId, nextTextDocument] of textDocuments.entries()) {
      if (nextDocumentIds.has(nextDocumentId)) {
        continue;
      }

      unsubscribeTextUpdates.get(nextDocumentId)?.();
      unsubscribeTextUpdates.delete(nextDocumentId);
      workspaceUpdateBuffers.get(nextDocumentId)?.clear();
      workspaceUpdateBuffers.delete(nextDocumentId);
      initialDocumentsById.delete(nextDocumentId);
      textDocuments.delete(nextDocumentId);
      adapters.text.destroy(nextTextDocument);
    }
  };

  const setWorkspaceDocuments = (nextDocuments: readonly WorkspaceDocumentSnapshot[]) => {
    if (!canEmitWorkspaceState || nextDocuments.length === 0) {
      return;
    }

    const nextDocumentIds = new Set(nextDocuments.map((nextDocument) => nextDocument.id));
    workspaceDocumentIds = nextDocumentIds;

    for (const nextDocument of nextDocuments) {
      if (!textDocuments.has(nextDocument.id)) {
        getOrCreateTextDocument(nextDocument.id, {
          initialText: nextDocument.text,
          parentId: nextDocument.parentId,
          title: nextDocument.title,
        });
      }
      updateWorkspaceDocumentMetadata(nextDocument);
    }

    pruneWorkspaceTextDocuments(nextDocumentIds);
    scheduleCheckpointSave();
  };

  const handleRoomEvent = (event: RoomEvent) => {
    if (event.type === "workspace.updated") {
      canEmitWorkspaceState = true;
      const nextWorkspaceDocumentIds = new Set(
        event.workspace.nodes
          .filter((node) => node.type === "document" && node.id !== `live-${event.roomId}`)
          .map((node) => node.id),
      );
      if (nextWorkspaceDocumentIds.size === 0) {
        return;
      }

      workspaceDocumentIds = nextWorkspaceDocumentIds;
      const requestedActiveDocumentId =
        event.workspace.activeDocumentId && nextWorkspaceDocumentIds.has(event.workspace.activeDocumentId)
          ? event.workspace.activeDocumentId
          : nextWorkspaceDocumentIds.values().next().value;
      if (requestedActiveDocumentId) {
        activeDocumentId = requestedActiveDocumentId;
      }
      pruneWorkspaceTextDocuments(nextWorkspaceDocumentIds);
      for (const node of event.workspace.nodes) {
        if (node.type !== "document" || node.id === `live-${event.roomId}`) {
          continue;
        }
        getOrCreateTextDocument(node.id, {
          parentId: node.parentId,
          title: node.title,
        });
        const initialDocument = initialDocumentsById.get(node.id);
        initialDocumentsById.set(node.id, {
          id: node.id,
          title: node.title,
          text: initialDocument?.text ?? "",
          parentId: node.parentId,
        });
      }
    }
    if (event.type === "text.updated" || event.type === "workspace.updated") {
      scheduleCheckpointSave();
    }
    onRoomEvent?.(event);
  };

  const envelopeRouter = createCollabEnvelopeRouter({
    roomId,
    textAdapter: adapters.text,
    collaborators,
    canDecrypt: () => Boolean(roomKey),
    getTextDocumentForDocumentId: getOrCreateTextDocument,
    getSelfId: () => currentIdentity.id,
    decryptEnvelope: (envelope) => {
      if (!roomKey) {
        throw new Error("Room key is not available");
      }
      return adapters.crypto.decryptEnvelope(roomKey, envelope);
    },
    onTextChange: (text, change, nextDocumentId) => onTextChange(nextDocumentId ?? activeDocumentId, text, change),
    onRoomEvent: handleRoomEvent,
    publishCollaborators,
    emitRecoveryEvent,
  });

  const start = async () => {
    const startConfig = await resolveCollabStartConfig({
      encodedRoomKey,
      resolveBaseUrl: adapters.resolveRoomBaseUrl,
      importKey: adapters.crypto.importRoomKey,
    });
    if (startConfig.status === "blocked") {
      onStatusChange("failed");
      emitRecoveryEvent("invalid-message", startConfig.message);
      return;
    }
    roomKey = startConfig.roomKey;
    await loadCheckpoint();

    transport = adapters.createRoomTransport({
      baseUrl: startConfig.baseUrl,
      roomId,
      clientId: currentIdentity.id,
      handlers: createCollabTransportHandlers({
        isClosed: () => closedByClient,
        markJoined: () => sessionState.markJoined(),
        markOffline: (reason) => sessionState.markOffline(reason),
        setStatus: onStatusChange,
        emitCurrentState: emitCurrentDocumentStates,
        publishPresence,
        routeEnvelope: (envelope) => envelopeRouter.route(envelope),
        pruneCollaborators: (peerIds) => collaborators.prune(peerIds),
        clearCollaborators: () => collaborators.clear(),
        publishCollaborators,
        emitRecoveryEvent,
      }),
    });
    transport.connect();

    heartbeat = adapters.clock.setInterval(() => {
      void publishPresence();
    }, 5_000);
  };

  onStatusChange("connecting");
  void start();

  return {
    applyLocalText(nextText: string, patches?: readonly TextPatch[]) {
      if (patches?.length && collaborators.remapSelections(patches, nextText.length)) {
        publishCollaborators();
      }
      const activeTextDocument = getOrCreateTextDocument(activeDocumentId);
      adapters.text.applyLocalText(activeTextDocument, nextText, patches);
      if (nextText.length < LARGE_DOCUMENT_CHAR_THRESHOLD) {
        getWorkspaceUpdateBuffer(activeDocumentId, activeTextDocument).flush();
      }
    },
    applyLocalTextPatches(patches: readonly TextPatch[], docLength?: number) {
      if (patches.length === 0) {
        return;
      }
      if (typeof docLength === "number" && collaborators.remapSelections(patches, docLength)) {
        publishCollaborators();
      }
      adapters.text.applyLocalTextPatches(getOrCreateTextDocument(activeDocumentId), patches);
    },
    setActiveDocument(nextDocument: { documentId: string; fileTitle?: string; initialText?: string }) {
      activeDocumentId = nextDocument.documentId;
      if ("fileTitle" in nextDocument) {
        currentFileTitle = nextDocument.fileTitle ?? currentFileTitle;
      }
      getOrCreateTextDocument(nextDocument.documentId, {
        initialText: emitInitialWorkspaceState ? nextDocument.initialText : undefined,
        title: nextDocument.fileTitle,
      });
      if (nextDocument.fileTitle) {
        const existingDocument = initialDocumentsById.get(nextDocument.documentId);
        initialDocumentsById.set(nextDocument.documentId, {
          id: nextDocument.documentId,
          title: nextDocument.fileTitle,
          text: existingDocument?.text ?? nextDocument.initialText ?? "",
          parentId: existingDocument?.parentId,
        });
      }
      if (emitInitialWorkspaceState) {
        workspaceDocumentIds?.add(nextDocument.documentId);
      }
      schedulePresencePublish();
    },
    setWorkspaceDocuments,
    setPresence(nextPresence: { fileTitle?: string; selection?: LiveSelection }) {
      if ("fileTitle" in nextPresence) {
        currentFileTitle = nextPresence.fileTitle ?? currentFileTitle;
      }
      if ("selection" in nextPresence) {
        currentSelection = nextPresence.selection;
      }
      schedulePresencePublish();
    },
    setIdentity(nextIdentity: Collaborator) {
      currentIdentity = nextIdentity;
      schedulePresencePublish();
    },
    publishRoomEvent(event: RoomEvent) {
      void emitRoomEvent(event);
    },
    disconnect() {
      closedByClient = true;
      clearPresenceTimer();
      clearCheckpointSaveTimer();
      if (heartbeat) {
        adapters.clock.clearInterval(heartbeat);
      }
      for (const unsubscribeTextUpdate of unsubscribeTextUpdates.values()) {
        unsubscribeTextUpdate();
      }
      for (const buffer of workspaceUpdateBuffers.values()) {
        buffer.clear();
      }
      transport?.disconnect();
      for (const nextTextDocument of textDocuments.values()) {
        adapters.text.destroy(nextTextDocument);
      }
      onCollaboratorsChange([]);
    },
    flushRecoveryState() {
      clearCheckpointSaveTimer();
      void saveCheckpointNow();
    },
  };
};

export type CollabConnection = ReturnType<typeof createCollabConnection>;
