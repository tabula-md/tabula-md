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
          "[This section](#start)",
          "[[Shared]]",
          "[Missing](Missing.md)",
          "[Website](https://tabula.md)",
        ].join("\n"),
      },
      { id: "target", path: "Target.md", markdown: "# Target" },
      { id: "shared-a", path: "a/Shared.md", markdown: "# A" },
      { id: "shared-b", path: "b/Shared.md", markdown: "# B" },
      { id: "backlink", path: "Backlink.md", markdown: "[Start](Start.md)" },
      { id: "other", path: "Other.md", markdown: "[Other missing](Gone.md)" },
    ]);

    const model = getRightPanelLinksModel(index, "start");
    expect(model.outgoing.map((link) => link.targetDocumentId)).toEqual(["target"]);
    expect(model.backlinks.map((link) => link.sourceDocumentId)).toEqual(["backlink"]);
    expect(model.broken.map((link) => link.target)).toEqual(["Missing.md"]);
    expect(model.ambiguous[0]?.candidateDocumentIds).toEqual(["shared-a", "shared-b"]);
    expect(model.external.map((link) => link.target)).toEqual(["https://tabula.md"]);
    expect(model.hasLinks).toBe(true);
  });

  it("returns a quiet empty model for a document without relationships", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "empty", path: "Empty.md", markdown: "# Empty" },
    ]);
    expect(getRightPanelLinksModel(index, "empty").hasLinks).toBe(false);
  });
});
