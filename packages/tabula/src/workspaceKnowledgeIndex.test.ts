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
      "type: Guide",
      "tags: [docs, product]",
      "resource: ' https://example.com/products/guide '",
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
      type: "Guide",
      tags: ["docs", "product"],
      resource: " https://example.com/products/guide ",
      owner: { team: "Core" },
      example: "[Not a link](Private.md)",
    });
    expect(analysis.knowledgeMetadata).toEqual({
      type: "Guide",
      tags: ["docs", "product"],
      resource: "https://example.com/products/guide",
    });
    expect(analysis.headings).toEqual([
      {
        depth: 1,
        id: "start-here",
        sourceLineNumber: 11,
        text: "Start here",
        from: markdown.indexOf("# Start"),
        to: markdown.indexOf("# Start") + "# Start *here*".length,
      },
    ]);
    expect(analysis.links).toEqual([
      {
        syntax: "markdown",
        relation: "link",
        label: "API",
        target: "../API Guide.md",
        from: markdown.indexOf("[API]"),
        to: markdown.indexOf("[API]") + "[API](<../API Guide.md>)".length,
      },
      {
        syntax: "markdown",
        relation: "link",
        label: "the architecture",
        target: "/Architecture.md",
        referenceIdentifier: "arch",
        from: markdown.indexOf("[the architecture]"),
        to: markdown.indexOf("[the architecture]") + "[the architecture][arch]".length,
      },
    ]);
  });

  it("indexes type, tags, and resource as normalized knowledge metadata", () => {
    const index = createWorkspaceKnowledgeIndex([
      document(
        "runbook",
        "runbooks/Checkout.md",
        [
          "---",
          "type: ' Runbook '",
          "tags: [oncall, ' checkout ', oncall, 42, '']",
          "resource: ' https://github.com/acme/checkout '",
          "---",
          "# Checkout",
        ].join("\n"),
      ),
      document(
        "playbook",
        "playbooks/Payments.md",
        [
          "---",
          "type: Runbook",
          "tags: payments",
          "resource: https://github.com/acme/checkout",
          "---",
          "# Payments",
        ].join("\n"),
      ),
      document(
        "unstructured",
        "Notes.md",
        [
          "---",
          "type: 42",
          "tags: { team: Core }",
          "resource: false",
          "---",
          "# Notes",
        ].join("\n"),
      ),
    ]);

    expect(index.analysesByDocumentId.get("runbook")?.knowledgeMetadata).toEqual({
      type: "Runbook",
      tags: ["oncall", "checkout"],
      resource: "https://github.com/acme/checkout",
    });
    expect(index.analysesByDocumentId.get("playbook")?.knowledgeMetadata).toEqual({
      type: "Runbook",
      tags: ["payments"],
      resource: "https://github.com/acme/checkout",
    });
    expect(index.analysesByDocumentId.get("unstructured")?.knowledgeMetadata).toEqual({
      tags: [],
    });
    expect(index.documentIdsByType.get("Runbook")).toEqual(["runbook", "playbook"]);
    expect(index.documentIdsByTag.get("oncall")).toEqual(["runbook"]);
    expect(index.documentIdsByTag.get("checkout")).toEqual(["runbook"]);
    expect(index.documentIdsByTag.get("payments")).toEqual(["playbook"]);
    expect(index.documentIdsByResource.get("https://github.com/acme/checkout")).toEqual([
      "runbook",
      "playbook",
    ]);
  });

  it("extracts wiki links and embeds without indexing escaped or code examples", () => {
    const markdown = [
      "---",
      "example: '[[Frontmatter]]'",
      "---",
      "",
      "[[Page]] and [[docs/Guide#Setup|Setup guide]]",
      "![[Transclusion]]",
      "\\[[Escaped]] and `[[Inline code]]`",
      "[outer [[Nested]]](Target.md)",
      "```md",
      "[[Code fence]]",
      "```",
    ].join("\r\n");

    const analysis = analyzeWorkspaceDocument(document("start", "Start.md", markdown));

    expect(analysis.links).toEqual([
      {
        syntax: "wikilink",
        relation: "link",
        label: "Page",
        target: "Page",
        from: markdown.indexOf("[[Page]]"),
        to: markdown.indexOf("[[Page]]") + "[[Page]]".length,
      },
      {
        syntax: "wikilink",
        relation: "link",
        label: "Setup guide",
        target: "docs/Guide#Setup",
        from: markdown.indexOf("[[docs/Guide"),
        to: markdown.indexOf("[[docs/Guide") + "[[docs/Guide#Setup|Setup guide]]".length,
      },
      {
        syntax: "wikilink",
        relation: "embed",
        label: "Transclusion",
        target: "Transclusion",
        from: markdown.indexOf("![[Transclusion]]"),
        to: markdown.indexOf("![[Transclusion]]") + "![[Transclusion]]".length,
      },
      {
        syntax: "markdown",
        relation: "link",
        label: "outer [[Nested]]",
        target: "Target.md",
        from: markdown.indexOf("[outer"),
        to: markdown.indexOf("[outer") + "[outer [[Nested]]](Target.md)".length,
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
          "[Missing section](#missing-section)",
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
      { label: "Missing section", status: "broken", targetDocumentId: undefined, targetPath: "docs/Start.md", fragment: "missing-section" },
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
      "Missing section",
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
      document(
        "start",
        "docs/Start.md",
        "---\ntype: Guide\ntags: [stable]\nresource: urn:tabula:stable\n---\n\n[Stable](/Stable.md)",
      ),
    );
    expect(changedSource.analysesByDocumentId.get("start")).not.toBe(startAnalysis);
    expect(changedSource.analysesByDocumentId.get("stable")).toBe(stableAnalysis);
    expect(changedSource.backlinksByDocumentId.get("stable")?.[0]).toMatchObject({
      sourceDocumentId: "start",
      status: "resolved",
    });
    expect(changedSource.documentIdsByType.get("Guide")).toEqual(["start"]);
    expect(changedSource.documentIdsByTag.get("stable")).toEqual(["start"]);
    expect(changedSource.documentIdsByResource.get("urn:tabula:stable")).toEqual(["start"]);

    const changedMetadata = updateWorkspaceKnowledgeIndex(
      changedSource,
      document("start", "docs/Start.md", "---\ntype: Reference\ntags: [current]\n---\n"),
    );
    expect(changedMetadata.documentIdsByType.has("Guide")).toBe(false);
    expect(changedMetadata.documentIdsByTag.has("stable")).toBe(false);
    expect(changedMetadata.documentIdsByResource.has("urn:tabula:stable")).toBe(false);
    expect(changedMetadata.documentIdsByType.get("Reference")).toEqual(["start"]);
    expect(changedMetadata.documentIdsByTag.get("current")).toEqual(["start"]);

    const withoutMetadataDocument = removeWorkspaceDocumentFromKnowledgeIndex(
      changedMetadata,
      "start",
    );
    expect(withoutMetadataDocument.documentIdsByType.has("Reference")).toBe(false);
    expect(withoutMetadataDocument.documentIdsByTag.has("current")).toBe(false);
  });

  it("resolves wiki paths conservatively and exposes ambiguous basename candidates", () => {
    const index = createWorkspaceKnowledgeIndex([
      document(
        "start",
        "notes/Start.md",
        [
          "# Intro",
          "[[Local]]",
          "![[Local#Part]]",
          "[[Unique|Only one]]",
          "[[Shared]]",
          "[[/Architecture]]",
          "[[../API Guide]]",
          "[[#Intro]]",
          "[[Missing]]",
          "[[local]]",
        ].join("\n"),
      ),
      document("local", "notes/Local.md", "# Local\n\n## Part"),
      document("other-local", "archive/Local.md", "# Other local"),
      document("unique", "archive/Unique.markdown", "# Unique"),
      document("shared-a", "a/Shared.md", "# Shared A"),
      document("shared-b", "b/Shared.markdown", "# Shared B"),
      document("architecture", "Architecture.md", "# Architecture"),
      document("api", "API Guide.md", "# API"),
    ]);

    const outgoing = index.outgoingLinksByDocumentId.get("start") ?? [];
    expect(outgoing.map((link) => ({
      label: link.label,
      syntax: link.syntax,
      relation: link.relation,
      status: link.status,
      targetDocumentId: link.targetDocumentId,
      fragment: link.fragment,
      candidateDocumentIds: link.candidateDocumentIds,
    }))).toEqual([
      { label: "Local", syntax: "wikilink", relation: "link", status: "resolved", targetDocumentId: "local", fragment: undefined, candidateDocumentIds: undefined },
      { label: "Local#Part", syntax: "wikilink", relation: "embed", status: "resolved", targetDocumentId: "local", fragment: "part", candidateDocumentIds: undefined },
      { label: "Only one", syntax: "wikilink", relation: "link", status: "resolved", targetDocumentId: "unique", fragment: undefined, candidateDocumentIds: undefined },
      { label: "Shared", syntax: "wikilink", relation: "link", status: "ambiguous", targetDocumentId: undefined, fragment: undefined, candidateDocumentIds: ["shared-a", "shared-b"] },
      { label: "/Architecture", syntax: "wikilink", relation: "link", status: "resolved", targetDocumentId: "architecture", fragment: undefined, candidateDocumentIds: undefined },
      { label: "../API Guide", syntax: "wikilink", relation: "link", status: "resolved", targetDocumentId: "api", fragment: undefined, candidateDocumentIds: undefined },
      { label: "#Intro", syntax: "wikilink", relation: "link", status: "resolved", targetDocumentId: "start", fragment: "intro", candidateDocumentIds: undefined },
      { label: "Missing", syntax: "wikilink", relation: "link", status: "broken", targetDocumentId: undefined, fragment: undefined, candidateDocumentIds: undefined },
      { label: "local", syntax: "wikilink", relation: "link", status: "broken", targetDocumentId: undefined, fragment: undefined, candidateDocumentIds: undefined },
    ]);
    expect(index.backlinksByDocumentId.get("local")?.map((link) => link.relation)).toEqual([
      "link",
      "embed",
    ]);
    expect(index.ambiguousLinks).toHaveLength(1);
    expect(index.brokenLinks.map((link) => link.target)).toEqual(["Missing", "local"]);
  });

  it("reclassifies ambiguous wiki links when candidates are removed", () => {
    const initial = createWorkspaceKnowledgeIndex([
      document("start", "Start.md", "[[Shared]]"),
      document("shared-a", "a/Shared.md", "# A"),
      document("shared-b", "b/Shared.md", "# B"),
    ]);
    const sourceAnalysis = initial.analysesByDocumentId.get("start");
    expect(initial.ambiguousLinks[0]?.candidateDocumentIds).toEqual(["shared-a", "shared-b"]);

    const resolved = removeWorkspaceDocumentFromKnowledgeIndex(initial, "shared-b");
    expect(resolved.analysesByDocumentId.get("start")).toBe(sourceAnalysis);
    expect(resolved.ambiguousLinks).toHaveLength(0);
    expect(resolved.backlinksByDocumentId.get("shared-a")?.[0]).toMatchObject({
      status: "resolved",
      sourceDocumentId: "start",
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
