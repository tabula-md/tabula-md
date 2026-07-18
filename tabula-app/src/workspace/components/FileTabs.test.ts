import { describe, expect, it } from "vitest";
import type { Collaborator } from "../../collaboration/liveCollaboration";
import { getDocumentCollaborators } from "./FileTabs";

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
