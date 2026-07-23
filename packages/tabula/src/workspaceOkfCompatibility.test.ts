import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import { getWorkspaceOkfCompatibility } from "./workspaceOkfCompatibility";

describe("workspace OKF compatibility", () => {
  it("accepts a typed bundle, the root version exception, unknown types, and broken links", () => {
    const report = getWorkspaceOkfCompatibility(createWorkspaceKnowledgeIndex([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.1\"\n---\n\n# Catalog\n\n- [Orders](/tables/orders.md)",
      },
      {
        id: "nested-index",
        path: "tables/index.md",
        markdown: "# Tables\n\n- [Orders](./orders.md)",
      },
      {
        id: "orders",
        path: "tables/orders.md",
        markdown: "---\ntype: Custom Warehouse Object\nowner: data\n---\n\n[Future](./future.md)",
      },
      {
        id: "log",
        path: "log.md",
        markdown: "# Bundle updates\n\n## 2026-07-23\n- **Update**: Added orders.",
      },
    ]));

    expect(report).toMatchObject({
      targetVersion: "0.1",
      declaredVersion: "0.1",
      status: "conformant",
      conceptCount: 1,
      reservedDocumentCount: 3,
      errorCount: 0,
      warningCount: 0,
    });
    expect(report.documents.find((document) => document.documentId === "orders"))
      .toMatchObject({
        role: "concept",
        status: "conformant",
        conceptId: "tables/orders",
        conceptType: "Custom Warehouse Object",
      });

    const reportWithoutIndex = getWorkspaceOkfCompatibility(createWorkspaceKnowledgeIndex([
      {
        id: "standalone",
        path: "Standalone.md",
        markdown: "---\ntype: Unregistered Type\n---\n\n[Future](./future.md)",
      },
    ]));
    expect(reportWithoutIndex).toMatchObject({
      status: "conformant",
      reservedDocumentCount: 0,
      errorCount: 0,
      warningCount: 0,
    });
  });

  it("reports each strict concept requirement without treating empty frontmatter as absent", () => {
    const report = getWorkspaceOkfCompatibility(createWorkspaceKnowledgeIndex([
      { id: "missing", path: "Missing.md", markdown: "# Missing" },
      { id: "invalid", path: "Invalid.md", markdown: "---\ntype: [\n---\n" },
      { id: "empty", path: "Empty.md", markdown: "---\n---\n\n# Empty" },
      { id: "wrong-type", path: "Wrong.md", markdown: "---\ntype: 42\n---\n" },
    ]));

    expect(report.status).toBe("nonconformant");
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "concept_type_missing",
      "concept_frontmatter_invalid",
      "concept_frontmatter_missing",
      "concept_type_invalid",
    ]);
  });

  it("validates reserved index and log structure including the root-only version exception", () => {
    const report = getWorkspaceOkfCompatibility(createWorkspaceKnowledgeIndex([
      { id: "root-index", path: "index.md", markdown: "---\ntitle: Catalog\n---\n\nNo heading" },
      { id: "nested-index", path: "docs/index.md", markdown: "---\nokf_version: \"0.1\"\n---\n\n# Docs" },
      {
        id: "log",
        path: "log.md",
        markdown: "# Updates\n\n## July 23\n\n## 2026-07-22\n\n## 2026-07-23",
      },
    ]));

    expect(report.issues.map((issue) => [issue.code, issue.value])).toEqual([
      ["reserved_frontmatter_not_allowed", undefined],
      ["root_index_version_invalid", undefined],
      ["root_index_extra_metadata", "title"],
      ["index_structure_invalid", undefined],
      ["log_date_invalid", "July 23"],
      ["log_dates_out_of_order", undefined],
    ]);
  });

  it("keeps portability guidance as warnings instead of false conformance failures", () => {
    const report = getWorkspaceOkfCompatibility(createWorkspaceKnowledgeIndex([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.2\"\ntitle: Catalog\n---\n\n# Catalog",
      },
      {
        id: "concept",
        path: "Concept.md",
        markdown: "---\ntype: Note\n---\n\n[[Future]]",
      },
      { id: "long-extension", path: "Loose.markdown", markdown: "# Loose" },
    ]));

    expect(report).toMatchObject({
      status: "conformant",
      declaredVersion: "0.2",
      errorCount: 0,
      warningCount: 4,
      ignoredDocumentCount: 1,
    });
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "wikilink_syntax",
      "nonstandard_markdown_extension",
      "unsupported_okf_version",
      "root_index_extra_metadata",
    ]);
  });
});
