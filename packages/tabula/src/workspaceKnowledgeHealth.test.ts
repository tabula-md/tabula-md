import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import {
  getWorkspaceKnowledgeHealth,
  getWorkspaceKnowledgeHealthDelta,
} from "./workspaceKnowledgeHealth";

describe("workspace knowledge health", () => {
  it("reports lifecycle, trust, provenance, relationship, and source issues", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "source",
        path: "source.md",
        markdown: [
          "---",
          "type: Reference",
          "status: deprecated",
          "stale_after: 2026-07-24",
          "generated: { by: agent:research, at: 2026-07-20T00:00:00Z }",
          "verified: { by: human:taeha, at: 2026-07-19T00:00:00Z }",
          "sources:",
          "  - id: policy",
          "    resource: https://example.com/policy",
          "---",
          "# Source",
          "",
          "Claim [^missing].",
        ].join("\n"),
      },
      {
        id: "consumer",
        path: "consumer.md",
        markdown: "---\ntype: Guide\n---\n[Source](source.md)",
      },
      {
        id: "orphan",
        path: "orphan.md",
        markdown: [
          "---",
          "type: Note",
          "generated: { by: agent:writer, at: 2026-07-21T00:00:00Z }",
          "---",
          "# Orphan",
        ].join("\n"),
      },
    ]);

    const report = getWorkspaceKnowledgeHealth(index, { today: "2026-07-25" });
    const sourceMarkdown = index.documentsById.get("source")?.markdown ?? "";
    expect(report.documentCount).toBe(3);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentId: "source", code: "stale" }),
      expect.objectContaining({ documentId: "source", code: "deprecated_referenced" }),
      expect.objectContaining({ documentId: "source", code: "verification_outdated" }),
      expect.objectContaining({
        documentId: "source",
        code: "source_reference_missing",
        value: "missing",
      }),
      expect.objectContaining({
        documentId: "source",
        code: "source_unused",
        value: "policy",
      }),
      expect.objectContaining({ documentId: "orphan", code: "unverified_generated" }),
      expect.objectContaining({ documentId: "orphan", code: "provenance_missing" }),
      expect.objectContaining({ documentId: "orphan", code: "orphan_concept" }),
    ]));
    for (const [code, expectedSelection] of [
      ["stale", "stale_after: 2026-07-24"],
      ["deprecated_referenced", "status: deprecated"],
      ["verification_outdated", "verified: { by: human:taeha, at: 2026-07-19T00:00:00Z }"],
      ["source_reference_missing", "[^missing]"],
      ["source_unused", "  - id: policy"],
    ] as const) {
      const issue = report.issues.find((candidate) =>
        candidate.documentId === "source" && candidate.code === code
      );
      expect(issue?.from).toBeTypeOf("number");
      expect(sourceMarkdown.slice(issue?.from, issue?.to)).toBe(expectedSelection);
    }
  });

  it("keeps malformed optional metadata out of compatibility while surfacing guidance", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "invalid",
        path: "invalid.md",
        markdown: [
          "---",
          "type: Reference",
          "resource: []",
          "status: archived",
          "stale_after: 2026-02-30",
          "generated: { by: agent:writer }",
          "verified: []",
          "sources: wrong",
          "---",
          "# Invalid",
        ].join("\n"),
      },
    ]);

    const report = getWorkspaceKnowledgeHealth(index);
    expect(report.issues).toEqual([
      expect.objectContaining({ code: "optional_metadata_invalid", value: "generated" }),
      expect.objectContaining({ code: "optional_metadata_invalid", value: "resource" }),
      expect.objectContaining({ code: "optional_metadata_invalid", value: "sources" }),
      expect.objectContaining({ code: "optional_metadata_invalid", value: "stale_after" }),
      expect.objectContaining({ code: "optional_metadata_invalid", value: "status" }),
      expect.objectContaining({ code: "optional_metadata_invalid", value: "verified" }),
    ]);
    const markdown = index.documentsById.get("invalid")?.markdown ?? "";
    for (const issue of report.issues) {
      expect(markdown.slice(issue.from, issue.to)).toMatch(
        new RegExp(`^${issue.value}:`),
      );
    }
  });

  it("returns a quiet report for a current human-reviewed concept", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "healthy",
        path: "healthy.md",
        markdown: [
          "---",
          "type: Reference",
          "stale_after: 2027-01-01",
          "generated: { by: agent:research, at: 2026-07-20T00:00:00Z }",
          "verified: { by: human:taeha, at: 2026-07-24T00:00:00Z }",
          "sources:",
          "  - id: policy",
          "    resource: https://example.com/policy",
          "---",
          "# Healthy",
          "",
          "Claim [^policy].",
        ].join("\n"),
      },
    ]);

    expect(getWorkspaceKnowledgeHealth(index, { today: "2026-07-25" })).toEqual({
      issues: [],
      attentionCount: 0,
      noticeCount: 0,
      documentCount: 1,
    });
  });

  it("reports broken and ambiguous concept relationships once per target", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "source",
        path: "source.md",
        markdown: [
          "---",
          "type: Guide",
          "---",
          "# Source",
          "",
          "[Missing](missing.md) and [Missing again](missing.md).",
          "",
          "[[Shared]]",
        ].join("\n"),
      },
      {
        id: "shared-a",
        path: "team-a/Shared.md",
        markdown: "---\ntype: Note\n---\n\n# Shared A\n\n[Source](../source.md)",
      },
      {
        id: "shared-b",
        path: "team-b/Shared.md",
        markdown: "---\ntype: Note\n---\n\n# Shared B\n\n[Source](../source.md)",
      },
    ]);

    const report = getWorkspaceKnowledgeHealth(index);

    expect(report.issues.filter((issue) =>
      issue.code === "relationship_broken"
    )).toEqual([
      expect.objectContaining({
        documentId: "source",
        value: "missing.md",
        severity: "attention",
      }),
    ]);
    const sourceMarkdown = index.documentsById.get("source")?.markdown ?? "";
    const broken = report.issues.find((issue) => issue.code === "relationship_broken");
    const ambiguous = report.issues.find((issue) => issue.code === "relationship_ambiguous");
    expect(sourceMarkdown.slice(broken?.from, broken?.to)).toBe("[Missing](missing.md)");
    expect(sourceMarkdown.slice(ambiguous?.from, ambiguous?.to)).toBe("[[Shared]]");
    expect(report.issues.filter((issue) =>
      issue.code === "relationship_ambiguous"
    )).toEqual([
      expect.objectContaining({
        documentId: "source",
        value: "Shared",
        severity: "attention",
      }),
    ]);
  });

  it("reports shared canonical resources and duplicate source attribution keys", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "first",
        path: "first.md",
        markdown: [
          "---",
          "type: Reference",
          "resource: urn:asset:shared",
          "sources:",
          "  - id: policy",
          "    resource: https://example.com/policy",
          "  - id: policy",
          "    resource: https://example.com/policy",
          "---",
          "# First",
          "",
          "Claim.[^policy]",
        ].join("\n"),
      },
      {
        id: "second",
        path: "second.md",
        markdown: [
          "---",
          "type: Reference",
          "resource: urn:asset:shared",
          "---",
          "# Second",
          "",
          "[First](first.md)",
        ].join("\n"),
      },
    ]);

    const report = getWorkspaceKnowledgeHealth(index);

    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        documentId: "first",
        code: "canonical_resource_shared",
        value: "urn:asset:shared",
        severity: "notice",
      }),
      expect.objectContaining({
        documentId: "second",
        code: "canonical_resource_shared",
        value: "urn:asset:shared",
        severity: "notice",
      }),
      expect.objectContaining({
        documentId: "first",
        code: "source_id_duplicate",
        value: "policy",
        severity: "attention",
      }),
      expect.objectContaining({
        documentId: "first",
        code: "source_resource_duplicate",
        value: "https://example.com/policy",
        severity: "notice",
      }),
    ]));
    const firstMarkdown = index.documentsById.get("first")?.markdown ?? "";
    const duplicateId = report.issues.find((issue) =>
      issue.documentId === "first" && issue.code === "source_id_duplicate"
    );
    const duplicateResource = report.issues.find((issue) =>
      issue.documentId === "first" && issue.code === "source_resource_duplicate"
    );
    expect(firstMarkdown.slice(duplicateId?.from, duplicateId?.to)).toBe("  - id: policy");
    expect(firstMarkdown.slice(duplicateResource?.from, duplicateResource?.to)).toBe(
      "    resource: https://example.com/policy",
    );
  });
});

