import type { EnvelopeKind } from "./roomProtocol";
import { shouldStoreSnapshotAfterJoin } from "./collabRoom";
import { encodePresenceForRoom } from "./collabConnectionModel";
import { createDefaultCollabRuntimeAdapters } from "./collabDefaultAdapters";
import { createCollaboratorRegistry } from "./collabCollaborators";
import { createCollabEnvelopeRouter } from "./collabEnvelopeRouter";
import type { CollabRuntimeAdapters } from "./collabRuntimeAdapters";
import { createCollabSessionState } from "./collabSessionState";
import { createCollabSnapshotSync } from "./collabSnapshotSync";
import { resolveCollabStartConfig } from "./collabStartConfig";
import { createCollabTransportHandlers } from "./collabTransportController";
import { createCollabUpdateBuffer } from "./collabUpdateBuffer";
import { LARGE_DOCUMENT_CHAR_THRESHOLD, type TextChange, type TextPatch } from "@tabula-md/tabula";

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
  shouldStoreSnapshotAfterJoin,
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
  roomId?: string;
  fileTitle?: string;
  selection?: LiveSelection;
};

export type RoomSnapshot = {
  id: string;
  createdAt: string;
  textLength: number;
  updateSize: number;
  version: number;
};

export type RoomMeta = {
  roomId: string;
  version: number;
  snapshotCount: number;
  lastSavedAt?: string;
  lastUpdatedAt?: string;
  snapshots: RoomSnapshot[];
};

export type CollabRecoveryEvent = {
  id: string;
  type: "reconnected" | "snapshot-recovered" | "invalid-message";
  message: string;
  createdAt: string;
};

type ConnectOptions = {
  roomId: string;
  roomKey: string;
  initialText?: string;
  identity: Collaborator;
  fileTitle: string;
  selection?: LiveSelection;
  onTextChange: (text: string, change?: TextChange) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onCollaboratorsChange: (collaborators: Collaborator[]) => void;
  onRoomMetaChange?: (meta: RoomMeta) => void;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
  adapters?: CollabRuntimeAdapters;
};

const PRESENCE_SEND_THROTTLE_MS = 75;
const STATE_REPAIR_SYNC_DEBOUNCE_MS = 750;
const STATE_REPAIR_SYNC_INTERVAL_MS = 10_000;
const STATE_REPAIR_SYNC_COUNT_AFTER_LOCAL_UPDATE = 2;

