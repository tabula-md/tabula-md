import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";

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
  onTextChange: (text: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onCollaboratorsChange: (collaborators: Collaborator[]) => void;
  onRoomMetaChange?: (meta: RoomMeta) => void;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
};

type EnvelopeKind = "yjs-update" | "presence" | "snapshot";

type EncryptedEnvelope = {
  v: 1;
  roomId: string;
  kind: EnvelopeKind;
  version: number;
  iv: string;
  ciphertext: string;
  createdAt: string;
};

type RoomServerMetadata = {
  roomId: string;
  activeConnections: number;
  snapshotVersion: number | null;
  updatedAt: string | null;
};

type RoomJoinedMessage = {
  roomId: string;
  clientId: string;
  peerCount: number;
};

type RoomPeersMessage = {
  roomId: string;
  peers: string[];
};

type PresencePayload = Collaborator & {
  fileTitle: string;
};

type RoomServiceLocation = Pick<Location, "hostname" | "protocol">;
type SnapshotFetchResult = "missing" | "restored";

type ResolveTabulaRoomUrlOptions = {
  configuredUrl?: string;
  isDev?: boolean;
  location?: RoomServiceLocation;
};

type RoomRouteLocation = Pick<Location, "hash" | "origin" | "pathname">;

export type TabulaRoomAvailability =
  | {
      available: true;
      baseUrl: string;
      unavailableReason: "";
    }
  | {
      available: false;
      baseUrl: "";
      unavailableReason: string;
    };

export type RoomSession = {
  roomId: string;
  roomKey: string;
  shareUrl: string;
};

export type ParsedRoomLocation = RoomSession;

export const shouldStoreSnapshotAfterJoin = ({
  hasUnstoredLocalChanges,
  snapshotFetchResult,
}: {
  hasUnstoredLocalChanges: boolean;
  snapshotFetchResult: SnapshotFetchResult;
}) => hasUnstoredLocalChanges || snapshotFetchResult === "missing";

const ROOM_ID_BYTES = 16;
const ROOM_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const ROOM_SERVER_PORT = 3002;
const REMOTE_ORIGIN = "tabula-room-remote";
const ROOM_UNCONFIGURED_MESSAGE =
  "Live collaboration needs a Tabula Room server. Configure VITE_TABULA_ROOM_URL to start sessions.";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const diffText = (oldText: string, nextText: string) => {
  let start = 0;
  while (
    start < oldText.length &&
    start < nextText.length &&
    oldText[start] === nextText[start]
  ) {
    start += 1;
  }

  let oldEnd = oldText.length;
  let nextEnd = nextText.length;
  while (
    oldEnd > start &&
    nextEnd > start &&
    oldText[oldEnd - 1] === nextText[nextEnd - 1]
  ) {
    oldEnd -= 1;
    nextEnd -= 1;
  }

  return {
    index: start,
    deleteCount: oldEnd - start,
    insertText: nextText.slice(start, nextEnd),
  };
};

export const encodeBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const generateRoomKey = () => {
  const bytes = new Uint8Array(ROOM_KEY_BYTES);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
};

export const generateRoomId = () => {
  const bytes = new Uint8Array(ROOM_ID_BYTES);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
};

export const parseRoomKeyFromHash = (hash: string) => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const roomKey = params.get("key");
  return roomKey?.trim() ? roomKey : null;
};

export const createRoomShareUrl = (origin: string, roomId: string, roomKey = generateRoomKey()) =>
  `${origin}/r/${encodeURIComponent(roomId)}#key=${roomKey}`;

export const parseRoomLocation = (location: RoomRouteLocation): ParsedRoomLocation | null => {
  const roomId = location.pathname.match(/^\/r\/([^/]+)$/)?.[1];
  const roomKey = parseRoomKeyFromHash(location.hash);

  if (!roomId || !roomKey) {
    return null;
  }

  return {
    roomId,
    roomKey,
    shareUrl: createRoomShareUrl(location.origin, roomId, roomKey),
  };
};

export const parseRoomShareUrl = (shareUrl: string): ParsedRoomLocation | null => {
  try {
    return parseRoomLocation(new URL(shareUrl));
  } catch {
    return null;
  }
};

export const createRoomSession = (origin: string): RoomSession => {
  const roomId = generateRoomId();
  const roomKey = generateRoomKey();

  return {
    roomId,
    roomKey,
    shareUrl: createRoomShareUrl(origin, roomId, roomKey),
  };
};

export const importRoomKey = async (encodedKey: string) => {
  const rawKey = decodeBase64Url(encodedKey);
  if (rawKey.byteLength !== ROOM_KEY_BYTES) {
    throw new Error("Room key must be 32 bytes");
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(rawKey), "AES-GCM", false, ["encrypt", "decrypt"]);
};

