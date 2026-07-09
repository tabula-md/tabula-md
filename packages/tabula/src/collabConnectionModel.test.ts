import { describe, expect, it } from "vitest";
import {
  createRoomApiUrl,
  isEncryptedEnvelope,
  sortCollaborators,
} from "./collabConnectionModel";

describe("collaboration connection model", () => {
  it("creates room API URLs with encoded room ids", () => {
    expect(createRoomApiUrl("https://rooms.test", "room/1")).toBe("https://rooms.test/v1/rooms/room%2F1");
  });

  it("guards encrypted room-event envelopes as the only live collaboration payload", () => {
    const envelope = {
      v: 1,
      roomId: "room-1",
      kind: "room-event",
      version: 1,
      iv: "iv",
      ciphertext: "ciphertext",
      createdAt: "2026-07-09T00:00:00.000Z",
    };

    expect(isEncryptedEnvelope(envelope)).toBe(true);
    expect(isEncryptedEnvelope({ ...envelope, kind: "presence" })).toBe(false);
    expect(isEncryptedEnvelope({ ...envelope, kind: "yjs-update" })).toBe(false);
    expect(isEncryptedEnvelope(null)).toBe(false);
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
