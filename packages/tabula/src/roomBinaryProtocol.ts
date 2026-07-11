import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";

export const ROOM_WIRE_PROTOCOL_VERSION = 2;
export const ROOM_WIRE_CHUNK_BYTES = 256 * 1024;
export const ROOM_WIRE_CHUNK_PAYLOAD_BYTES = ROOM_WIRE_CHUNK_BYTES - 1024;
export const ROOM_WIRE_MAX_MESSAGE_BYTES = 16 * 1024 * 1024;
export const ROOM_WIRE_MAX_CRDT_STATE_BYTES = 12 * 1024 * 1024;
export const ROOM_WIRE_MAX_CHUNKS = 64;
export const ROOM_WIRE_MAX_INFLIGHT_PER_ACTOR = 4;
export const ROOM_WIRE_CHUNK_TTL_MS = 10_000;
export const ROOM_WIRE_MAX_BUFFERED_BYTES = 64 * 1024 * 1024;

export type RoomWirePacketType = "sync.message" | "awareness.updated";

export type RoomWireDataPacket = {
  type: RoomWirePacketType;
  senderId: string;
  payload: Uint8Array;
};

export type RoomWireChunkPacket = {
  type: "sync.chunk";
  senderId: string;
  messageId: string;
  chunkIndex: number;
  chunkCount: number;
  totalBytes: number;
  payload: Uint8Array;
};

export type RoomWirePacket = RoomWireDataPacket | RoomWireChunkPacket;

export type RoomWirePacketDecodeResult =
  | { ok: true; packet: RoomWirePacket }
  | { ok: false; reason: "invalid" | "unsupported" | "oversized" };

const packetTypeCodes: Record<RoomWirePacket["type"], number> = {
  "sync.message": 0,
  "awareness.updated": 1,
  "sync.chunk": 2,
};

const packetTypesByCode = new Map<number, RoomWirePacket["type"]>([
  [0, "sync.message"],
  [1, "awareness.updated"],
  [2, "sync.chunk"],
]);

const validSenderId = (senderId: string) =>
  senderId.length > 0 && senderId.length <= 120 && !senderId.includes("\0") && !/[\r\n]/.test(senderId);

export const encodeRoomWirePacket = (packet: RoomWirePacket) => {
  if (!validSenderId(packet.senderId)) {
    throw new Error("Room packet sender is invalid.");
  }
  if (packet.payload.byteLength > ROOM_WIRE_MAX_MESSAGE_BYTES) {
    throw new Error("Room packet exceeds the maximum message size.");
  }

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, ROOM_WIRE_PROTOCOL_VERSION);
  encoding.writeVarUint(encoder, packetTypeCodes[packet.type]);
  encoding.writeVarString(encoder, packet.senderId);
  if (packet.type === "sync.chunk") {
    encoding.writeVarString(encoder, packet.messageId);
    encoding.writeVarUint(encoder, packet.chunkIndex);
    encoding.writeVarUint(encoder, packet.chunkCount);
    encoding.writeVarUint(encoder, packet.totalBytes);
  }
  encoding.writeVarUint8Array(encoder, packet.payload);
  return encoding.toUint8Array(encoder);
};

export const decodeRoomWirePacket = (bytes: Uint8Array): RoomWirePacketDecodeResult => {
  if (bytes.byteLength === 0 || bytes.byteLength > ROOM_WIRE_MAX_MESSAGE_BYTES + 1024) {
    return { ok: false, reason: bytes.byteLength === 0 ? "invalid" : "oversized" };
  }
  try {
    const decoder = decoding.createDecoder(bytes);
    const version = decoding.readVarUint(decoder);
    if (version !== ROOM_WIRE_PROTOCOL_VERSION) {
      return { ok: false, reason: "unsupported" };
    }
    const type = packetTypesByCode.get(decoding.readVarUint(decoder));
    const senderId = decoding.readVarString(decoder);
    if (!type || !validSenderId(senderId)) {
      return { ok: false, reason: "invalid" };
    }
    if (type !== "sync.chunk") {
      const payload = decoding.readVarUint8Array(decoder);
      return payload.byteLength <= ROOM_WIRE_MAX_MESSAGE_BYTES && !decoding.hasContent(decoder)
        ? { ok: true, packet: { type, senderId, payload } }
        : { ok: false, reason: payload.byteLength > ROOM_WIRE_MAX_MESSAGE_BYTES ? "oversized" : "invalid" };
    }

    const messageId = decoding.readVarString(decoder);
    const chunkIndex = decoding.readVarUint(decoder);
    const chunkCount = decoding.readVarUint(decoder);
    const totalBytes = decoding.readVarUint(decoder);
    const payload = decoding.readVarUint8Array(decoder);
    if (
      !messageId ||
      messageId.length > 120 ||
      chunkCount < 2 ||
      chunkCount > ROOM_WIRE_MAX_CHUNKS ||
      chunkIndex >= chunkCount ||
      totalBytes <= ROOM_WIRE_CHUNK_BYTES ||
      totalBytes > ROOM_WIRE_MAX_MESSAGE_BYTES ||
      payload.byteLength > ROOM_WIRE_CHUNK_PAYLOAD_BYTES ||
      decoding.hasContent(decoder)
    ) {
      return { ok: false, reason: totalBytes > ROOM_WIRE_MAX_MESSAGE_BYTES ? "oversized" : "invalid" };
    }
    return {
      ok: true,
      packet: {
        type,
        senderId,
        messageId,
        chunkIndex,
        chunkCount,
        totalBytes,
        payload,
      },
    };
  } catch {
    return { ok: false, reason: "invalid" };
  }
};