describe("workspace knowledge health delta", () => {
  it("reports introduced and resolved signals without treating deleted documents as repaired", () => {
    const previous = createWorkspaceKnowledgeIndex([
      {
        id: "edited",
        path: "edited.md",
        markdown: "---\ntype: Note\nstale_after: 2020-01-01\n---\n\n# Edited",
      },
      {
        id: "deleted",
        path: "deleted.md",
        markdown: "---\ntype: Note\nstale_after: 2020-01-01\n---\n\n# Deleted",
      },
      {
        id: "linked",
        path: "linked.md",
        markdown: "---\ntype: Note\n---\n\n# Linked\n\n[Edited](edited.md)",
      },
    ]);
    const current = createWorkspaceKnowledgeIndex([
      {
        id: "edited",
        path: "edited.md",
        markdown: "---\ntype: Note\ngenerated: { by: agent:test, at: 2026-07-25T00:00:00Z }\n---\n\n# Edited",
      },
      {
        id: "linked",
        path: "linked.md",
        markdown: "---\ntype: Note\n---\n\n# Linked",
      },
    ]);

    const delta = getWorkspaceKnowledgeHealthDelta(previous, current, {
      today: "2026-07-25",
    });

    expect(delta.resolvedIssues).toEqual([
      expect.objectContaining({ documentId: "edited", code: "stale" }),
    ]);
    expect(delta.introducedIssues).toEqual([
      expect.objectContaining({ documentId: "edited", code: "provenance_missing" }),
      expect.objectContaining({ documentId: "edited", code: "unverified_generated" }),
      expect.objectContaining({ documentId: "linked", code: "orphan_concept" }),
    ]);
    expect(delta.resolvedIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: "deleted", code: "stale" }),
      ]),
    );
  });

  it("does not report a count-only issue as new when its detail value changes", () => {
    const previous = createWorkspaceKnowledgeIndex([
      {
        id: "deprecated",
        path: "deprecated.md",
        markdown: "---\ntype: Note\nstatus: deprecated\n---\n\n# Deprecated",
      },
      {
        id: "first",
        path: "first.md",
        markdown: "---\ntype: Note\n---\n\n[Deprecated](deprecated.md)",
      },
      {
        id: "second",
        path: "second.md",
        markdown: "---\ntype: Note\n---\n\n[Deprecated](deprecated.md)",
      },
    ]);
    const current = createWorkspaceKnowledgeIndex(
      [...previous.documentsById.values()].filter(
        (document) => document.id !== "second",
      ),
    );

    const delta = getWorkspaceKnowledgeHealthDelta(previous, current);

    expect(delta.introducedIssues).toEqual([]);
    expect(delta.resolvedIssues).toEqual([]);
  });

  it("tracks relationship damage and repair across a workspace change", () => {
    const healthy = createWorkspaceKnowledgeIndex([
      {
        id: "source",
        path: "source.md",
        markdown: "---\ntype: Guide\n---\n\n[Target](target.md)",
      },
      {
        id: "target",
        path: "target.md",
        markdown: "---\ntype: Reference\n---\n\n# Target",
      },
    ]);
    const broken = createWorkspaceKnowledgeIndex([
      {
        id: "source",
        path: "source.md",
        markdown: "---\ntype: Guide\n---\n\n[Target](missing.md)",
      },
      {
        id: "target",
        path: "target.md",
        markdown: "---\ntype: Reference\n---\n\n# Target",
      },
    ]);

    expect(
      getWorkspaceKnowledgeHealthDelta(healthy, broken).introducedIssues,
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        documentId: "source",
        code: "relationship_broken",
        value: "missing.md",
      }),
    ]));
    expect(
      getWorkspaceKnowledgeHealthDelta(broken, healthy).resolvedIssues,
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        documentId: "source",
        code: "relationship_broken",
        value: "missing.md",
      }),
    ]));
  });
});
