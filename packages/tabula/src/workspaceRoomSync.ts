import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as Y from "yjs";
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  type Awareness,
} from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import {
  createRoomChunkAssembler,
  decodeRoomWirePacket,
  encodeRoomWirePackets,
  ROOM_WIRE_CHUNK_BYTES,
  ROOM_WIRE_MAX_CRDT_STATE_BYTES,
  type RoomWireDataPacket,
} from "./roomBinaryProtocol";
import { hasRoomCapability, type RoomActor } from "./roomCollaboration";
import {
  validateRoomPayload,
  type EncryptedEnvelope,
  type EnvelopeKind,
} from "./room/envelope";

const MAX_INBOUND_ENVELOPES = 64;
const MAX_INBOUND_BUFFER_CHARS = 32 * 1024 * 1024;
const MAX_ENCRYPTED_ENVELOPE_CHARS = Math.ceil((ROOM_WIRE_CHUNK_BYTES + 2_048) * 4 / 3);
const UPDATE_RETRY_MAX_DELAY_MS = 30_000;
const UPDATE_RETRY_BASE_DELAY_MS = 500;

export const REMOTE_SYNC_ORIGIN = Symbol("tabula.remote-sync");
export const REMOTE_AWARENESS_ORIGIN = Symbol("tabula.remote-awareness");

export type RemoteSyncOrigin = {
  type: typeof REMOTE_SYNC_ORIGIN;
  senderId: string;
};

export const isRemoteSyncOrigin = (origin: unknown): origin is RemoteSyncOrigin =>
  Boolean(
    origin &&
    typeof origin === "object" &&
    (origin as Partial<RemoteSyncOrigin>).type === REMOTE_SYNC_ORIGIN,
  );

type SendPacketResult = "sent" | "offline" | "failed" | "discarded";

export type WorkspaceRoomSyncClock = {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  createId(): string;
};

export type WorkspaceRoomSyncCrypto = {
  encryptEnvelope(
    roomKey: CryptoKey,
    roomId: string,
    kind: EnvelopeKind,
    version: number,
    plaintext: Uint8Array,
  ): Promise<EncryptedEnvelope>;
  decryptEnvelope(roomKey: CryptoKey, envelope: EncryptedEnvelope): Promise<Uint8Array>;
};

export type WorkspaceRoomTransportHandlers = {
  onConnect: () => void;
  onJoined: (message: { roomId: string; clientId: string; peerCount: number }) => void;
  onPeerJoined: (message: { roomId: string; clientId: string }) => void;
  onMessage: (envelope: unknown) => void;
  onPeers: (message: { roomId: string; peers: string[] }) => void;
  onError: (message: { error?: string }) => void;
  onDisconnect: () => void;
  onConnectError: () => void;
};

export type WorkspaceRoomTransport = {
  readonly connected: boolean;
  connect(): void;
  sendEnvelope(envelope: EncryptedEnvelope): void;
  sendVolatileEnvelope(envelope: EncryptedEnvelope): void;
  disconnect(): void;
};

export type WorkspaceRoomSyncAdapters = {
  clock: WorkspaceRoomSyncClock;
  crypto: WorkspaceRoomSyncCrypto;
  createRoomTransport(options: {
    baseUrl: string;
    roomId: string;
    clientId: string;
    handlers: WorkspaceRoomTransportHandlers;
  }): WorkspaceRoomTransport;
};

type TransportLifecycleHandlers = Omit<WorkspaceRoomTransportHandlers, "onMessage">;

export type WorkspaceRoomSyncControllerOptions = {
  roomId: string;
  doc: Y.Doc;
  awareness: Awareness;
  adapters: WorkspaceRoomSyncAdapters;
  isClosed: () => boolean;
  getIdentityId: () => string;
  getSenderActor: (senderId: string) => RoomActor | null;
  onCapacityExceeded: () => void;
  onInvalidMessage: (message: string) => void;
  onRemoteSyncApplied?: (message: { senderId: string; changed: boolean }) => void;
  onUnsupportedMessage: () => void;
};

const byteArraysEqual = (first: Uint8Array, second: Uint8Array) =>
  first.byteLength === second.byteLength &&
  first.every((value, index) => value === second[index]);

