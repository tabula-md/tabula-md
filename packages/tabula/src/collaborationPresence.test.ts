import { describe, expect, it } from "vitest";
import {
  getCollaboratorPresenceDetail,
  getCollaboratorPresenceLabel,
  getLineNumberForPresenceOffset,
  getLineNumberForPresenceSelection,
  isCollaboratorInFile,
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

  it("uses selection line metadata without scanning document text", () => {
    expect(getLineNumberForPresenceSelection("one", { from: 0, to: 0, lineNumber: 42 })).toBe(42);
    expect(
      getCollaboratorPresenceLabel({
        id: "peer-1",
        name: "Ada",
        color: "#763fc8",
        lastSeen: 1,
        fileTitle: "README",
        selection: { from: 0, to: 0, lineNumber: 42 },
      }),
    ).toBe("Ada - README - line 42");
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

  it("distinguishes same-file and different-file presence", () => {
    const collaborator = {
      id: "peer-1",
      name: "Ada",
      color: "#763fc8",
      lastSeen: 1,
      roomId: "room-1",
      fileTitle: "README.md",
      selection: { from: 0, to: 8 },
    };

    expect(isCollaboratorInFile(collaborator, "README.md", "room-1")).toBe(true);
    expect(getCollaboratorPresenceDetail(collaborator, "one\ntwo\nthree", "README.md", "room-1")).toBe("Line 3");

    expect(isCollaboratorInFile({ ...collaborator, roomId: "room-2" }, "README.md", "room-1")).toBe(false);
    expect(getCollaboratorPresenceDetail({ ...collaborator, roomId: "room-2" }, "one\ntwo", "README.md", "room-1")).toBe(
      "Viewing README.md",
    );
  });
});
