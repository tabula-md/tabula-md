import * as Y from "yjs";

import {
  createDefaultRoomTransport,
  type CreateRoomTransport,
  type RoomTransport,
} from "./roomTransport";
import type { EnvelopeKind } from "./roomProtocol";
import {
  decryptEnvelopeForRoom,
  encryptBytesForRoom,
  shouldStoreSnapshotAfterJoin,
} from "./collabRoom";
import { encodePresenceForRoom } from "./collabConnectionModel";
import { createCollaboratorRegistry } from "./collabCollaborators";
import { createCollabEnvelopeRouter } from "./collabEnvelopeRouter";
import { createCollabSessionState } from "./collabSessionState";
import { createCollabSnapshotSync } from "./collabSnapshotSync";
import { resolveCollabStartConfig } from "./collabStartConfig";
import { createCollabTransportHandlers } from "./collabTransportController";
import { createCollabUpdateBuffer } from "./collabUpdateBuffer";
import {
  applyLocalTextToYText,
  COLLAB_REMOTE_ORIGIN,
  createCollabTextDocument,
} from "./collabTextModel";
import type { TextChange, TextPatch } from "./textPatches";

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
  createRoomTransport?: CreateRoomTransport;
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
  createRoomTransport = createDefaultRoomTransport,
}: ConnectOptions) => {
  const textDocument = createCollabTextDocument(initialText);
  const { doc, text } = textDocument;
  const collaborators = createCollaboratorRegistry();
  let currentFileTitle = fileTitle;
  let currentSelection = selection;
  let currentIdentity = identity;
  let closedByClient = false;
  let heartbeat: number | undefined;
  let roomKey: CryptoKey | null = null;
  let transport: RoomTransport | null = null;
  let envelopeVersion = 0;
  let hasUnstoredLocalChanges = Boolean(initialText);
  let roomBaseUrl = "";
  const sessionState = createCollabSessionState();

  const emitRecoveryEvent = (type: CollabRecoveryEvent["type"], message: string) => {
    onRecoveryEvent?.({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      message,
      createdAt: new Date().toISOString(),
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
    return encryptBytesForRoom(roomKey, roomId, kind, envelopeVersion, plaintext);
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
    setTimeoutFn: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeoutFn: (handle) => window.clearTimeout(handle as number),
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
    textDocument,
    getBaseUrl: () => roomBaseUrl,
    canUseSnapshots: () => Boolean(roomKey) && !sessionState.isBlocked(),
    encryptSnapshot: (update) => encryptEnvelope("snapshot", update),
    decryptSnapshot: (envelope) => {
      if (!roomKey) {
        throw new Error("Room key is not available");
      }
      return decryptEnvelopeForRoom(roomKey, envelope);
    },
    onTextChange,
    onRoomMetaChange,
    onSnapshotStored: () => {
      hasUnstoredLocalChanges = false;
    },
    emitRecoveryEvent,
    setTimeoutFn: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeoutFn: (handle) => window.clearTimeout(handle as number),
  });

  const envelopeRouter = createCollabEnvelopeRouter({
    roomId,
    textDocument,
    collaborators,
    canDecrypt: () => Boolean(roomKey),
    getSelfId: () => currentIdentity.id,
    decryptEnvelope: (envelope) => {
      if (!roomKey) {
        throw new Error("Room key is not available");
      }
      return decryptEnvelopeForRoom(roomKey, envelope);
    },
    onTextChange,
    publishCollaborators,
    emitRecoveryEvent,
  });

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (closedByClient || origin === COLLAB_REMOTE_ORIGIN) {
      return;
    }

    hasUnstoredLocalChanges = true;
    localUpdateBuffer.push(update);
    snapshotSync.scheduleStore();
  });

  const start = async () => {
    const startConfig = await resolveCollabStartConfig({ encodedRoomKey });
    if (startConfig.status === "blocked") {
      onStatusChange("offline");
      emitRecoveryEvent("invalid-message", startConfig.message);
      return;
    }
    roomBaseUrl = startConfig.baseUrl;
    roomKey = startConfig.roomKey;

    transport = createRoomTransport({
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
        emitCurrentState: () => emitEnvelope("yjs-update", Y.encodeStateAsUpdate(doc)),
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

    heartbeat = window.setInterval(() => {
      void publishPresence();
    }, 5_000);
  };

  onStatusChange("connecting");
  void start();

  return {
    applyLocalText(nextText: string, patches?: readonly TextPatch[]) {
      applyLocalTextToYText({ doc, text, nextText, patches });
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
        window.clearInterval(heartbeat);
      }
      snapshotSync.clearTimer();
      localUpdateBuffer.clear();
      transport?.disconnect();
      doc.destroy();
      onCollaboratorsChange([]);
    },
  };
};

export type CollabConnection = ReturnType<typeof createCollabConnection>;