export const createWorkspaceRoomSyncController = ({
  roomId,
  doc,
  awareness,
  adapters,
  isClosed,
  getIdentityId,
  getSenderActor,
  onCapacityExceeded,
  onInvalidMessage,
  onRemoteSyncApplied,
  onUnsupportedMessage,
}: WorkspaceRoomSyncControllerOptions) => {
  const chunkAssembler = createRoomChunkAssembler();
  const pendingAwarenessClients = new Set<number>();
  const inboundEnvelopes: Array<{ envelope: EncryptedEnvelope; bufferedChars: number }> = [];
  let roomKey: CryptoKey | null = null;
  let transport: WorkspaceRoomTransport | null = null;
  let envelopeVersion = 0;
  let outboundQueue: Promise<SendPacketResult> = Promise.resolve("sent");
  let pendingLocalUpdate: Uint8Array | null = null;
  let localUpdateSendInFlight = false;
  let localUpdateRetryTimer: unknown;
  let localUpdateRetryAttempt = 0;
  let awarenessSendInFlight = false;
  let pendingAwarenessReliable = false;
  let syncStep1SendInFlight = false;
  let syncStep1Pending = false;
  let inboundBufferedChars = 0;
  let inboundProcessing = false;
  let disposed = false;

  const unavailable = () => disposed || isClosed();

  const sendPacket = (packet: RoomWireDataPacket, volatile = false) => {
    if (packet.type === "sync.message" && packet.payload.byteLength > ROOM_WIRE_MAX_CRDT_STATE_BYTES) {
      onCapacityExceeded();
      return Promise.resolve<SendPacketResult>("discarded");
    }
    const task: Promise<SendPacketResult> = outboundQueue.then(async () => {
      if (unavailable() || !roomKey || !transport?.connected) return "offline";
      const packets = encodeRoomWirePackets(packet, adapters.clock.createId);
      for (const plaintext of packets) {
        if (unavailable() || !transport?.connected) return "offline";
        envelopeVersion += 1;
        const envelope = await adapters.crypto.encryptEnvelope(
          roomKey,
          roomId,
          "room-event",
          envelopeVersion,
          plaintext,
        );
        if (unavailable() || !transport?.connected) return "offline";
        if (volatile) transport.sendVolatileEnvelope(envelope);
        else transport.sendEnvelope(envelope);
      }
      return "sent";
    });
    outboundQueue = task.catch(() => {
      onInvalidMessage("A live collaboration update could not be sent.");
      return "failed";
    });
    return outboundQueue;
  };

  const flushSyncStep1 = () => {
    if (unavailable() || syncStep1SendInFlight || !syncStep1Pending) return;
    syncStep1Pending = false;
    syncStep1SendInFlight = true;
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, doc);
    void sendPacket({
      type: "sync.message",
      senderId: getIdentityId(),
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
    if (unavailable() || awarenessSendInFlight || pendingAwarenessClients.size === 0) return;
    const clients = [...pendingAwarenessClients];
    const volatile = !pendingAwarenessReliable;
    pendingAwarenessClients.clear();
    pendingAwarenessReliable = false;
    awarenessSendInFlight = true;
    const payload = encodeAwarenessUpdate(awareness, clients);
    void sendPacket({
      type: "awareness.updated",
      senderId: getIdentityId(),
      payload,
    }, volatile).finally(() => {
      awarenessSendInFlight = false;
      flushAwareness();
    });
  };

  const publishAwareness = (clients = [awareness.clientID], volatile = true) => {
    for (const clientId of clients) pendingAwarenessClients.add(clientId);
    if (!volatile) pendingAwarenessReliable = true;
    flushAwareness();
  };

  const clearLocalUpdateRetry = () => {
    if (!localUpdateRetryTimer) return;
    adapters.clock.clearTimeout(localUpdateRetryTimer);
    localUpdateRetryTimer = undefined;
  };

  function scheduleLocalUpdateRetry() {
    if (unavailable() || localUpdateRetryTimer) return;
    const delay = Math.min(
      UPDATE_RETRY_MAX_DELAY_MS,
      UPDATE_RETRY_BASE_DELAY_MS * (2 ** localUpdateRetryAttempt),
    );
    localUpdateRetryAttempt += 1;
    localUpdateRetryTimer = adapters.clock.setTimeout(() => {
      localUpdateRetryTimer = undefined;
      flushLocalUpdates();
    }, delay);
  }

  function flushLocalUpdates() {
    if (unavailable() || localUpdateSendInFlight || !pendingLocalUpdate || !transport?.connected) return;
    const update = pendingLocalUpdate;
    pendingLocalUpdate = null;
    localUpdateSendInFlight = true;
    const encoder = encoding.createEncoder();
    syncProtocol.writeUpdate(encoder, update);
    void sendPacket({
      type: "sync.message",
      senderId: getIdentityId(),
      payload: encoding.toUint8Array(encoder),
    }).then((result) => {
      if (result !== "sent" && !unavailable()) {
        pendingLocalUpdate = pendingLocalUpdate
          ? Y.mergeUpdates([update, pendingLocalUpdate])
          : update;
        if (result === "failed") scheduleLocalUpdateRetry();
      } else if (result === "sent") {
        localUpdateRetryAttempt = 0;
      }
    }).finally(() => {
      localUpdateSendInFlight = false;
      if (!localUpdateRetryTimer) flushLocalUpdates();
    });
  }

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
    const previousStateVector = Y.encodeStateVector(doc);
    syncProtocol.readSyncMessage(decoder, reply, doc, {
      type: REMOTE_SYNC_ORIGIN,
      senderId: packet.senderId,
    } satisfies RemoteSyncOrigin, () => {
      onInvalidMessage("A malformed collaboration update was ignored.");
    });
    onRemoteSyncApplied?.({
      senderId: packet.senderId,
      changed: !byteArraysEqual(previousStateVector, Y.encodeStateVector(doc)),
    });
    if (encoding.length(reply) > 0) {
      await sendPacket({
        type: "sync.message",
        senderId: getIdentityId(),
        payload: encoding.toUint8Array(reply),
      });
    }
  };

  const handleDataPacket = async (packet: RoomWireDataPacket) => {
    if (packet.senderId === getIdentityId()) return;
    if (packet.type === "awareness.updated") {
      applyAwarenessUpdate(awareness, packet.payload, REMOTE_AWARENESS_ORIGIN);
      return;
    }
    await handleSyncMessage(packet);
  };

  const processEnvelope = async (envelope: EncryptedEnvelope) => {
    if (unavailable() || !roomKey) return;
    try {
      const plaintext = await adapters.crypto.decryptEnvelope(roomKey, envelope);
      const decoded = decodeRoomWirePacket(plaintext);
      if (!decoded.ok) {
        if (decoded.reason === "unsupported") onUnsupportedMessage();
        onInvalidMessage("An unsupported collaboration message was ignored.");
        return;
      }
      if (decoded.packet.type === "sync.chunk") {
        const assembled = chunkAssembler.push(decoded.packet);
        if (assembled) await handleDataPacket(assembled);
      } else {
        await handleDataPacket(decoded.packet);
      }
    } catch {
      onInvalidMessage("An encrypted collaboration message could not be opened.");
    }
  };

  const drainInboundEnvelopes = async () => {
    if (inboundProcessing) return;
    inboundProcessing = true;
    try {
      while (!unavailable() && inboundEnvelopes.length > 0) {
        const next = inboundEnvelopes.shift()!;
        inboundBufferedChars -= next.bufferedChars;
        await processEnvelope(next.envelope);
      }
    } finally {
      inboundProcessing = false;
    }
  };

  const routeEnvelope = (value: unknown) => {
    if (unavailable()) return;
    if (!validateRoomPayload(value) || value.roomId !== roomId || value.kind !== "room-event") {
      onInvalidMessage("A collaboration server message was ignored.");
      return;
    }
    const bufferedChars = value.ciphertext.length + value.iv.length;
    if (
      value.ciphertext.length > MAX_ENCRYPTED_ENVELOPE_CHARS ||
      inboundEnvelopes.length >= MAX_INBOUND_ENVELOPES ||
      inboundBufferedChars + bufferedChars > MAX_INBOUND_BUFFER_CHARS
    ) {
      onInvalidMessage("An oversized collaboration message was ignored.");
      return;
    }
    inboundEnvelopes.push({ envelope: value, bufferedChars });
    inboundBufferedChars += bufferedChars;
    void drainInboundEnvelopes();
  };

  return {
    setRoomKey(key: CryptoKey) {
      roomKey = key;
    },
    connect(baseUrl: string, handlers: TransportLifecycleHandlers) {
      transport?.disconnect();
      const nextTransport = adapters.createRoomTransport({
        baseUrl,
        roomId,
        clientId: getIdentityId(),
        handlers: { ...handlers, onMessage: routeEnvelope },
      });
      transport = nextTransport;
      nextTransport.connect();
    },
    disconnectTransport() {
      clearLocalUpdateRetry();
      transport?.disconnect();
      transport = null;
    },
    isConnected: () => Boolean(transport?.connected),
    onJoined() {
      publishAwareness([awareness.clientID], false);
      sendSyncStep1();
      clearLocalUpdateRetry();
      localUpdateRetryAttempt = 0;
      flushLocalUpdates();
    },
    onPeerJoined() {
      publishAwareness([awareness.clientID], false);
      sendSyncStep1();
    },
    onTransportDisconnected: clearLocalUpdateRetry,
    handleLocalUpdate(update: Uint8Array) {
      pendingLocalUpdate = pendingLocalUpdate ? Y.mergeUpdates([pendingLocalUpdate, update]) : update;
      flushLocalUpdates();
    },
    handleAwarenessUpdate(
      changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) {
      if (origin !== REMOTE_AWARENESS_ORIGIN && !unavailable()) {
        publishAwareness([...changes.added, ...changes.updated, ...changes.removed]);
      }
    },
    publishAwareness,
    pruneChunks: () => chunkAssembler.prune(),
    getResourceCounts: () => ({
      inboundEnvelopes: inboundEnvelopes.length,
      inboundBufferedChars,
      pendingAwarenessClients: pendingAwarenessClients.size,
      pendingLocalUpdateBytes: pendingLocalUpdate?.byteLength ?? 0,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      clearLocalUpdateRetry();
      transport?.disconnect();
      transport = null;
      roomKey = null;
      pendingLocalUpdate = null;
      pendingAwarenessClients.clear();
      syncStep1Pending = false;
      inboundEnvelopes.length = 0;
      inboundBufferedChars = 0;
      chunkAssembler.clear();
    },
  };
};

export type WorkspaceRoomSyncController = ReturnType<typeof createWorkspaceRoomSyncController>;
