import { describe, expect, it } from "vitest";
import {
  analyzeWorkspaceDocument,
  createWorkspaceKnowledgeIndex,
  removeWorkspaceDocumentFromKnowledgeIndex,
  updateWorkspaceKnowledgeIndex,
  type WorkspaceSourceDocument,
} from "./workspaceKnowledgeIndex";

const document = (
  id: string,
  path: string,
  markdown: string,
): WorkspaceSourceDocument => ({ id, path, markdown });

describe("workspace knowledge index", () => {
  it("derives semantic metadata, headings, standard links, and full-source offsets", () => {
    const markdown = [
      "---",
      "title: Product Guide",
      "tags: [docs, product]",
      "owner:",
      "  team: Core",
      "example: '[Not a link](Private.md)'",
      "---",
      "",
      "# Start *here*",
      "",
      "Read [API](<../API Guide.md>) and [the architecture][arch].",
      "",
      "[arch]: /Architecture.md",
    ].join("\r\n");

    const analysis = analyzeWorkspaceDocument(document("guide", "docs/Guide.md", markdown));

    expect(analysis.title).toBe("Product Guide");
    expect(analysis.metadata).toEqual({
      title: "Product Guide",
      tags: ["docs", "product"],
      owner: { team: "Core" },
      example: "[Not a link](Private.md)",
    });
    expect(analysis.headings).toEqual([
      {
        depth: 1,
        text: "Start here",
        from: markdown.indexOf("# Start"),
        to: markdown.indexOf("# Start") + "# Start *here*".length,
      },
    ]);
    expect(analysis.links).toEqual([
      {
        label: "API",
        target: "../API Guide.md",
        from: markdown.indexOf("[API]"),
        to: markdown.indexOf("[API]") + "[API](<../API Guide.md>)".length,
      },
      {
        label: "the architecture",
        target: "/Architecture.md",
        from: markdown.indexOf("[the architecture]"),
        to: markdown.indexOf("[the architecture]") + "[the architecture][arch]".length,
      },
    ]);
  });

  it("resolves relative, root, fragment, query, and encoded Markdown links", () => {
    const index = createWorkspaceKnowledgeIndex([
      document(
        "start",
        "docs/Start.md",
        [
          "# Intro",
          "[API](../API%20Guide.md)",
          "[Local](./Local.md#setup)",
          "[Local query](./Local.md?view=all#setup)",
          "[Architecture](/Architecture.md)",
          "[This section](#intro)",
          "[Website](https://tabula.md/docs)",
          "[Email](mailto:hello@tabula.md)",
          "[Missing](Missing.md)",
          "[Wrong case](../api%20guide.md)",
          "[Outside](../../outside.md)",
          "[Encoded slash](..%2FArchitecture.md)",
        ].join("\n"),
      ),
      document("api", "API Guide.md", "# API"),
      document("local", "docs/Local.md", "# Local\n\n## Setup"),
      document("percent", "docs/100% Notes.md", "[Local](Local.md)"),
      document("architecture", "Architecture.md", "# Architecture"),
    ]);

    const outgoing = index.outgoingLinksByDocumentId.get("start") ?? [];
    expect(outgoing.map(({ label, status, targetDocumentId, targetPath, fragment }) => ({
      label,
      status,
      targetDocumentId,
      targetPath,
      fragment,
    }))).toEqual([
      { label: "API", status: "resolved", targetDocumentId: "api", targetPath: "API Guide.md", fragment: undefined },
      { label: "Local", status: "resolved", targetDocumentId: "local", targetPath: "docs/Local.md", fragment: "setup" },
      { label: "Local query", status: "resolved", targetDocumentId: "local", targetPath: "docs/Local.md", fragment: "setup" },
      { label: "Architecture", status: "resolved", targetDocumentId: "architecture", targetPath: "Architecture.md", fragment: undefined },
      { label: "This section", status: "resolved", targetDocumentId: "start", targetPath: "docs/Start.md", fragment: "intro" },
      { label: "Website", status: "external", targetDocumentId: undefined, targetPath: undefined, fragment: undefined },
      { label: "Email", status: "external", targetDocumentId: undefined, targetPath: undefined, fragment: undefined },
      { label: "Missing", status: "broken", targetDocumentId: undefined, targetPath: "docs/Missing.md", fragment: undefined },
      { label: "Wrong case", status: "broken", targetDocumentId: undefined, targetPath: "api guide.md", fragment: undefined },
      { label: "Outside", status: "broken", targetDocumentId: undefined, targetPath: undefined, fragment: undefined },
      { label: "Encoded slash", status: "broken", targetDocumentId: undefined, targetPath: undefined, fragment: undefined },
    ]);
    expect(index.backlinksByDocumentId.get("local")?.map((link) => link.label)).toEqual([
      "Local",
      "Local query",
      "Local",
    ]);
    expect(index.backlinksByDocumentId.get("start")?.map((link) => link.label)).toEqual([
      "This section",
    ]);
    expect(index.brokenLinks.map((link) => link.label)).toEqual([
      "Missing",
      "Wrong case",
      "Outside",
      "Encoded slash",
    ]);
    expect(index.externalLinks.map((link) => link.label)).toEqual(["Website", "Email"]);
    expect(index.outgoingLinksByDocumentId.get("percent")?.[0]).toMatchObject({
      status: "resolved",
      targetDocumentId: "local",
    });
  });

  it("re-analyzes only the changed document while recalculating workspace edges", () => {
    const initial = createWorkspaceKnowledgeIndex([
      document("start", "docs/Start.md", "[Missing](Missing.md)"),
      document("stable", "Stable.md", "# Stable"),
    ]);
    const startAnalysis = initial.analysesByDocumentId.get("start");
    const stableAnalysis = initial.analysesByDocumentId.get("stable");

    const withTarget = updateWorkspaceKnowledgeIndex(
      initial,
      document("missing", "docs/Missing.md", "# Found"),
    );
    expect(withTarget.analysesByDocumentId.get("start")).toBe(startAnalysis);
    expect(withTarget.analysesByDocumentId.get("stable")).toBe(stableAnalysis);
    expect(withTarget.brokenLinks).toHaveLength(0);
    expect(withTarget.backlinksByDocumentId.get("missing")?.[0]).toMatchObject({
      sourceDocumentId: "start",
      status: "resolved",
    });

    const withoutTarget = removeWorkspaceDocumentFromKnowledgeIndex(withTarget, "missing");
    expect(withoutTarget.analysesByDocumentId.get("start")).toBe(startAnalysis);
    expect(withoutTarget.brokenLinks).toHaveLength(1);

    const changedSource = updateWorkspaceKnowledgeIndex(
      withoutTarget,
      document("start", "docs/Start.md", "[Stable](/Stable.md)"),
    );
    expect(changedSource.analysesByDocumentId.get("start")).not.toBe(startAnalysis);
    expect(changedSource.analysesByDocumentId.get("stable")).toBe(stableAnalysis);
    expect(changedSource.backlinksByDocumentId.get("stable")?.[0]).toMatchObject({
      sourceDocumentId: "start",
      status: "resolved",
    });
  });

  it("rejects duplicate document identities and exact paths", () => {
    expect(() => createWorkspaceKnowledgeIndex([
      document("same", "One.md", ""),
      document("same", "Two.md", ""),
    ])).toThrow("Duplicate workspace document id: same");
    expect(() => createWorkspaceKnowledgeIndex([
      document("one", "Same.md", ""),
      document("two", "Same.md", ""),
    ])).toThrow("Duplicate workspace document path: Same.md");
    expect(() => createWorkspaceKnowledgeIndex([
      document("invalid", "docs//Invalid.md", ""),
    ])).toThrow("Invalid workspace document path: docs//Invalid.md");
  });
});
