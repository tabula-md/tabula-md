import { describe, expect, it, vi } from "vitest";
import type { EncryptedEnvelope } from "./roomProtocol";
import { fetchRoomMeta, fetchRoomSnapshotEnvelope, putRoomSnapshotEnvelope } from "./collabRoomClient";

const envelope: EncryptedEnvelope = {
  v: 1,
  roomId: "room-1",
  kind: "snapshot",
  version: 1,
  iv: "iv",
  ciphertext: "ciphertext",
  createdAt: "2026-06-29T00:00:00.000Z",
};

const metaResponse = {
  roomId: "room-1",
  activeConnections: 1,
  snapshotVersion: 3,
  updatedAt: "2026-06-29T00:00:00.000Z",
};

describe("collaboration room client", () => {
  it("fetches room metadata through the room API contract", async () => {
    const fetcher = vi.fn(async () => Response.json(metaResponse));

    await expect(fetchRoomMeta({ baseUrl: "https://rooms.test", roomId: "room-1", fetcher })).resolves.toMatchObject({
      roomId: "room-1",
      snapshotCount: 1,
      version: 3,
    });
    expect(fetcher).toHaveBeenCalledWith("https://rooms.test/v1/rooms/room-1");
  });

  it("returns null when metadata cannot be loaded", async () => {
    const fetcher = vi.fn(async () => new Response("offline", { status: 503 }));

    await expect(fetchRoomMeta({ baseUrl: "https://rooms.test", roomId: "room-1", fetcher })).resolves.toBeNull();
  });

  it("loads a valid encrypted snapshot envelope", async () => {
    const fetcher = vi.fn(async () => Response.json(envelope));

    await expect(fetchRoomSnapshotEnvelope({ baseUrl: "https://rooms.test", roomId: "room-1", fetcher })).resolves.toEqual({
      status: "loaded",
      envelope,
    });
  });

  it("distinguishes missing and invalid snapshots", async () => {
    const missingFetcher = vi.fn(async () => new Response(null, { status: 404 }));
    const invalidFetcher = vi.fn(async () => Response.json({ ...envelope, kind: "presence" }));

    await expect(fetchRoomSnapshotEnvelope({ baseUrl: "https://rooms.test", roomId: "room-1", fetcher: missingFetcher }))
      .resolves.toEqual({ status: "missing" });
    await expect(fetchRoomSnapshotEnvelope({ baseUrl: "https://rooms.test", roomId: "room-1", fetcher: invalidFetcher }))
      .resolves.toMatchObject({ status: "invalid" });
  });

  it("stores a room snapshot and returns updated metadata", async () => {
    const fetcher = vi.fn(async () => Response.json(metaResponse));

    await expect(
      putRoomSnapshotEnvelope({ baseUrl: "https://rooms.test", roomId: "room-1", envelope, fetcher }),
    ).resolves.toMatchObject({
      roomId: "room-1",
      version: 3,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://rooms.test/v1/rooms/room-1/snapshot",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(envelope),
      }),
    );
  });
});
