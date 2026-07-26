import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import { getWorkspaceOkfCompatibility } from "./workspaceOkfCompatibility";
import {
  getOkfRepairDiff,
  planOkfConceptRepairs,
  planOkfWikilinkRepairs,
  planWorkspaceOkfConformance,
  TABULA_GENERATED_OKF_INDEX_MARKER,
} from "./workspaceOkfConformance";

const getPlan = (documents: Parameters<typeof createWorkspaceKnowledgeIndex>[0]) => {
  const index = createWorkspaceKnowledgeIndex(documents);
  return {
    index,
    plan: planWorkspaceOkfConformance(index, getWorkspaceOkfCompatibility(index)),
  };
};

describe("workspace OKF conformance planning", () => {
  it("suggests types from typed siblings before path conventions", () => {
    const { plan } = getPlan([
      {
        id: "typed",
        path: "architecture/runtime.md",
        markdown: "---\ntype: System\n---\n\n# Runtime",
      },
      {
        id: "missing",
        path: "architecture/network.md",
        markdown: "# Network",
      },
    ]);

    expect(plan.conceptRepairs).toEqual([
      expect.objectContaining({
        documentId: "missing",
        repairable: true,
        suggestedType: { type: "System", source: "folder" },
      }),
    ]);
  });

  it("leaves invalid YAML non-repairable and does not invent a fallback type", () => {
    const { plan } = getPlan([
      { id: "invalid", path: "misc/invalid.md", markdown: "---\ntype: [\n---\n" },
      { id: "unknown", path: "misc/unknown.md", markdown: "# Unknown" },
    ]);

    expect(plan.conceptRepairs).toEqual([
      expect.objectContaining({
        documentId: "invalid",
        repairable: false,
        suggestedType: undefined,
      }),
      expect.objectContaining({
        documentId: "unknown",
        repairable: true,
        suggestedType: undefined,
      }),
    ]);
  });

  it("treats optional retrieval metadata as guidance, not compatibility errors", () => {
    const { plan } = getPlan([
      {
        id: "concept",
        path: "concept.md",
        markdown: "---\ntype: Concept\ncustom: preserved\n---\n\n# Concept",
      },
    ]);

    expect(plan.metadataSuggestions).toEqual([{
      documentId: "concept",
      path: "concept.md",
      missingFields: ["description", "tags", "resource"],
    }]);
  });

  it("plans selected type changes without losing extension metadata", () => {
    const { index } = getPlan([
      {
        id: "concept",
        path: "concept.md",
        markdown: "---\nowner: platform\ncustom: preserved\n---\n\n# Concept",
      },
    ]);

    const repairs = planOkfConceptRepairs(index, [{
      documentId: "concept",
      conceptType: "Reference",
    }]);

    expect(repairs.failures).toEqual([]);
    expect(repairs.updates).toHaveLength(1);
    expect(repairs.updates[0]?.markdown).toContain("owner: platform");
    expect(repairs.updates[0]?.markdown).toContain("custom: preserved");
    expect(repairs.updates[0]?.markdown).toContain("type: Reference");
    expect(getOkfRepairDiff(
      repairs.updates[0]!.beforeMarkdown,
      repairs.updates[0]!.markdown,
    )).toContainEqual({ kind: "add", text: "type: Reference" });
  });

  it("derives virtual indexes and distinguishes generated content from curated prose", () => {
    const first = getPlan([
      {
        id: "root-index",
        path: "index.md",
        markdown: "# Welcome\n\nRead these pages in order.",
      },
      {
        id: "runtime",
        path: "architecture/runtime.md",
        markdown: "---\ntype: Architecture\ndescription: Runtime composition.\n---\n\n# Runtime",
      },
      {
        id: "deploy",
        path: "operations/deploy.md",
        markdown: "---\ntype: Runbook\n---\n\n# Deploy",
      },
    ]);

    expect(first.plan.indexes).toEqual([
      expect.objectContaining({
        path: "index.md",
        state: "curated",
        changed: true,
        conceptCount: 0,
        directoryCount: 2,
      }),
      expect.objectContaining({
        path: "architecture/index.md",
        state: "missing",
        conceptCount: 1,
      }),
      expect.objectContaining({
        path: "operations/index.md",
        state: "missing",
        conceptCount: 1,
      }),
    ]);
    const architecture = first.plan.indexes.find(
      (candidate) => candidate.path === "architecture/index.md",
    )!;
    expect(architecture.markdown).toContain(TABULA_GENERATED_OKF_INDEX_MARKER);
    expect(architecture.markdown).toContain(
      "- [Runtime](runtime.md) - Runtime composition.",
    );

    const second = getPlan([
      {
        id: "runtime",
        path: "architecture/runtime.md",
        markdown: "---\ntype: Architecture\ndescription: Runtime composition.\n---\n\n# Runtime",
      },
      {
        id: "architecture-index",
        path: "architecture/index.md",
        markdown: architecture.markdown,
      },
    ]);
    expect(second.plan.indexes.find(
      (candidate) => candidate.path === "architecture/index.md",
    )).toMatchObject({
      state: "generated",
      changed: false,
    });
  });

  it("keeps an OpenWiki 0.1 declaration while defaulting new indexes to OKF 0.2", () => {
    const openWiki = getPlan([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.1\"\n---\n\n# Files",
      },
      {
        id: "concept",
        path: "docs/concept.md",
        markdown: "---\ntype: Concept\n---\n\n# Concept",
      },
    ]);
    expect(openWiki.plan.indexes.find((candidate) => candidate.path === "index.md")?.markdown)
      .toContain('okf_version: "0.1"');

    const newBundle = getPlan([
      {
        id: "concept",
        path: "docs/concept.md",
        markdown: "---\ntype: Concept\n---\n\n# Concept",
      },
    ]);
    expect(newBundle.plan.indexes.find((candidate) => candidate.path === "index.md")?.markdown)
      .toContain('okf_version: "0.2"');
  });

  it("converts only resolved non-embed wikilinks and preserves aliases and fragments", () => {
    const { index, plan } = getPlan([
      {
        id: "source",
        path: "guides/source.md",
        markdown: [
          "---",
          "type: Guide",
          "---",
          "",
          "See [[Target#Details|the target]], [[Missing]], and ![[Target]].",
        ].join("\n"),
      },
      {
        id: "target",
        path: "reference/Target.md",
        markdown: "---\ntype: Reference\n---\n\n# Target\n\n## Details",
      },
    ]);

    expect(plan.wikilinkRepairs).toEqual([{
      documentId: "source",
      path: "guides/source.md",
      beforeMarkdown: expect.any(String),
      convertibleCount: 1,
      skippedCount: 2,
    }]);
    const updates = planOkfWikilinkRepairs(index, ["source"]);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.markdown).toContain(
      "See [the target](../reference/Target.md#details), [[Missing]], and ![[Target]].",
    );
    expect(updates[0]?.patches).toHaveLength(1);
  });
});