export const encryptBytesForRoom = async (
  roomKey: CryptoKey,
  roomId: string,
  kind: EnvelopeKind,
  version: number,
  plaintext: Uint8Array,
): Promise<EncryptedEnvelope> => {
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, roomKey, toArrayBuffer(plaintext)),
  );

  return {
    v: 1,
    roomId,
    kind,
    version,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(ciphertext),
    createdAt: new Date().toISOString(),
  };
};

export const decryptEnvelopeForRoom = async (roomKey: CryptoKey, envelope: EncryptedEnvelope) => {
  const iv = decodeBase64Url(envelope.iv);
  const ciphertext = decodeBase64Url(envelope.ciphertext);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, roomKey, toArrayBuffer(ciphertext)));
};

const toArrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const normalizeRoomBaseUrl = (configuredUrl?: string) => {
  const trimmedUrl = configuredUrl?.trim();
  if (!trimmedUrl) {
    return null;
  }

  return trimmedUrl.replace(/\/+$/, "");
};

export const resolveTabulaRoomBaseUrl = ({
  configuredUrl = import.meta.env.VITE_TABULA_ROOM_URL as string | undefined,
  isDev = import.meta.env.DEV,
  location = window.location,
}: ResolveTabulaRoomUrlOptions = {}) => {
  const configuredBaseUrl = normalizeRoomBaseUrl(configuredUrl);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (!isDev) {
    return null;
  }

  const protocol = location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${location.hostname}:${ROOM_SERVER_PORT}`;
};

export const getTabulaRoomAvailability = (): TabulaRoomAvailability => {
  const baseUrl = resolveTabulaRoomBaseUrl();
  return baseUrl
    ? { available: true, baseUrl, unavailableReason: "" }
    : { available: false, baseUrl: "", unavailableReason: ROOM_UNCONFIGURED_MESSAGE };
};

const createRoomApiUrl = (baseUrl: string, roomId: string, suffix = "") =>
  `${baseUrl}/v1/rooms/${encodeURIComponent(roomId)}${suffix}`;

const toRoomMeta = (metadata: RoomServerMetadata): RoomMeta => {
  const snapshotVersion = metadata.snapshotVersion ?? 0;
  const latestSnapshot =
    metadata.snapshotVersion && metadata.updatedAt
      ? [
          {
            id: "latest",
            createdAt: metadata.updatedAt,
            textLength: 0,
            updateSize: 0,
            version: metadata.snapshotVersion,
          },
        ]
      : [];

  return {
    roomId: metadata.roomId,
    version: snapshotVersion,
    snapshotCount: metadata.snapshotVersion ? 1 : 0,
    lastSavedAt: metadata.updatedAt ?? undefined,
    lastUpdatedAt: metadata.updatedAt ?? undefined,
    snapshots: latestSnapshot,
  };
};

const isEncryptedEnvelope = (value: unknown): value is EncryptedEnvelope => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const envelope = value as Partial<EncryptedEnvelope>;
  return (
    envelope.v === 1 &&
    typeof envelope.roomId === "string" &&
    ["yjs-update", "presence", "snapshot"].includes(String(envelope.kind)) &&
    typeof envelope.version === "number" &&
    typeof envelope.iv === "string" &&
    typeof envelope.ciphertext === "string" &&
    typeof envelope.createdAt === "string"
  );
};

const decodePresence = (bytes: Uint8Array): Collaborator | null => {
  try {
    const decoded = JSON.parse(textDecoder.decode(bytes)) as Partial<PresencePayload>;
    if (!decoded.id || !decoded.name || !decoded.color) {
      return null;
    }

    return {
      id: decoded.id,
      name: decoded.name,
      color: decoded.color,
      lastSeen: typeof decoded.lastSeen === "number" ? decoded.lastSeen : Date.now(),
      fileTitle: decoded.fileTitle,
      selection: decoded.selection,
    };
  } catch {
    return null;
  }
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
}: ConnectOptions) => {
  const doc = new Y.Doc();
  const text = doc.getText("markdown");
  const collaborators = new Map<string, Collaborator>();
  let currentFileTitle = fileTitle;
  let currentSelection = selection;
  let currentIdentity = identity;
  let closedByClient = false;
  let heartbeat: number | undefined;
  let snapshotTimer: number | undefined;
  let roomKey: CryptoKey | null = null;
  let socket: Socket | null = null;
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
    onCollaboratorsChange([...collaborators.values()].sort((first, second) => first.name.localeCompare(second.name)));
  };

  const refreshRoomMeta = async () => {
    try {
      const response = await fetch(createRoomApiUrl(roomBaseUrl, roomId));
      if (!response.ok) {
        return;
      }

      onRoomMetaChange?.(toRoomMeta((await response.json()) as RoomServerMetadata));
    } catch {
      // Room metadata is best-effort. Realtime sync uses encrypted websocket envelopes.
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
    if (!socket?.connected || !roomKey || collaborationBlocked) {
      return;
    }

    socket.emit("room:message", await encryptEnvelope(kind, plaintext));
  };

  const publishPresence = async () => {
    const payload: PresencePayload = {
      ...currentIdentity,
      fileTitle: currentFileTitle,
      selection: currentSelection,
      lastSeen: Date.now(),
    };
    await emitEnvelope("presence", textEncoder.encode(JSON.stringify(payload)));
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
      const response = await fetch(createRoomApiUrl(roomBaseUrl, roomId, "/snapshot"), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(snapshot),
      });

      if (response.ok) {
        clearSnapshotTimer();
        hasUnstoredLocalChanges = false;
        onRoomMetaChange?.(toRoomMeta((await response.json()) as RoomServerMetadata));
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
      const response = await fetch(createRoomApiUrl(roomBaseUrl, roomId, "/snapshot"));
      if (response.status === 404) {
        await refreshRoomMeta();
        return "missing" as const;
      }
      if (!response.ok) {
        emitRecoveryEvent("invalid-message", "The encrypted room snapshot could not be loaded.");
        return false;
      }

      const envelope = await response.json();
      if (!isEncryptedEnvelope(envelope) || envelope.roomId !== roomId || envelope.kind !== "snapshot") {
        emitRecoveryEvent("invalid-message", "A room snapshot was ignored because it was not a valid envelope.");
        return false;
      }

      const update = await decryptEnvelopeForRoom(roomKey, envelope);
      Y.applyUpdate(doc, update, REMOTE_ORIGIN);
      onTextChange(text.toString());
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
        Y.applyUpdate(doc, plaintext, REMOTE_ORIGIN);
        onTextChange(text.toString());
        return;
      }

      if (envelope.kind === "presence") {
        const collaborator = decodePresence(plaintext);
        if (!collaborator || collaborator.id === currentIdentity.id) {
          return;
        }
        collaborators.set(collaborator.id, collaborator);
        publishCollaborators();
      }
    } catch {
      emitRecoveryEvent("invalid-message", "An encrypted collaboration message could not be decrypted.");
    }
  };

  if (initialText) {
    doc.transact(() => {
      text.insert(0, initialText);
    }, "initial");
  }

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (closedByClient || origin === REMOTE_ORIGIN) {
      return;
    }

    hasUnstoredLocalChanges = true;
    void emitEnvelope("yjs-update", update);
    scheduleSnapshot();
  });

  text.observe(() => {
    onTextChange(text.toString());
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

    socket = io(roomBaseUrl, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      if (closedByClient) {
        return;
      }

      onStatusChange("connecting");
      socket?.emit("room:join", { roomId, clientId: currentIdentity.id });
    });

    socket.on("room:joined", async (_message: RoomJoinedMessage) => {
      if (closedByClient) {
        return;
      }

      const snapshotFetchResult = await fetchSnapshot();
      if (!snapshotFetchResult) {
        collaborationBlocked = true;
        onStatusChange("offline");
        socket?.disconnect();
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
    });

    socket.on("room:message", (envelope: unknown) => {
      void applyIncomingEnvelope(envelope);
    });

    socket.on("room:peers", (message: RoomPeersMessage) => {
      const peerIds = new Set(message.peers);
      for (const collaboratorId of collaborators.keys()) {
        if (!peerIds.has(collaboratorId)) {
          collaborators.delete(collaboratorId);
        }
      }
      publishCollaborators();
    });

    socket.on("room:error", (message: { error?: string }) => {
      emitRecoveryEvent("invalid-message", message.error || "A collaboration server message was ignored.");
    });

    socket.on("disconnect", () => {
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
    });

    socket.on("connect_error", () => {
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
    });

    heartbeat = window.setInterval(() => {
      void publishPresence();
    }, 5_000);
  };

  onStatusChange("connecting");
  void start();

  return {
    applyLocalText(nextText: string) {
      const currentText = text.toString();
      if (currentText === nextText) {
        return;
      }

      const patch = diffText(currentText, nextText);
      doc.transact(() => {
        if (patch.deleteCount > 0) {
          text.delete(patch.index, patch.deleteCount);
        }
        if (patch.insertText) {
          text.insert(patch.index, patch.insertText);
        }
      }, "local");
    },
    setPresence(nextPresence: { fileTitle?: string; selection?: LiveSelection }) {
      currentFileTitle = nextPresence.fileTitle ?? currentFileTitle;
      currentSelection = nextPresence.selection ?? currentSelection;
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
      socket?.disconnect();
      doc.destroy();
      onCollaboratorsChange([]);
    },
  };
};

export type CollabConnection = ReturnType<typeof createCollabConnection>;
