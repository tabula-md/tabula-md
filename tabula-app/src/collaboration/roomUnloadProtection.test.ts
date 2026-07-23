import { describe, expect, it } from "vitest";
import { shouldPreventRoomUnload } from "./roomUnloadProtection";

const durableRoom = {
  collaboratorCount: 0,
  durability: "clean" as const,
  hydrationStatus: "ready" as const,
  isLive: true,
  recoveryMode: "durable" as const,
};

describe("shouldPreventRoomUnload", () => {
  it("protects dirty, saving, and failed durable rooms", () => {
    expect(shouldPreventRoomUnload({ ...durableRoom, durability: "dirty" })).toBe(true);
    expect(shouldPreventRoomUnload({ ...durableRoom, durability: "saving" })).toBe(true);
    expect(shouldPreventRoomUnload({ ...durableRoom, durability: "failed" })).toBe(true);
  });

  it("allows a clean durable room to close without a prompt", () => {
    expect(shouldPreventRoomUnload(durableRoom)).toBe(false);
  });

  it("does not block a non-leader while another durable participant remains", () => {
    expect(shouldPreventRoomUnload({
      ...durableRoom,
      collaboratorCount: 1,
      durability: "unknown",
    })).toBe(false);
  });

  it("protects the last participant in a temporary room", () => {
    expect(shouldPreventRoomUnload({
      ...durableRoom,
      recoveryMode: "temporary",
      durability: "unknown",
    })).toBe(true);
    expect(shouldPreventRoomUnload({
      ...durableRoom,
      collaboratorCount: 1,
      recoveryMode: "temporary",
      durability: "unknown",
    })).toBe(false);
  });

  it("does not prompt outside a hydrated live room", () => {
    expect(shouldPreventRoomUnload({ ...durableRoom, isLive: false, durability: "dirty" })).toBe(false);
    expect(shouldPreventRoomUnload({
      ...durableRoom,
      hydrationStatus: "loading-checkpoint",
      durability: "dirty",
    })).toBe(false);
  });
});
