import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import {
  getOkfMigrationUpdates,
  planOkf01To02Migration,
} from "./workspaceOkfMigration";

const index = (documents: Parameters<typeof createWorkspaceKnowledgeIndex>[0]) =>
  createWorkspaceKnowledgeIndex(documents);

describe("OKF 0.1 to 0.2 migration", () => {
  it("previews a lossless explicit migration with producer and citation mappings", () => {
    const source = [
      "---",
      "type: Reference",
      "timestamp: 2026-05-28T14:30:00Z",
      "owner: platform",
      "custom:",
      "  nested: keep",
      "---",
      "",
      "# Overview",
      "",
      "Legacy body.",
      "",
      "# Citations",
      "",
      "[1] [Specification](https://example.com/spec)",
    ].join("\n");
    const plan = planOkf01To02Migration(index([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.1\"\nroot_extension: keep\n---\n\n# Catalog",
      },
      { id: "concept", path: "concept.md", markdown: source },
    ]), { producerBy: "openwiki/1.2.0" });

    expect(plan).toMatchObject({
      applicable: true,
      sourceVersion: "0.1",
      targetVersion: "0.2",
      changedFileCount: 2,
      manualCitationCount: 0,
      missingProducerCount: 0,
      invalidDocumentCount: 0,
      deletedFileCount: 0,
    });
    const root = plan.candidates.find((candidate) => candidate.documentId === "index");
    expect(root?.markdown).toContain('okf_version: "0.2"');
    expect(root?.markdown).toContain("root_extension: keep");
    const concept = plan.candidates.find((candidate) => candidate.documentId === "concept");
    expect(concept?.markdown).toContain("owner: platform");
    expect(concept?.markdown).toContain("nested: keep");
    expect(concept?.markdown).not.toContain("timestamp:");
    expect(concept?.markdown).toContain("by: openwiki/1.2.0");
    expect(concept?.markdown).toContain("at: 2026-05-28T14:30:00Z");
    expect(concept?.markdown).toContain("id: source-1");
    expect(concept?.markdown).toContain("resource: https://example.com/spec");
    expect(concept?.markdown).toContain("Sources: [^source-1]");
    expect(concept?.markdown).toContain(
      "[^source-1]: [Specification](https://example.com/spec)",
    );
    expect(source).toContain("timestamp:");
  });

  it("reports unresolved producer and citation decisions without corrupting originals", () => {
    const source = [
      "---",
      "type: Reference",
      "timestamp: 2026-05-28T14:30:00Z",
      "unknown: keep",
      "---",
      "",
      "# Citations",
      "",
      "Internal source without a URL",
    ].join("\n");
    const plan = planOkf01To02Migration(index([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.1\"\n---\n\n# Catalog",
      },
      { id: "concept", path: "concept.md", markdown: source },
    ]));
    const concept = plan.candidates.find((candidate) => candidate.documentId === "concept");

    expect(plan).toMatchObject({
      missingProducerCount: 1,
      manualCitationCount: 1,
    });
    expect(concept?.markdown).toContain("timestamp: 2026-05-28T14:30:00Z");
    expect(concept?.markdown).toContain("unknown: keep");
    expect(concept?.markdown).toContain("Internal source without a URL");
    expect(concept?.issues.map((issue) => issue.code)).toEqual([
      "producer_identity_required",
      "citation_requires_manual_source_id",
    ]);
  });

  it("supports partial application and refuses already migrated bundles", () => {
    const plan = planOkf01To02Migration(index([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.1\"\n---\n\n# Catalog",
      },
      {
        id: "first",
        path: "first.md",
        markdown: "---\ntype: Note\ntimestamp: 2026-01-01T00:00:00Z\n---\n",
      },
      {
        id: "second",
        path: "second.md",
        markdown: "---\ntype: Note\ntimestamp: 2026-01-02T00:00:00Z\n---\n",
      },
    ]), { producerBy: "agent/1.0" });

    expect(getOkfMigrationUpdates(plan, ["first"])).toEqual([
      expect.objectContaining({ documentId: "first" }),
    ]);
    expect(plan.candidates.find((candidate) => candidate.documentId === "second")
      ?.beforeMarkdown).toContain("timestamp:");

    const alreadyMigrated = planOkf01To02Migration(index([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.2\"\n---\n\n# Catalog",
      },
    ]));
    expect(alreadyMigrated).toMatchObject({
      applicable: false,
      sourceVersion: "0.2",
      candidates: [],
    });
  });
});
