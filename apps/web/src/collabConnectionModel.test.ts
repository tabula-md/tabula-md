import { describe, expect, it } from "vitest";
import {
  createRoomApiUrl,
  decodePresence,
  encodePresenceForRoom,
  isEncryptedEnvelope,
  sortCollaborators,
  toRoomMeta,
} from "./collabConnectionModel";

describe("collaboration connection model", () => {
  it("creates room API URLs with encoded room ids", () => {
    expect(createRoomApiUrl("https://rooms.test", "room/1", "/snapshot")).toBe(
      "https://rooms.test/v1/rooms/room%2F1/snapshot",
    );
  });

  it("maps room server metadata into product room metadata", () => {
    expect(
      toRoomMeta({
        roomId: "room-1",
        activeConnections: 3,
        snapshotVersion: 7,
        updatedAt: "2026-06-29T00:00:00.000Z",
      }),
    ).toEqual({
      roomId: "room-1",
      version: 7,
      snapshotCount: 1,
      lastSavedAt: "2026-06-29T00:00:00.000Z",
      lastUpdatedAt: "2026-06-29T00:00:00.000Z",
      snapshots: [
        {
          id: "latest",
          createdAt: "2026-06-29T00:00:00.000Z",
          textLength: 0,
          updateSize: 0,
          version: 7,
        },
      ],
    });
  });

  it("guards encrypted room envelopes", () => {
    expect(
      isEncryptedEnvelope({
        v: 1,
        roomId: "room-1",
        kind: "presence",
        version: 1,
        iv: "iv",
        ciphertext: "ciphertext",
        createdAt: "2026-06-29T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(isEncryptedEnvelope({ kind: "presence" })).toBe(false);
    expect(isEncryptedEnvelope(null)).toBe(false);
  });

  it("roundtrips presence payloads while normalizing missing lastSeen", () => {
    const encoded = encodePresenceForRoom({
      identity: {
        id: "peer-1",
        name: "Ada",
        color: "#763fc8",
        lastSeen: 1,
      },
      roomId: "room-1",
      fileTitle: "README",
      selection: { from: 1, to: 4 },
      now: () => 10,
    });

    expect(decodePresence(encoded, () => 20)).toEqual({
      id: "peer-1",
      name: "Ada",
      color: "#763fc8",
      lastSeen: 10,
      roomId: "room-1",
      fileTitle: "README",
      selection: { from: 1, to: 4 },
    });

    expect(decodePresence(new TextEncoder().encode('{"id":"peer-2","name":"Grace","color":"#111"}'), () => 30))
      .toEqual({
        id: "peer-2",
        name: "Grace",
        color: "#111",
        lastSeen: 30,
      });
  });

  it("sorts collaborators by display name", () => {
    expect(
      sortCollaborators([
        { id: "2", name: "Grace", color: "#111", lastSeen: 2 },
        { id: "1", name: "Ada", color: "#222", lastSeen: 1 },
      ]).map((collaborator) => collaborator.name),
    ).toEqual(["Ada", "Grace"]);
  });
});
