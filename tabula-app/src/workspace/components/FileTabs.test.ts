import { describe, expect, it } from "vitest";
import type { Collaborator } from "../../collaboration/liveCollaboration";
import { getActiveTabScrollLeft, getDocumentCollaborators } from "./FileTabs";

const collaborator = (id: string, activeDocumentId?: string): Collaborator => ({
  id,
  name: id,
  color: "#2563eb",
  lastSeen: 0,
  activeDocumentId,
});

describe("file tab presence", () => {
  it("shows only collaborators currently viewing the document", () => {
    const collaborators = [
      collaborator("first", "doc-a"),
      collaborator("second", "doc-b"),
      { ...collaborator("selection"), selection: { from: 0, to: 0, documentId: "doc-a" } },
    ];

    expect(getDocumentCollaborators(collaborators, "doc-a").map((candidate) => candidate.id)).toEqual([
      "first",
      "selection",
    ]);
  });
});

describe("active file tab scrolling", () => {
  const geometry = {
    scrollLeft: 300,
    clientWidth: 500,
    scrollWidth: 1_500,
    activeLeft: 420,
    activeRight: 556,
    scrollPadding: 44,
    alignToStart: false,
  };

  it("keeps the current scroll position when the selected tab is already visible", () => {
    expect(getActiveTabScrollLeft(geometry)).toBe(300);
  });

  it("reveals a selected tab clipped on the left", () => {
    expect(getActiveTabScrollLeft({
      ...geometry,
      activeLeft: 312,
      activeRight: 448,
    })).toBe(268);
  });

  it("reveals a selected tab clipped on the right", () => {
    expect(getActiveTabScrollLeft({
      ...geometry,
      activeLeft: 720,
      activeRight: 856,
    })).toBe(400);
  });

  it("clamps the first and last tabs to the scrollable range", () => {
    expect(getActiveTabScrollLeft({
      ...geometry,
      activeLeft: 0,
      activeRight: 136,
    })).toBe(0);
    expect(getActiveTabScrollLeft({
      ...geometry,
      activeLeft: 1_420,
      activeRight: 1_556,
    })).toBe(1_000);
  });
});
