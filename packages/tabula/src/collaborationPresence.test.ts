import { describe, expect, it } from "vitest";
import {
  getCollaboratorPresenceLabel,
  getLineNumberForPresenceOffset,
  getLineNumberForPresenceSelection,
} from "./collaborationPresence";

describe("collaboration presence labels", () => {
  it("maps document offsets to one-based line numbers", () => {
    const text = "one\ntwo\nthree";

    expect(getLineNumberForPresenceOffset(text, 0)).toBe(1);
    expect(getLineNumberForPresenceOffset(text, 4)).toBe(2);
    expect(getLineNumberForPresenceOffset(text, text.length)).toBe(3);
    expect(getLineNumberForPresenceOffset(text, text.length + 20)).toBe(3);
  });

  it("uses the selection head as the collaborator location", () => {
    expect(getLineNumberForPresenceSelection("one\ntwo\nthree", { from: 0, to: 8 })).toBe(3);
  });

  it("includes collaborator, file, and line in the product-facing label", () => {
    expect(
      getCollaboratorPresenceLabel(
        {
          id: "peer-1",
          name: "Ada",
          color: "#763fc8",
          lastSeen: 1,
          fileTitle: "README",
          selection: { from: 0, to: 4 },
        },
        "one\ntwo",
      ),
    ).toBe("Ada - README - line 2");
  });
});