export const encodeRoomWirePackets = (
  packet: RoomWireDataPacket,
  createMessageId: () => string,
): Uint8Array[] => {
  const encoded = encodeRoomWirePacket(packet);
  if (encoded.byteLength <= ROOM_WIRE_CHUNK_BYTES) {
    return [encoded];
  }
  if (encoded.byteLength > ROOM_WIRE_MAX_MESSAGE_BYTES) {
    throw new Error("Room packet exceeds the maximum message size.");
  }
  const chunkCount = Math.ceil(encoded.byteLength / ROOM_WIRE_CHUNK_PAYLOAD_BYTES);
  if (chunkCount > ROOM_WIRE_MAX_CHUNKS) {
    throw new Error("Room packet exceeds the maximum chunk count.");
  }
  const messageId = createMessageId();
  return Array.from({ length: chunkCount }, (_, chunkIndex) => {
    const encodedChunk = encodeRoomWirePacket({
      type: "sync.chunk",
      senderId: packet.senderId,
      messageId,
      chunkIndex,
      chunkCount,
      totalBytes: encoded.byteLength,
      payload: encoded.subarray(
        chunkIndex * ROOM_WIRE_CHUNK_PAYLOAD_BYTES,
        Math.min(encoded.byteLength, (chunkIndex + 1) * ROOM_WIRE_CHUNK_PAYLOAD_BYTES),
      ),
    });
    if (encodedChunk.byteLength > ROOM_WIRE_CHUNK_BYTES) {
      throw new Error("Encoded room chunk exceeds the maximum chunk size.");
    }
    return encodedChunk;
  });
};

type PendingChunks = {
  senderId: string;
  messageId: string;
  chunkCount: number;
  totalBytes: number;
  createdAt: number;
  chunks: Map<number, Uint8Array>;
};

export type RoomChunkAssembler = {
  push(packet: RoomWireChunkPacket, now?: number): RoomWireDataPacket | null;
  clear(): void;
  prune(now?: number): void;
  readonly pendingCount: number;
};

export const createRoomChunkAssembler = (): RoomChunkAssembler => {
  const pending = new Map<string, PendingChunks>();

  const prune = (now = Date.now()) => {
    for (const [key, value] of pending) {
      if (now - value.createdAt >= ROOM_WIRE_CHUNK_TTL_MS) {
        pending.delete(key);
      }
    }
  };

  return {
    get pendingCount() {
      return pending.size;
    },
    clear() {
      pending.clear();
    },
    prune,
    push(packet, now = Date.now()) {
      prune(now);
      const key = `${packet.senderId}\u0000${packet.messageId}`;
      let entry = pending.get(key);
      if (!entry) {
        const actorEntries = Array.from(pending.values())
          .filter((candidate) => candidate.senderId === packet.senderId)
          .sort((first, second) => first.createdAt - second.createdAt);
        while (actorEntries.length >= ROOM_WIRE_MAX_INFLIGHT_PER_ACTOR) {
          const oldest = actorEntries.shift();
          if (oldest) pending.delete(`${oldest.senderId}\u0000${oldest.messageId}`);
        }
        const reservedBytes = Array.from(pending.values())
          .reduce((total, candidate) => total + candidate.totalBytes, 0);
        if (reservedBytes + packet.totalBytes > ROOM_WIRE_MAX_BUFFERED_BYTES) return null;
        entry = {
          senderId: packet.senderId,
          messageId: packet.messageId,
          chunkCount: packet.chunkCount,
          totalBytes: packet.totalBytes,
          createdAt: now,
          chunks: new Map(),
        };
        pending.set(key, entry);
      }
      if (entry.chunkCount !== packet.chunkCount || entry.totalBytes !== packet.totalBytes) {
        pending.delete(key);
        return null;
      }
      if (!entry.chunks.has(packet.chunkIndex)) {
        entry.chunks.set(packet.chunkIndex, packet.payload.slice());
      }
      if (entry.chunks.size !== entry.chunkCount) {
        return null;
      }
      const bytes = new Uint8Array(entry.totalBytes);
      let offset = 0;
      for (let index = 0; index < entry.chunkCount; index += 1) {
        const chunk = entry.chunks.get(index);
        if (!chunk || offset + chunk.byteLength > bytes.byteLength) {
          pending.delete(key);
          return null;
        }
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      pending.delete(key);
      if (offset !== bytes.byteLength) {
        return null;
      }
      const decoded = decodeRoomWirePacket(bytes);
      return decoded.ok && decoded.packet.type !== "sync.chunk" && decoded.packet.senderId === packet.senderId
        ? decoded.packet
        : null;
    },
  };
};
