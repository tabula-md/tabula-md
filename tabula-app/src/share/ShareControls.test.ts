import { describe, expect, it } from "vitest";
import { shouldShowLiveRoomPanel } from "./ShareControls";
import { shouldExposeLiveInvite } from "./ShareLinkPanel";

describe("shouldShowLiveRoomPanel", () => {
  it("moves to the live surface as soon as room creation starts", () => {
    expect(shouldShowLiveRoomPanel(false, true)).toBe(true);
  });

  it("keeps the live surface visible after the room connects", () => {
    expect(shouldShowLiveRoomPanel(true, false)).toBe(true);
  });

  it("shows the chooser only before a live session starts", () => {
    expect(shouldShowLiveRoomPanel(false, false)).toBe(false);
  });
});

describe("shouldExposeLiveInvite", () => {
  it("keeps a newly created room private until its transport connects", () => {
    expect(shouldExposeLiveInvite("idle", true)).toBe(false);
    expect(shouldExposeLiveInvite("connecting", true)).toBe(false);
    expect(shouldExposeLiveInvite("connected", true)).toBe(false);
    expect(shouldExposeLiveInvite("connected", false)).toBe(true);
  });

  it("keeps an established room invite available during recoverable outages", () => {
    expect(shouldExposeLiveInvite("reconnecting", false)).toBe(true);
    expect(shouldExposeLiveInvite("suspended", false)).toBe(true);
    expect(shouldExposeLiveInvite("disconnected", false)).toBe(true);
    expect(shouldExposeLiveInvite("failed", false)).toBe(true);
  });
});
