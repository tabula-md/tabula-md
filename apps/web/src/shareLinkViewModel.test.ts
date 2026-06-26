import { describe, expect, it } from "vitest";
import { getRoomShareLinkView } from "./shareLinkViewModel";

const VALID_ROOM_KEY = "A".repeat(43);

describe("room share link view model", () => {
  it("formats valid live room links without exposing the client-only key", () => {
    expect(
      getRoomShareLinkView(
        `https://tabula.test/#room=room-1234567890abcdef,${VALID_ROOM_KEY}`,
        "room-1234567890abcdef",
      ),
    ).toEqual({
      canCopy: true,
      display: "https://tabula.test/#room=room-123...,...",
      title: `https://tabula.test/#room=room-1234567890abcdef,${VALID_ROOM_KEY}`,
      url: `https://tabula.test/#room=room-1234567890abcdef,${VALID_ROOM_KEY}`,
    });
  });

  it("does not treat malformed or incomplete room URLs as copyable invite links", () => {
    expect(getRoomShareLinkView("not a url", "room-a")).toEqual({
      canCopy: false,
      display: "Invite link unavailable",
      title: "not a url",
    });

    expect(getRoomShareLinkView("https://tabula.test/#room=room-a", "room-a")).toEqual({
      canCopy: false,
      display: "Invite link unavailable",
      title: "https://tabula.test/#room=room-a",
    });
  });

  it("does not copy a room URL that belongs to a different stored live file", () => {
    expect(getRoomShareLinkView(`https://tabula.test/#room=room-b,${VALID_ROOM_KEY}`, "room-a")).toEqual({
      canCopy: false,
      display: "Invite link unavailable",
      title: `https://tabula.test/#room=room-b,${VALID_ROOM_KEY}`,
    });
  });
});
