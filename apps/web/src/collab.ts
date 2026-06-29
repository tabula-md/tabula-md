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
  importRoomKey,
  resolveTabulaRoomBaseUrl,
  ROOM_UNCONFIGURED_MESSAGE,
  shouldStoreSnapshotAfterJoin,
} from "./collabRoom";
import {
  decodePresence,
  encodePresenceForRoom,
  isEncryptedEnvelope,
} from "./collabConnectionModel";
import { createCollaboratorRegistry } from "./collabCollaborators";
import { fetchRoomMeta, fetchRoomSnapshotEnvelope, putRoomSnapshotEnvelope } from "./collabRoomClient";
import { createCollabUpdateBuffer } from "./collabUpdateBuffer";
import {
  applyLocalTextToYText,
  applyRemoteUpdateToYText,
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
  const { doc, text } = createCollabTextDocument(initialText);
  const collaborators = createCollaboratorRegistry();
  let currentFileTitle = fileTitle;
  let currentSelection = selection;
  let currentIdentity = identity;
  let closedByClient = false;
  let heartbeat: number | undefined;
  let snapshotTimer: number | undefined;
  let roomKey: CryptoKey | null = null;
  let transport: RoomTransport | null = null;
  let envelopeVersion = 0;
  let hasConnectedOnce = false;
  let hasUnstoredLocalChanges = Boolean(initialText);
  let collaborationBlocked = false;
  let serverOfflineNotified = false;
  let roomBaseUrl = "";

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

  const refreshRoomMeta = async () => {
    const meta = await fetchRoomMeta({ baseUrl: roomBaseUrl, roomId });
    if (meta) {
      onRoomMetaChange?.(meta);
    }
  };

  const encryptEnvelope = async (kind: EnvelopeKind, plaintext: Uint8Array) => {
    if (!roomKey) {
      throw new Error("Room key is not available");
    }

    envelopeVersion += 1;
    return encryptBytesForRoom(roomKey, roomId, kind, envelopeVersion, plaintext);
  };

  const emitEnvelope = async (kind: EnvelopeKind, plaintext: Uint8Array) => {
    if (!transport?.connected || !roomKey || collaborationBlocked) {
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

  const clearSnapshotTimer = () => {
    if (snapshotTimer) {
      window.clearTimeout(snapshotTimer);
      snapshotTimer = undefined;
    }
  };

  const storeSnapshot = async () => {
    if (!roomKey || collaborationBlocked) {
      return;
    }

    try {
      const snapshot = await encryptEnvelope("snapshot", Y.encodeStateAsUpdate(doc));
      const meta = await putRoomSnapshotEnvelope({ baseUrl: roomBaseUrl, roomId, envelope: snapshot });
      if (meta) {
        clearSnapshotTimer();
        hasUnstoredLocalChanges = false;
        onRoomMetaChange?.(meta);
      }
    } catch {
      emitRecoveryEvent("invalid-message", "The encrypted room snapshot could not be stored.");
    }
  };

  const scheduleSnapshot = () => {
    clearSnapshotTimer();
    snapshotTimer = window.setTimeout(() => {
      void storeSnapshot();
    }, 1_000);
  };

  const fetchSnapshot = async () => {
    if (!roomKey) {
      return false;
    }

    try {
      const snapshot = await fetchRoomSnapshotEnvelope({ baseUrl: roomBaseUrl, roomId });
      if (snapshot.status === "missing") {
        await refreshRoomMeta();
        return "missing" as const;
      }
      if (snapshot.status === "invalid") {
        emitRecoveryEvent("invalid-message", snapshot.message);
        return false;
      }

      const update = await decryptEnvelopeForRoom(roomKey, snapshot.envelope);
      const result = applyRemoteUpdateToYText({ doc, text, update });
      if (result) {
        onTextChange(result.text, result.change);
      }
      emitRecoveryEvent("snapshot-recovered", "Encrypted room snapshot restored.");
      await refreshRoomMeta();
      return "restored" as const;
    } catch {
      emitRecoveryEvent("invalid-message", "The encrypted room snapshot could not be decrypted.");
      return false;
    }
  };

  const applyIncomingEnvelope = async (envelope: unknown) => {
    if (!roomKey) {
      return;
    }

    if (!isEncryptedEnvelope(envelope) || envelope.roomId !== roomId) {
      emitRecoveryEvent("invalid-message", "A collaboration server message was ignored.");
      return;
    }

    try {
      const plaintext = await decryptEnvelopeForRoom(roomKey, envelope);
      if (envelope.kind === "yjs-update") {
        const result = applyRemoteUpdateToYText({ doc, text, update: plaintext });
        if (result) {
          onTextChange(result.text, result.change);
        }
        return;
      }

      if (envelope.kind === "presence") {
        const collaborator = decodePresence(plaintext);
        if (!collaborator) {
          return;
        }
        if (collaborators.upsert(collaborator, currentIdentity.id)) {
          publishCollaborators();
        }
      }
    } catch {
      emitRecoveryEvent("invalid-message", "An encrypted collaboration message could not be decrypted.");
    }
  };

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (closedByClient || origin === COLLAB_REMOTE_ORIGIN) {
      return;
    }

    hasUnstoredLocalChanges = true;
    localUpdateBuffer.push(update);
    scheduleSnapshot();
  });

  const start = async () => {
    const configuredRoomBaseUrl = resolveTabulaRoomBaseUrl();
    if (!configuredRoomBaseUrl) {
      onStatusChange("offline");
      emitRecoveryEvent("invalid-message", ROOM_UNCONFIGURED_MESSAGE);
      return;
    }
    roomBaseUrl = configuredRoomBaseUrl;

    const encodedKey = encodedRoomKey;
    if (!encodedKey) {
      onStatusChange("offline");
      emitRecoveryEvent("invalid-message", "This room URL is missing its client-only room key.");
      return;
    }

    try {
      roomKey = await importRoomKey(encodedKey);
    } catch {
      onStatusChange("offline");
      emitRecoveryEvent("invalid-message", "This room URL has an invalid room key.");
      return;
    }

    transport = createRoomTransport({
      baseUrl: roomBaseUrl,
      roomId,
      clientId: currentIdentity.id,
      handlers: {
        onConnect: () => {
          if (closedByClient) {
            return;
          }

          onStatusChange("connecting");
        },
        onJoined: async () => {
          if (closedByClient) {
            return;
          }

          const snapshotFetchResult = await fetchSnapshot();
          if (!snapshotFetchResult) {
            collaborationBlocked = true;
            onStatusChange("offline");
            transport?.disconnect();
            return;
          }

          onStatusChange("connected");
          if (hasConnectedOnce) {
            emitRecoveryEvent("reconnected", "Connection restored and room state was resynced.");
          }
          hasConnectedOnce = true;
          serverOfflineNotified = false;
          await emitEnvelope("yjs-update", Y.encodeStateAsUpdate(doc));
          await publishPresence();
          if (shouldStoreSnapshotAfterJoin({ hasUnstoredLocalChanges, snapshotFetchResult })) {
            await storeSnapshot();
          }
        },
        onMessage: (envelope) => {
          void applyIncomingEnvelope(envelope);
        },
        onPeers: (message) => {
          if (collaborators.prune(message.peers)) {
            publishCollaborators();
          }
        },
        onError: (message) => {
          emitRecoveryEvent("invalid-message", message.error || "A collaboration server message was ignored.");
        },
        onDisconnect: () => {
          if (closedByClient) {
            return;
          }

          onStatusChange("offline");
          collaborators.clear();
          publishCollaborators();
          if (hasConnectedOnce && !collaborationBlocked && !serverOfflineNotified) {
            serverOfflineNotified = true;
            emitRecoveryEvent(
              "invalid-message",
              "The collaboration server disconnected. Local edits will sync when it reconnects.",
            );
          }
        },
        onConnectError: () => {
          if (!closedByClient) {
            onStatusChange("offline");
            if (!collaborationBlocked && !serverOfflineNotified) {
              serverOfflineNotified = true;
              emitRecoveryEvent(
                "invalid-message",
                "The collaboration server is not reachable. Local edits stay in this browser.",
              );
            }
          }
        },
      },
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
      if (snapshotTimer) {
        window.clearTimeout(snapshotTimer);
      }
      localUpdateBuffer.clear();
      transport?.disconnect();
      doc.destroy();
      onCollaboratorsChange([]);
    },
  };
};

export type CollabConnection = ReturnType<typeof createCollabConnection>;
