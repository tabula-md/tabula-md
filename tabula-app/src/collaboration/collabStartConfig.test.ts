import { describe, expect, it, vi } from "vitest";
import { ROOM_UNCONFIGURED_MESSAGE } from "./collabRoom";
import { resolveCollabStartConfig } from "./collabStartConfig";

describe("collaboration start config", () => {
  it("blocks when the room service is not configured", async () => {
    await expect(
      resolveCollabStartConfig({
        encodedRoomKey: "key",
        resolveBaseUrl: () => null,
      }),
    ).resolves.toEqual({
      status: "blocked",
      message: ROOM_UNCONFIGURED_MESSAGE,
    });
  });

  it("blocks when the client-only room key is missing", async () => {
    await expect(
      resolveCollabStartConfig({
        encodedRoomKey: "",
        resolveBaseUrl: () => "https://rooms.test",
      }),
    ).resolves.toEqual({
      status: "blocked",
      message: "This room URL is missing its client-only room key.",
    });
  });

  it("blocks when the room key cannot be imported", async () => {
    await expect(
      resolveCollabStartConfig({
        encodedRoomKey: "bad-key",
        resolveBaseUrl: () => "https://rooms.test",
        importKey: vi.fn(async () => {
          throw new Error("invalid");
        }),
      }),
    ).resolves.toEqual({
      status: "blocked",
      message: "This room URL has an invalid room key.",
    });
  });

  it("returns a ready room config", async () => {
    const roomKey = {} as CryptoKey;

    await expect(
      resolveCollabStartConfig({
        encodedRoomKey: "good-key",
        resolveBaseUrl: () => "https://rooms.test",
        importKey: vi.fn(async () => roomKey),
      }),
    ).resolves.toEqual({
      status: "ready",
      baseUrl: "https://rooms.test",
      roomKey,
    });
  });
});
