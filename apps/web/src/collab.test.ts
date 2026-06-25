import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  createRoomSession,
  createRoomShareUrl,
  decryptEnvelopeForRoom,
  encryptBytesForRoom,
  generateRoomId,
  generateRoomKey,
  importRoomKey,
  parseRoomLocation,
  parseRoomKeyFromHash,
  resolveTabulaRoomBaseUrl,
} from "./collab";

describe("Tabula Room keys", () => {
  it("generates a 16-byte base64url room id for public room routing", () => {
    const roomId = generateRoomId();

    expect(roomId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(roomId).toHaveLength(22);
  });

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

  it("creates a complete room session without moving the key out of the fragment", () => {
    const session = createRoomSession("https://tabula.test");
    const url = new URL(session.shareUrl);

    expect(session.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(session.roomKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.pathname).toBe(`/r/${session.roomId}`);
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#key=${session.roomKey}`);
    expect(session.shareUrl).not.toContain(`?key=${session.roomKey}`);
  });

  it("parses only the client-side key fragment", () => {
    expect(parseRoomKeyFromHash("#key=abc123")).toBe("abc123");
    expect(parseRoomKeyFromHash("#key=   ")).toBeNull();
    expect(parseRoomKeyFromHash("#other=value")).toBeNull();
  });

  it("parses room routes only when the client-only key fragment is present", () => {
    expect(
      parseRoomLocation({
        origin: "https://tabula.test",
        pathname: "/r/room-123",
        hash: "",
      }),
    ).toBeNull();

    expect(
      parseRoomLocation({
        origin: "https://tabula.test",
        pathname: "/r/room-123",
        hash: "#key=secret-key",
      }),
    ).toEqual({
      roomId: "room-123",
      roomKey: "secret-key",
      shareUrl: "https://tabula.test/r/room-123#key=secret-key",
    });
  });
});

describe("Tabula Room service URL", () => {
  const localLocation = { hostname: "localhost", protocol: "http:" };

  it("uses the configured room service URL without trailing slashes", () => {
    expect(
      resolveTabulaRoomBaseUrl({
        configuredUrl: "https://rooms.tabula.md///",
        isDev: false,
        location: localLocation,
      }),
    ).toBe("https://rooms.tabula.md");
  });

  it("keeps the local room fallback limited to dev mode", () => {
    expect(resolveTabulaRoomBaseUrl({ isDev: true, location: localLocation })).toBe("http://localhost:3002");
    expect(resolveTabulaRoomBaseUrl({ isDev: false, location: localLocation })).toBeNull();
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
