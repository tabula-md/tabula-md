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
  parseRoomShareUrl,
  resolveTabulaRoomBaseUrl,
  shouldStoreSnapshotAfterJoin,
} from ".";

const VALID_ROOM_KEY = "A".repeat(43);
const NEXT_VALID_ROOM_KEY = "B".repeat(43);

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
    const url = createRoomShareUrl("http://localhost:5173", "room-123", VALID_ROOM_KEY);

    expect(url).toBe(`http://localhost:5173/#room=room-123,${VALID_ROOM_KEY}`);
    expect(new URL(url).pathname).toBe("/");
    expect(new URL(url).search).toBe("");
  });

  it("creates a complete room session without moving the key out of the fragment", () => {
    const session = createRoomSession("https://tabula.test");
    const url = new URL(session.shareUrl);

    expect(session.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(session.roomKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.pathname).toBe("/");
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#room=${session.roomId},${session.roomKey}`);
    expect(session.shareUrl).not.toContain(`?key=${session.roomKey}`);
  });

  it("parses only the client-side key fragment", () => {
    expect(parseRoomKeyFromHash(`#room=room-123,${VALID_ROOM_KEY}`)).toBe(VALID_ROOM_KEY);
    expect(parseRoomKeyFromHash("#key=abc123")).toBeNull();
    expect(parseRoomKeyFromHash("#key=   ")).toBeNull();
    expect(parseRoomKeyFromHash("#key=not+base64url")).toBeNull();
    expect(parseRoomKeyFromHash("#other=value")).toBeNull();
  });

  it("parses room routes only when the client-only key fragment is present", () => {
    expect(
      parseRoomLocation({
        origin: "https://tabula.test",
        pathname: "/",
        hash: "",
      }),
    ).toBeNull();

    expect(
      parseRoomLocation({
        origin: "https://tabula.test",
        pathname: "/",
        hash: `#room=room-123,${VALID_ROOM_KEY}`,
      }),
    ).toEqual({
      roomId: "room-123",
      roomKey: VALID_ROOM_KEY,
      shareUrl: `https://tabula.test/#room=room-123,${VALID_ROOM_KEY}`,
    });
  });

  it("rejects non-canonical room routes and malformed room fragments", () => {
    expect(
      parseRoomLocation({
        origin: "https://tabula.test",
        pathname: "/r/room-123",
        hash: `#room=room-123,${VALID_ROOM_KEY}`,
      }),
    ).toBeNull();

    expect(
      parseRoomLocation({
        origin: "https://tabula.test",
        pathname: "/",
        hash: `#room=room-123`,
      }),
    ).toBeNull();

    expect(
      parseRoomLocation({
        origin: "https://tabula.test",
        pathname: "/",
        hash: `#room=room-123,${VALID_ROOM_KEY}&extra=value`,
      }),
    ).toBeNull();
  });

  it("parses stored room share URLs without reading the current window location", () => {
    expect(parseRoomShareUrl(`https://tabula.test/#room=room-123,${VALID_ROOM_KEY}`)).toEqual({
      roomId: "room-123",
      roomKey: VALID_ROOM_KEY,
      shareUrl: `https://tabula.test/#room=room-123,${VALID_ROOM_KEY}`,
    });

    expect(parseRoomShareUrl("https://tabula.test/r/room-123")).toBeNull();
    expect(parseRoomShareUrl("https://tabula.test/r/room-123#key=secret-key")).toBeNull();
    expect(parseRoomShareUrl(`https://tabula.test/#room=room-123,${NEXT_VALID_ROOM_KEY}`)?.roomKey).toBe(
      NEXT_VALID_ROOM_KEY,
    );
    expect(parseRoomShareUrl("not a url")).toBeNull();
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

describe("Tabula Room snapshot storage policy", () => {
  it("stores a snapshot for new rooms and local changes, but not for a pure restore", () => {
    expect(
      shouldStoreSnapshotAfterJoin({
        hasUnstoredLocalChanges: false,
        snapshotFetchResult: "missing",
      }),
    ).toBe(true);

    expect(
      shouldStoreSnapshotAfterJoin({
        hasUnstoredLocalChanges: true,
        snapshotFetchResult: "restored",
      }),
    ).toBe(true);

    expect(
      shouldStoreSnapshotAfterJoin({
        hasUnstoredLocalChanges: false,
        snapshotFetchResult: "restored",
      }),
    ).toBe(false);
  });
});
