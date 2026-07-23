import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import { getRightPanelLinksModel } from "./rightPanelLinksModel";

describe("right panel links model", () => {
  it("partitions the active document's links without mixing workspace-wide issues", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "start",
        path: "Start.md",
        markdown: [
          "# Start",
          "[Target](Target.md)",
          "[Target again](Target.md)",
          "[This section](#start)",
          "[[Shared]]",
          "[Missing](Missing.md)",
          "[Website](https://tabula.md)",
          "![[Target]]",
        ].join("\n"),
      },
      { id: "target", path: "Target.md", markdown: "# Target" },
      { id: "shared-a", path: "a/Shared.md", markdown: "# A" },
      { id: "shared-b", path: "b/Shared.md", markdown: "# B" },
      {
        id: "backlink",
        path: "Backlink.md",
        markdown: "[Start](Start.md)\n[Start again](Start.md)",
      },
      { id: "other", path: "Other.md", markdown: "[Other missing](Gone.md)" },
    ]);

    const model = getRightPanelLinksModel(index, "start");
    expect(model.outgoing.map(({ documentId, status, links }) => ({
      documentId,
      status,
      mentionCount: links.length,
    }))).toEqual([
      { documentId: "target", status: "resolved", mentionCount: 3 },
      { documentId: undefined, status: "ambiguous", mentionCount: 1 },
      { documentId: undefined, status: "broken", mentionCount: 1 },
      { documentId: undefined, status: "external", mentionCount: 1 },
    ]);
    expect(model.backlinks.map(({ documentId, links }) => ({
      documentId,
      mentionCount: links.length,
    }))).toEqual([
      { documentId: "backlink", mentionCount: 2 },
    ]);
  });

  it("keeps the two relationship directions empty without inventing issues", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "empty", path: "Empty.md", markdown: "# Empty" },
    ]);
    expect(getRightPanelLinksModel(index, "empty")).toEqual({
      outgoing: [],
      backlinks: [],
    });
  });
});
