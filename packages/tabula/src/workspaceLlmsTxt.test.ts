import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import { planLlmsTxtExport, validateLlmsTxt } from "./workspaceLlmsTxt";

describe("llms.txt delivery adapter", () => {
  it("validates ordered sections, Optional, broken links, and external links", () => {
    const report = validateLlmsTxt([
      "# Tabula",
      "",
      "> Markdown knowledge workspace",
      "",
      "## Docs",
      "",
      "- [Guide](/docs/guide.md): Start here",
      "- [External](https://example.com/reference)",
      "",
      "## Optional",
      "",
      "- [Missing](/docs/missing.md)",
    ].join("\n"), ["docs/guide.md"]);

    expect(report).toMatchObject({
      valid: false,
      title: "Tabula",
      externalLinkCount: 1,
      internalLinkCount: 2,
    });
    expect(report.sections[1]).toMatchObject({ heading: "Optional", optional: true });
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: "llms_link_broken",
      value: "/docs/missing.md",
    }));
  });

  it("generates a reviewed candidate without changing source or overwriting a file", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "public",
        path: "docs/public.md",
        markdown: "---\ntype: Guide\ndescription: Public guide\n---\n\n# Public",
      },
      {
        id: "private",
        path: "docs/private.md",
        markdown: "---\ntype: Guide\nvisibility: private\n---\n\n# Private",
      },
    ]);
    const candidate = planLlmsTxtExport(index, {
      title: "Workspace",
      summary: "Curated docs",
      existingLlmsTxt: "# Hand-written",
      sections: [{
        heading: "Docs",
        documentIds: ["public", "private"],
      }],
    });

    expect(candidate.markdown).toContain("- [Public](/docs/public.md): Public guide");
    expect(candidate.markdown).not.toContain("Private");
    expect(candidate).toMatchObject({
      includedDocumentIds: ["public"],
      excludedPrivateDocumentIds: ["private"],
      requiresPrivateReview: true,
      existingFilePreserved: true,
      overwritesExistingFile: false,
      workspaceSourceChanged: false,
    });
    expect(index.documentsById.get("private")?.markdown).toContain("# Private");
  });

  it("includes private documents only after explicit review", () => {
    const index = createWorkspaceKnowledgeIndex([{
      id: "private",
      path: "private.md",
      markdown: "---\ntype: Note\nprivate: true\n---\n\n# Private",
    }]);
    const candidate = planLlmsTxtExport(index, {
      title: "Workspace",
      includePrivateDocumentIds: ["private"],
      sections: [{ heading: "Optional", optional: true, documentIds: ["private"] }],
    });

    expect(candidate.markdown).toContain("## Optional");
    expect(candidate.markdown).toContain("[Private](/private.md)");
    expect(candidate.requiresPrivateReview).toBe(false);
  });
});
