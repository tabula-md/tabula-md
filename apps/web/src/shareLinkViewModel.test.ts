import { describe, expect, it } from "vitest";
import { getRoomShareLinkView } from "./shareLinkViewModel";

describe("room share link view model", () => {
  it("formats valid live room links without exposing the client-only key", () => {
    expect(
      getRoomShareLinkView(
        "https://tabula.test/r/room-1234567890abcdef#key=secret-key",
        "room-1234567890abcdef",
      ),
    ).toEqual({
      canCopy: true,
      display: "https://tabula.test/r/room-123...#key=...",
      title: "https://tabula.test/r/room-1234567890abcdef#key=secret-key",
      url: "https://tabula.test/r/room-1234567890abcdef#key=secret-key",
    });
  });

  it("does not treat malformed or incomplete room URLs as copyable invite links", () => {
    expect(getRoomShareLinkView("not a url", "room-a")).toEqual({
      canCopy: false,
      display: "Invite link unavailable",
      title: "not a url",
    });

    expect(getRoomShareLinkView("https://tabula.test/r/room-a", "room-a")).toEqual({
      canCopy: false,
      display: "Invite link unavailable",
      title: "https://tabula.test/r/room-a",
    });
  });

  it("does not copy a room URL that belongs to a different stored live file", () => {
    expect(getRoomShareLinkView("https://tabula.test/r/room-b#key=secret-key", "room-a")).toEqual({
      canCopy: false,
      display: "Invite link unavailable",
      title: "https://tabula.test/r/room-b#key=secret-key",
    });
  });
});
