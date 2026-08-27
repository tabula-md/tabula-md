import { describe, expect, it } from "vitest";

import {
  getLiveRoomOpenState,
  LIVE_ROOM_OPEN_TIMEOUT_MS,
} from "./liveRoomOpenState";

describe("live room open state", () => {
  it("does not show a room opening surface outside room navigation", () => {
    expect(
      getLiveRoomOpenState({
        connectionStatus: "idle",
        hydrationStatus: "loading-checkpoint",
        hasActiveRoom: false,
        timedOut: true,
      }),
    ).toBe("idle");
  });

  it("marks a room that never connects as unavailable after the timeout", () => {
    expect(
      getLiveRoomOpenState({
        connectionStatus: "connecting",
        hydrationStatus: "loading-checkpoint",
        hasActiveRoom: true,
        timedOut: true,
      }),
    ).toBe("unavailable");
  });

  it("marks a connected room without workspace state as unavailable after the timeout", () => {
    expect(LIVE_ROOM_OPEN_TIMEOUT_MS).toBeGreaterThan(0);
    expect(
      getLiveRoomOpenState({
        connectionStatus: "connected",
        hydrationStatus: "waiting-for-state",
        hasActiveRoom: true,
        timedOut: true,
      }),
    ).toBe("unavailable");
  });

  it("returns to the workspace once a room document is available", () => {
    expect(
      getLiveRoomOpenState({
        connectionStatus: "connected",
        hydrationStatus: "ready",
        hasActiveRoom: true,
        timedOut: false,
      }),
    ).toBe("idle");
  });

  it("treats a timed-out created room as unavailable even when its local bootstrap is ready", () => {
    expect(
      getLiveRoomOpenState({
        connectionStatus: "disconnected",
        hydrationStatus: "ready",
        hasActiveRoom: true,
        timedOut: true,
      }),
    ).toBe("unavailable");
  });

  it("distinguishes an expired room from a generic open failure", () => {
    expect(
      getLiveRoomOpenState({
        connectionStatus: "failed",
        hydrationStatus: "failed",
        hasActiveRoom: true,
        timedOut: false,
        failure: "expired",
      }),
    ).toBe("expired");

    expect(
      getLiveRoomOpenState({
        connectionStatus: "failed",
        hydrationStatus: "failed",
        hasActiveRoom: true,
        timedOut: false,
        failure: "unsupported",
      }),
    ).toBe("unavailable");
  });
});
