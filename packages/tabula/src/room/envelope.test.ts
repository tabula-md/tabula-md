import { describe, expect, it } from "vitest";
import {
  createRoomEnvelope,
  decryptRoomEnvelope,
  isEnvelopeKind,
} from "./envelope";
import { generateEncryptionKey } from "../data/encryption";
import { encodeRoomWirePacket } from "../roomBinaryProtocol";

const syncPacket = encodeRoomWirePacket({
  type: "sync.message",
  senderId: "actor-1",
  payload: new Uint8Array([1, 2, 3]),
});

describe("room envelope encryption", () => {
  it("authenticates encrypted room-event metadata with AES-GCM AAD", async () => {
    const key = generateEncryptionKey();
    const envelope = await createRoomEnvelope({
      roomKey: key,
      roomId: "room_123",
      kind: "room-event",
      version: 1,
      plaintext: syncPacket,
      createdAt: "2026-07-09T00:00:00.000Z",
    });

    await expect(decryptRoomEnvelope({ roomKey: key, envelope })).resolves.toEqual(
      syncPacket,
    );

    await expect(
      decryptRoomEnvelope({
        roomKey: key,
        envelope: { ...envelope, roomId: "other-room" },
      }),
    ).rejects.toThrow();
  });

  it("recognizes only room-event as a live collaboration envelope kind", () => {
    expect(isEnvelopeKind("room-event")).toBe(true);
    expect(isEnvelopeKind("presence")).toBe(false);
    expect(isEnvelopeKind("yjs-update")).toBe(false);
    expect(isEnvelopeKind("state-init")).toBe(false);
  });

  it("decrypts room-event payloads", async () => {
    const key = generateEncryptionKey();
    const envelope = await createRoomEnvelope({
      roomKey: key,
      roomId: "room_123",
      kind: "room-event",
      version: 2,
      plaintext: syncPacket,
    });

    const plaintext = await decryptRoomEnvelope({ roomKey: key, envelope });

    expect(plaintext).toEqual(syncPacket);
  });
});
