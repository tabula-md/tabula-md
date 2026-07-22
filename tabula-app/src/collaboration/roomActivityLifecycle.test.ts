import { describe, expect, it } from "vitest";
import {
  canSuspendInactiveRoom,
  getRoomPresenceState,
  ROOM_IDLE_AFTER_MS,
  ROOM_SUSPEND_AFTER_MS,
} from "./roomActivityLifecycle";

describe("room activity lifecycle", () => {
  it("distinguishes visible activity, visible idleness, and hidden tabs", () => {
    expect(getRoomPresenceState({ hidden: false, inactiveForMs: ROOM_IDLE_AFTER_MS - 1 })).toBe("active");
    expect(getRoomPresenceState({ hidden: false, inactiveForMs: ROOM_IDLE_AFTER_MS })).toBe("idle");
    expect(getRoomPresenceState({ hidden: true, inactiveForMs: 0 })).toBe("away");
  });

  it("suspends only a clean durable connection after the inactivity threshold", () => {
    const ready = {
      connectionStatus: "connected" as const,
      durability: "clean" as const,
      inactiveForMs: ROOM_SUSPEND_AFTER_MS,
      recoveryMode: "durable" as const,
    };
    expect(canSuspendInactiveRoom(ready)).toBe(true);
    expect(canSuspendInactiveRoom({ ...ready, inactiveForMs: ROOM_SUSPEND_AFTER_MS - 1 })).toBe(false);
    expect(canSuspendInactiveRoom({ ...ready, durability: "dirty" })).toBe(false);
    expect(canSuspendInactiveRoom({ ...ready, recoveryMode: "temporary" })).toBe(false);
    expect(canSuspendInactiveRoom({ ...ready, connectionStatus: "reconnecting" })).toBe(false);
  });
});
