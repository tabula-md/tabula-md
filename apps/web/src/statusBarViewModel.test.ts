import { describe, expect, it } from "vitest";
import { getStatusBarSaveState } from "./statusBarViewModel";

describe("status bar view model", () => {
  it("keeps local save state visible for non-live files", () => {
    expect(getStatusBarSaveState({ isLive: false, statusLabel: "Live session" })).toEqual({
      label: "Saved locally",
      visible: true,
    });
  });

  it("keeps routine live connection status out of the bottom bar", () => {
    expect(getStatusBarSaveState({ isLive: true, statusLabel: "Connecting" })).toEqual({
      label: "Connecting",
      visible: false,
    });
    expect(getStatusBarSaveState({ isLive: true, statusLabel: "Live session" })).toEqual({
      label: "Live session",
      visible: false,
    });
  });

  it("shows offline live state because it needs attention", () => {
    expect(getStatusBarSaveState({ isLive: true, statusLabel: "Room offline" })).toEqual({
      label: "Room offline",
      visible: true,
    });
  });
});
