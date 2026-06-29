import { describe, expect, it } from "vitest";
import { getStatusBarSaveState } from "./statusBarViewModel";

describe("status bar view model", () => {
  it("keeps local save state visible for non-live files", () => {
    expect(
      getStatusBarSaveState({
        isLive: false,
        savedLocallyLabel: "로컬 저장됨",
        statusLabel: "Live session",
      }),
    ).toEqual({
      label: "로컬 저장됨",
      visible: true,
    });
  });

  it("keeps routine live connection status out of the bottom bar", () => {
    expect(
      getStatusBarSaveState({ isLive: true, statusLabel: "Connecting" }),
    ).toEqual({
      label: "Connecting",
      visible: false,
    });
    expect(
      getStatusBarSaveState({ isLive: true, statusLabel: "Live session" }),
    ).toEqual({
      label: "Live session",
      visible: false,
    });
  });

  it("shows offline live state because it needs attention", () => {
    expect(
      getStatusBarSaveState({
        isLive: true,
        roomOfflineLabel: "Room 연결 끊김",
        statusLabel: "Room 연결 끊김",
      }),
    ).toEqual({
      label: "Room 연결 끊김",
      visible: true,
    });
  });
});