export const createCollabConnection = ({
  roomId,
  roomKey: encodedRoomKey,
  initialText,
  identity,
  fileTitle,
  selection,
  onTextChange,
  onStatusChange,
  onCollaboratorsChange,
  onRoomMetaChange,
  onRecoveryEvent,
  adapters = createDefaultCollabRuntimeAdapters(),
}: ConnectOptions) => {
  const textDocument = adapters.text.createDocument(initialText);
  const collaborators = createCollaboratorRegistry();
  let currentFileTitle = fileTitle;
  let currentSelection = selection;
  let currentIdentity = identity;
  let closedByClient = false;
  let heartbeat: unknown;
  let presenceTimer: unknown;
  let stateRepairSyncTimer: unknown;
  let stateRepairSyncBurstTimer: unknown;
  let roomKey: CryptoKey | null = null;
  let transport: ReturnType<CollabRuntimeAdapters["createRoomTransport"]> | null = null;
  let envelopeVersion = 0;
  let hasUnstoredLocalChanges = Boolean(initialText);
  let pendingStateRepairSyncs = initialText ? STATE_REPAIR_SYNC_COUNT_AFTER_LOCAL_UPDATE : 0;
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

  const localUpdateBuffer = createCollabUpdateBuffer({
    delayMs: 25,
    onFlush: (update) => {
      void emitEnvelope("yjs-update", update);
    },
    mergeUpdates: adapters.text.mergeUpdates,
    setTimeoutFn: adapters.clock.setTimeout,
    clearTimeoutFn: adapters.clock.clearTimeout,
  });

  const clearPresenceTimer = () => {
    if (!presenceTimer) {
      return;
    }

    adapters.clock.clearTimeout(presenceTimer);
    presenceTimer = undefined;
  };

  const publishPresence = async () => {
    await emitEnvelope(
      "presence",
      encodePresenceForRoom({
        identity: currentIdentity,
        roomId,
        fileTitle: currentFileTitle,
        selection: currentSelection,
      }),
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

  const publishStateRepairSync = () => {
    if (closedByClient || pendingStateRepairSyncs <= 0) {
      return;
    }

    pendingStateRepairSyncs -= 1;
    void emitEnvelope("state-init", adapters.text.encodeState(textDocument));
  };

  const clearStateRepairSyncBurstTimer = () => {
    if (!stateRepairSyncBurstTimer) {
      return;
    }

    adapters.clock.clearTimeout(stateRepairSyncBurstTimer);
    stateRepairSyncBurstTimer = undefined;
  };

  const scheduleStateRepairSyncBurst = () => {
    if (closedByClient) {
      return;
    }

    clearStateRepairSyncBurstTimer();
    stateRepairSyncBurstTimer = adapters.clock.setTimeout(() => {
      stateRepairSyncBurstTimer = undefined;
      publishStateRepairSync();
    }, STATE_REPAIR_SYNC_DEBOUNCE_MS);
  };

  const markStateRepairSyncNeeded = () => {
    pendingStateRepairSyncs = STATE_REPAIR_SYNC_COUNT_AFTER_LOCAL_UPDATE;
    scheduleStateRepairSyncBurst();
  };

  const snapshotSync = createCollabSnapshotSync({
    roomId,
    roomKey: encodedRoomKey,
    textAdapter: adapters.text,
    textDocument,
    canUseSnapshots: () => Boolean(roomKey) && !sessionState.isBlocked(),
    recoveryStore: adapters.roomRecoveryStore,
    mergeStates: adapters.text.mergeUpdates,
    onTextChange,
    onRoomMetaChange,
    onSnapshotStored: () => {
      hasUnstoredLocalChanges = false;
    },
    emitRecoveryEvent,
    setTimeoutFn: adapters.clock.setTimeout,
    clearTimeoutFn: adapters.clock.clearTimeout,
    requestIdleCallbackFn: adapters.clock.requestIdleCallback,
    cancelIdleCallbackFn: adapters.clock.cancelIdleCallback,
  });

  const envelopeRouter = createCollabEnvelopeRouter({
    roomId,
    textAdapter: adapters.text,
    textDocument,
    collaborators,
    canDecrypt: () => Boolean(roomKey),
    getSelfId: () => currentIdentity.id,
    decryptEnvelope: (envelope) => {
      if (!roomKey) {
        throw new Error("Room key is not available");
      }
      return adapters.crypto.decryptEnvelope(roomKey, envelope);
    },
    onTextChange,
    publishCollaborators,
    emitRecoveryEvent,
  });

  const unsubscribeTextUpdates = adapters.text.observeUpdates(textDocument, (update, origin) => {
    if (closedByClient || adapters.text.isRemoteOrigin(origin)) {
      return;
    }

    hasUnstoredLocalChanges = true;
    markStateRepairSyncNeeded();
    localUpdateBuffer.push(update);
    snapshotSync.scheduleStore();
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

    transport = adapters.createRoomTransport({
      baseUrl: startConfig.baseUrl,
      roomId,
      clientId: currentIdentity.id,
      handlers: createCollabTransportHandlers({
        isClosed: () => closedByClient,
        fetchSnapshot: () => snapshotSync.fetch(),
        markJoined: () => sessionState.markJoined(),
        markOffline: (reason) => sessionState.markOffline(reason),
        setStatus: onStatusChange,
        emitCurrentState: () => emitEnvelope("yjs-update", adapters.text.encodeState(textDocument)),
        emitStateInit: () => emitEnvelope("state-init", adapters.text.encodeState(textDocument)),
        publishPresence,
        shouldStoreSnapshot: (snapshotFetchResult) =>
          shouldStoreSnapshotAfterJoin({ hasUnstoredLocalChanges, snapshotFetchResult }),
        storeSnapshot: () => snapshotSync.store(),
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
    stateRepairSyncTimer = adapters.clock.setInterval(publishStateRepairSync, STATE_REPAIR_SYNC_INTERVAL_MS);
  };

  onStatusChange("connecting");
  void start();

  return {
    applyLocalText(nextText: string, patches?: readonly TextPatch[]) {
      if (patches?.length && collaborators.remapSelections(patches, nextText.length)) {
        publishCollaborators();
      }
      adapters.text.applyLocalText(textDocument, nextText, patches);
      if (nextText.length < LARGE_DOCUMENT_CHAR_THRESHOLD) {
        localUpdateBuffer.flush();
      }
    },
    applyLocalTextPatches(patches: readonly TextPatch[], docLength?: number) {
      if (patches.length === 0) {
        return;
      }
      if (typeof docLength === "number" && collaborators.remapSelections(patches, docLength)) {
        publishCollaborators();
      }
      adapters.text.applyLocalTextPatches(textDocument, patches);
    },
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
    disconnect() {
      closedByClient = true;
      clearPresenceTimer();
      if (heartbeat) {
        adapters.clock.clearInterval(heartbeat);
      }
      if (stateRepairSyncTimer) {
        adapters.clock.clearInterval(stateRepairSyncTimer);
      }
      clearStateRepairSyncBurstTimer();
      unsubscribeTextUpdates();
      snapshotSync.clearTimer();
      if (hasUnstoredLocalChanges) {
        void snapshotSync.store();
      }
      localUpdateBuffer.clear();
      transport?.disconnect();
      adapters.text.destroy(textDocument);
      onCollaboratorsChange([]);
    },
    flushRecoveryState() {
      if (hasUnstoredLocalChanges) {
        void snapshotSync.store();
      }
    },
  };
};

export type CollabConnection = ReturnType<typeof createCollabConnection>;
