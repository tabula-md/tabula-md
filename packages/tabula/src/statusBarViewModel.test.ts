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
      tone: "saved",
      visible: true,
    });
  });

  it("keeps routine live connection status out of the bottom bar", () => {
    expect(
      getStatusBarSaveState({ isLive: true, statusLabel: "Connecting" }),
    ).toEqual({
      label: "Connecting",
      tone: "saved",
      visible: false,
    });
    expect(
      getStatusBarSaveState({ isLive: true, statusLabel: "Live session" }),
    ).toEqual({
      label: "Live session",
      tone: "saved",
      visible: false,
    });
  });

  it("shows interrupted live states because they need attention", () => {
    expect(
      getStatusBarSaveState({
        isLive: true,
        statusLabel: "Reconnecting",
      }),
    ).toEqual({
      label: "Reconnecting",
      tone: "attention",
      visible: true,
    });

    expect(
      getStatusBarSaveState({
        isLive: true,
        statusLabel: "Connection failed",
      }),
    ).toEqual({
      label: "Connection failed",
      tone: "attention",
      visible: true,
    });

    expect(
      getStatusBarSaveState({
        isLive: true,
        roomOfflineLabel: "Room 연결 끊김",
        statusLabel: "Room 연결 끊김",
      }),
    ).toEqual({
      label: "Room 연결 끊김",
      tone: "attention",
      visible: true,
    });

    expect(
      getStatusBarSaveState({ isLive: true, statusLabel: "Changes aren’t backed up" }),
    ).toEqual({
      label: "Changes aren’t backed up",
      tone: "attention",
      visible: true,
    });
  });
});
