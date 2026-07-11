import { describe, expect, it } from "vitest";
import { getCollaboratorDisplayList } from "./collabCollaborators";

describe("collaborator display names", () => {
  it("adds stable suffixes only when participant names collide", () => {
    const participants = getCollaboratorDisplayList([
      { id: "z", name: "Nimble Human", color: "#2563eb" },
      { id: "a", name: "Nimble Human", color: "#2563eb" },
      { id: "agent", name: "Nimble Agent", color: "#7c3aed" },
    ]);

    expect(participants).toEqual([
      { id: "z", name: "Nimble Human 2", color: "#0f766e" },
      { id: "a", name: "Nimble Human", color: "#2563eb" },
      { id: "agent", name: "Nimble Agent", color: "#7c3aed" },
    ]);
  });

  it("matches names without case or surrounding whitespace", () => {
    expect(getCollaboratorDisplayList([
      { id: "a", name: " Curious Human " },
      { id: "b", name: "curious human" },
    ])).toEqual([
      { id: "a", name: "Curious Human" },
      { id: "b", name: "curious human 2" },
    ]);
  });
});
