import { describe, expect, it } from "vitest";
import {
  createRoomEnvelope,
  decryptRoomEnvelope,
  isEnvelopeKind,
} from "./envelope";
import { generateEncryptionKey } from "../data/encryption";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("room envelope encryption", () => {
  it("authenticates encrypted room-event metadata with AES-GCM AAD", async () => {
    const key = generateEncryptionKey();
    const envelope = await createRoomEnvelope({
      roomKey: key,
      roomId: "room_123",
      kind: "room-event",
      version: 1,
      plaintext: textEncoder.encode('{"type":"presence.updated"}'),
      createdAt: "2026-07-09T00:00:00.000Z",
    });

    await expect(decryptRoomEnvelope({ roomKey: key, envelope })).resolves.toEqual(
      textEncoder.encode('{"type":"presence.updated"}'),
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
      plaintext: textEncoder.encode('{"type":"workspace.updated"}'),
    });

    const plaintext = await decryptRoomEnvelope({ roomKey: key, envelope });

    expect(textDecoder.decode(plaintext)).toBe('{"type":"workspace.updated"}');
  });
});
