import { describe, expect, it } from "vitest";
import {
  createWorkspaceKnowledgeIndex,
  type OkfCompatibilityReport,
  type WorkspaceKnowledgeHealthReport,
} from "@tabula-md/tabula";
import {
  createWorkspaceKnowledgeReviewFilters,
  filterWorkspaceKnowledgeReviewEntries,
  getWorkspaceKnowledgeReviewEntries,
  sortWorkspaceKnowledgeReviewEntries,
  type WorkspaceKnowledgeReviewEntry,
} from "./workspaceKnowledgeReviewQueueModel";

const emptyCompatibility: OkfCompatibilityReport = {
  targetVersion: "0.2",
  status: "conformant",
  conceptCount: 0,
  reservedDocumentCount: 0,
  ignoredDocumentCount: 0,
  errorCount: 0,
  warningCount: 0,
  documents: [],
  issues: [],
};

const emptyHealth: WorkspaceKnowledgeHealthReport = {
  issues: [],
  attentionCount: 0,
  noticeCount: 0,
  documentCount: 0,
};

const entry = (
  documentId: string,
  overrides: Partial<WorkspaceKnowledgeReviewEntry> = {},
): WorkspaceKnowledgeReviewEntry => ({
  documentId,
  path: `${documentId}.md`,
  title: documentId,
  priority: "notice",
  compatibilityIssues: [],
  healthIssues: [],
  lifecycleConcern: false,
  trustConcern: false,
  freshnessConcern: false,
  ...overrides,
});

describe("workspace knowledge review queue", () => {
  it("groups every issue and metadata concern under one document row", () => {
    const index = createWorkspaceKnowledgeIndex([{
      id: "payments",
      path: "runbooks/payments.md",
      markdown: [
        "---",
        "title: Payment recovery",
        "type: Runbook",
        "status: draft",
        "owner: team:payments",
        "stale_after: 2020-01-01",
        "---",
        "# Payments",
      ].join("\n"),
    }]);
    const compatibility: OkfCompatibilityReport = {
      ...emptyCompatibility,
      status: "nonconformant",
      errorCount: 1,
      issues: [{
        code: "wikilink_syntax",
        severity: "error",
        documentId: "payments",
        path: "runbooks/payments.md",
      }],
    };
    const health: WorkspaceKnowledgeHealthReport = {
      ...emptyHealth,
      attentionCount: 1,
      documentCount: 1,
      issues: [{
        code: "provenance_missing",
        severity: "attention",
        documentId: "payments",
        path: "runbooks/payments.md",
      }],
    };

    expect(getWorkspaceKnowledgeReviewEntries(index, {
      compatibility,
      health,
    })).toEqual([expect.objectContaining({
      documentId: "payments",
      path: "runbooks/payments.md",
      title: "Payment recovery",
      owner: "team:payments",
      reviewDate: "2020-01-01",
      lifecycle: "draft",
      trust: "unverified",
      freshness: "stale",
      priority: "required",
      lifecycleConcern: false,
      trustConcern: false,
      freshnessConcern: false,
      compatibilityIssues: compatibility.issues,
      healthIssues: health.issues,
    })]);
  });

  it("uses OR within a facet and AND across facets", () => {
    const entries = [
      entry("draft-stale", {
        lifecycle: "draft",
        trust: "unverified",
        freshness: "stale",
        healthIssues: [{
          code: "stale",
          severity: "attention",
          documentId: "draft-stale",
          path: "draft-stale.md",
        }],
      }),
      entry("deprecated-current", {
        lifecycle: "deprecated",
        trust: "human-reviewed",
        freshness: "current",
      }),
      entry("stable-stale", {
        lifecycle: "stable",
        trust: "unverified",
        freshness: "stale",
      }),
    ];

    const filtered = filterWorkspaceKnowledgeReviewEntries(
      entries,
      createWorkspaceKnowledgeReviewFilters({
        lifecycle: new Set(["draft", "deprecated"]),
        freshness: new Set(["stale"]),
      }),
    );
    expect(filtered.map(({ documentId }) => documentId)).toEqual(["draft-stale"]);

    expect(filterWorkspaceKnowledgeReviewEntries(
      entries,
      createWorkspaceKnowledgeReviewFilters({
        healthIssues: new Set(["stale"]),
      }),
    ).map(({ documentId }) => documentId)).toEqual(["draft-stale"]);
  });

  it("sorts by severity, review date, path, and owner with missing values last", () => {
    const entries = [
      entry("bravo", {
        path: "b/bravo.md",
        owner: "Zeta",
        reviewDate: "2026-09-01",
        priority: "attention",
      }),
      entry("alpha", {
        path: "a/alpha.md",
        owner: "Alpha",
        reviewDate: "2026-08-01",
        priority: "required",
      }),
      entry("charlie"),
    ];

    expect(sortWorkspaceKnowledgeReviewEntries(entries, "severity")
      .map(({ documentId }) => documentId)).toEqual(["alpha", "bravo", "charlie"]);
    expect(sortWorkspaceKnowledgeReviewEntries(entries, "review-date")
      .map(({ documentId }) => documentId)).toEqual(["alpha", "bravo", "charlie"]);
    expect(sortWorkspaceKnowledgeReviewEntries(entries, "path")
      .map(({ documentId }) => documentId)).toEqual(["alpha", "bravo", "charlie"]);
    expect(sortWorkspaceKnowledgeReviewEntries(entries, "owner")
      .map(({ documentId }) => documentId)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("drops a document once its current metadata and reports are clean", () => {
    const index = createWorkspaceKnowledgeIndex([{
      id: "clean",
      path: "clean.md",
      markdown: [
        "---",
        "type: Guide",
        "status: stable",
        "stale_after: 2099-01-01",
        "verified: { by: human:taeha, at: 2026-07-30T00:00:00Z }",
        "---",
        "# Clean",
      ].join("\n"),
    }]);

    expect(getWorkspaceKnowledgeReviewEntries(index, {
      compatibility: emptyCompatibility,
      health: emptyHealth,
    })).toEqual([]);
  });

  it("does not turn lifecycle or missing review dates into workspace issues", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "draft",
        path: "draft.md",
        markdown: "---\ntype: Guide\nstatus: draft\n---\n# Draft",
      },
      {
        id: "deprecated",
        path: "deprecated.md",
        markdown: "---\ntype: Guide\nstatus: deprecated\n---\n# Deprecated",
      },
    ]);

    expect(getWorkspaceKnowledgeReviewEntries(index, {
      compatibility: emptyCompatibility,
      health: emptyHealth,
    })).toEqual([]);
  });

  it("exposes reported malformed metadata without inventing a review date", () => {
    const index = createWorkspaceKnowledgeIndex([{
      id: "invalid-date",
      path: "invalid-date.md",
      markdown: [
        "---",
        "type: Guide",
        "stale_after: next-quarter",
        "---",
        "# Invalid date",
      ].join("\n"),
    }]);

    const invalidMetadataIssue = {
      code: "optional_metadata_invalid" as const,
      severity: "attention" as const,
      documentId: "invalid-date",
      path: "invalid-date.md",
      value: "stale_after",
    };
    const entries = getWorkspaceKnowledgeReviewEntries(index, {
      compatibility: emptyCompatibility,
      health: {
        ...emptyHealth,
        attentionCount: 1,
        documentCount: 1,
        issues: [invalidMetadataIssue],
      },
    });

    expect(entries).toEqual([expect.objectContaining({
      documentId: "invalid-date",
      healthIssues: [invalidMetadataIssue],
    })]);
    expect(entries[0]).not.toHaveProperty("reviewDate");
  });
});
