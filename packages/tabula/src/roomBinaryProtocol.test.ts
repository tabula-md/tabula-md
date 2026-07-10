import { describe, expect, it } from "vitest";
import {
  ROOM_WIRE_CHUNK_BYTES,
  ROOM_WIRE_CHUNK_TTL_MS,
  createRoomChunkAssembler,
  decodeRoomWirePacket,
  encodeRoomWirePacket,
  encodeRoomWirePackets,
} from "./roomBinaryProtocol";

describe("room binary protocol", () => {
  it("round-trips binary sync and awareness packets", () => {
    const packet = {
      type: "sync.message" as const,
      senderId: "human-1",
      payload: new Uint8Array([0, 1, 2, 255]),
    };
    expect(decodeRoomWirePacket(encodeRoomWirePacket(packet))).toEqual({ ok: true, packet });
  });

  it("chunks and reassembles large packets in any order", () => {
    const payload = new Uint8Array(ROOM_WIRE_CHUNK_BYTES * 2 + 41).fill(7);
    const encoded = encodeRoomWirePackets(
      { type: "sync.message", senderId: "agent-1", payload },
      () => "message-1",
    );
    expect(encoded.length).toBeGreaterThan(2);
    expect(encoded.every((bytes) => bytes.byteLength <= ROOM_WIRE_CHUNK_BYTES)).toBe(true);

    const assembler = createRoomChunkAssembler();
    let result = null;
    for (const bytes of encoded.reverse()) {
      const decoded = decodeRoomWirePacket(bytes);
      if (decoded.ok && decoded.packet.type === "sync.chunk") {
        result = assembler.push(decoded.packet) ?? result;
      }
    }
    expect(result).toEqual({ type: "sync.message", senderId: "agent-1", payload });
    expect(assembler.pendingCount).toBe(0);
  });

  it("expires incomplete messages", () => {
    const encoded = encodeRoomWirePackets(
      { type: "sync.message", senderId: "human-1", payload: new Uint8Array(ROOM_WIRE_CHUNK_BYTES + 10) },
      () => "message-1",
    );
    const first = decodeRoomWirePacket(encoded[0]);
    const assembler = createRoomChunkAssembler();
    if (!first.ok || first.packet.type !== "sync.chunk") throw new Error("expected chunk");
    assembler.push(first.packet, 1);
    expect(assembler.pendingCount).toBe(1);
    assembler.prune(ROOM_WIRE_CHUNK_TTL_MS + 1);
    expect(assembler.pendingCount).toBe(0);
  });

  it("ignores duplicate chunks and discards inconsistent assemblies", () => {
    const encoded = encodeRoomWirePackets(
      { type: "sync.message", senderId: "human-1", payload: new Uint8Array(ROOM_WIRE_CHUNK_BYTES + 10).fill(3) },
      () => "message-1",
    );
    const chunks = encoded.map((bytes) => {
      const decoded = decodeRoomWirePacket(bytes);
      if (!decoded.ok || decoded.packet.type !== "sync.chunk") throw new Error("expected chunk");
      return decoded.packet;
    });
    const assembler = createRoomChunkAssembler();
    expect(assembler.push(chunks[0], 1)).toBeNull();
    expect(assembler.push(chunks[0], 2)).toBeNull();
    expect(assembler.pendingCount).toBe(1);
    expect(assembler.push({ ...chunks[1], totalBytes: chunks[1].totalBytes - 1 }, 3)).toBeNull();
    expect(assembler.pendingCount).toBe(0);
  });

  it("rejects unsupported protocol versions", () => {
    expect(decodeRoomWirePacket(new Uint8Array([1, 0, 0]))).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("rejects oversized and excessive chunk metadata", () => {
    const excessiveChunks = encodeRoomWirePacket({
      type: "sync.chunk",
      senderId: "human-1",
      messageId: "message",
      chunkIndex: 0,
      chunkCount: 65,
      totalBytes: ROOM_WIRE_CHUNK_BYTES + 1,
      payload: new Uint8Array([1]),
    });
    expect(decodeRoomWirePacket(excessiveChunks)).toEqual({ ok: false, reason: "invalid" });
  });

  it("keeps every packet for a 10 MiB initial sync within 256 KiB", () => {
    const encoded = encodeRoomWirePackets(
      {
        type: "sync.message",
        senderId: "human-1",
        payload: new Uint8Array(10 * 1024 * 1024),
      },
      () => "initial-sync",
    );
    expect(encoded.length).toBeLessThanOrEqual(64);
    expect(Math.max(...encoded.map((packet) => packet.byteLength))).toBeLessThanOrEqual(
      ROOM_WIRE_CHUNK_BYTES,
    );
  });

  it("rejects trailing bytes instead of accepting ambiguous packets", () => {
    const encoded = encodeRoomWirePacket({
      type: "awareness.updated",
      senderId: "human-1",
      payload: new Uint8Array([1]),
    });
    const malformed = new Uint8Array(encoded.byteLength + 1);
    malformed.set(encoded);
    expect(decodeRoomWirePacket(malformed)).toEqual({ ok: false, reason: "invalid" });
  });
});
