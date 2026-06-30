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
import type { TextChange, TextPatch } from "../textPatches";

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

export type ConnectionStatus = "idle" | "connecting" | "connected" | "offline";

export type LiveSelection = {
  from: number;
  to: number;
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
  let roomKey: CryptoKey | null = null;
  let transport: ReturnType<CollabRuntimeAdapters["createRoomTransport"]> | null = null;
  let envelopeVersion = 0;
  let hasUnstoredLocalChanges = Boolean(initialText);
  let roomBaseUrl = "";
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

  const emitEnvelope = async (kind: EnvelopeKind, plaintext: Uint8Array) => {
    if (!transport?.connected || !roomKey || sessionState.isBlocked()) {
      return;
    }

    transport.sendEnvelope(await encryptEnvelope(kind, plaintext));
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

  const publishPresence = async () => {
    await emitEnvelope(
      "presence",
      encodePresenceForRoom({
        identity: currentIdentity,
        roomId,
        fileTitle: currentFileTitle,
        selection: currentSelection,
      }),
    );
  };

  const snapshotSync = createCollabSnapshotSync({
    roomId,
    textAdapter: adapters.text,
    textDocument,
    getBaseUrl: () => roomBaseUrl,
    canUseSnapshots: () => Boolean(roomKey) && !sessionState.isBlocked(),
    encryptSnapshot: (update) => encryptEnvelope("snapshot", update),
    decryptSnapshot: (envelope) => {
      if (!roomKey) {
        throw new Error("Room key is not available");
      }
      return adapters.crypto.decryptEnvelope(roomKey, envelope);
    },
    onTextChange,
    onRoomMetaChange,
    onSnapshotStored: () => {
      hasUnstoredLocalChanges = false;
    },
    emitRecoveryEvent,
    fetcher: adapters.fetcher,
    setTimeoutFn: adapters.clock.setTimeout,
    clearTimeoutFn: adapters.clock.clearTimeout,
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
      onStatusChange("offline");
      emitRecoveryEvent("invalid-message", startConfig.message);
      return;
    }
    roomBaseUrl = startConfig.baseUrl;
    roomKey = startConfig.roomKey;

    transport = adapters.createRoomTransport({
      baseUrl: roomBaseUrl,
      roomId,
      clientId: currentIdentity.id,
      handlers: createCollabTransportHandlers({
        isClosed: () => closedByClient,
        fetchSnapshot: () => snapshotSync.fetch(),
        markJoinBlocked: () => sessionState.markJoinBlocked(),
        markJoined: () => sessionState.markJoined(),
        markOffline: (reason) => sessionState.markOffline(reason),
        setStatus: onStatusChange,
        disconnectTransport: () => transport?.disconnect(),
        emitCurrentState: () => emitEnvelope("yjs-update", adapters.text.encodeState(textDocument)),
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
  };

  onStatusChange("connecting");
  void start();

  return {
    applyLocalText(nextText: string, patches?: readonly TextPatch[]) {
      adapters.text.applyLocalText(textDocument, nextText, patches);
    },
    setPresence(nextPresence: { fileTitle?: string; selection?: LiveSelection }) {
      if ("fileTitle" in nextPresence) {
        currentFileTitle = nextPresence.fileTitle ?? currentFileTitle;
      }
      if ("selection" in nextPresence) {
        currentSelection = nextPresence.selection;
      }
      void publishPresence();
    },
    setIdentity(nextIdentity: Collaborator) {
      currentIdentity = nextIdentity;
      void publishPresence();
    },
    disconnect() {
      closedByClient = true;
      if (heartbeat) {
        adapters.clock.clearInterval(heartbeat);
      }
      unsubscribeTextUpdates();
      snapshotSync.clearTimer();
      localUpdateBuffer.clear();
      transport?.disconnect();
      adapters.text.destroy(textDocument);
      onCollaboratorsChange([]);
    },
  };
};

export type CollabConnection = ReturnType<typeof createCollabConnection>;
