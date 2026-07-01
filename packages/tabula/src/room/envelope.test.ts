import { describe, expect, it } from "vitest";
import {
  createRoomEnvelope,
  decryptRoomEnvelope,
} from "./envelope";
import { generateEncryptionKey } from "../data/encryption";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("room envelope encryption", () => {
  it("authenticates room envelope metadata with AES-GCM AAD", async () => {
    const key = generateEncryptionKey();
    const envelope = await createRoomEnvelope({
      roomKey: key,
      roomId: "room_123",
      kind: "yjs-update",
      version: 1,
      plaintext: textEncoder.encode("update"),
      createdAt: "2026-06-18T00:00:00.000Z",
    });

    await expect(decryptRoomEnvelope({ roomKey: key, envelope })).resolves.toEqual(textEncoder.encode("update"));

    await expect(
      decryptRoomEnvelope({
        roomKey: key,
        envelope: { ...envelope, kind: "presence" },
      }),
    ).rejects.toThrow();
  });

  it("decrypts state-init payloads", async () => {
    const key = generateEncryptionKey();
    const envelope = await createRoomEnvelope({
      roomKey: key,
      roomId: "room_123",
      kind: "state-init",
      version: 2,
      plaintext: textEncoder.encode("full-state"),
    });

    const plaintext = await decryptRoomEnvelope({ roomKey: key, envelope });

    expect(textDecoder.decode(plaintext)).toBe("full-state");
  });
});
