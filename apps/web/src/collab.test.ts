import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  createRoomShareUrl,
  decryptEnvelopeForRoom,
  encryptBytesForRoom,
  generateRoomKey,
  importRoomKey,
  parseRoomKeyFromHash,
} from "./collab";

describe("Tabula Room keys", () => {
  it("generates a 32-byte base64url room key for URL fragments", () => {
    const key = generateRoomKey();

    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(key).toHaveLength(43);
  });

  it("keeps the room key in the URL fragment", () => {
    const url = createRoomShareUrl("http://localhost:5173", "room-123", "secret-key");

    expect(url).toBe("http://localhost:5173/r/room-123#key=secret-key");
    expect(new URL(url).pathname).toBe("/r/room-123");
    expect(new URL(url).search).toBe("");
  });

  it("parses only the client-side key fragment", () => {
    expect(parseRoomKeyFromHash("#key=abc123")).toBe("abc123");
    expect(parseRoomKeyFromHash("#other=value")).toBeNull();
  });
});

describe("Tabula Room encrypted envelopes", () => {
  it("roundtrips an encrypted Yjs update without plaintext fields", async () => {
    const doc = new Y.Doc();
    doc.getText("markdown").insert(0, "# Live\n\nHello");

    const roomKey = await importRoomKey(generateRoomKey());
    const update = Y.encodeStateAsUpdate(doc);
    const envelope = await encryptBytesForRoom(roomKey, "room-123", "yjs-update", 1, update);
    const decrypted = await decryptEnvelopeForRoom(roomKey, envelope);

    const restored = new Y.Doc();
    Y.applyUpdate(restored, decrypted);

    expect(envelope).toMatchObject({
      v: 1,
      roomId: "room-123",
      kind: "yjs-update",
      version: 1,
    });
    expect(Object.keys(envelope)).not.toContain("roomKey");
    expect(Object.keys(envelope)).not.toContain("text");
    expect(restored.getText("markdown").toString()).toBe("# Live\n\nHello");
  });
});
