import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import {
  getOkfDocumentAttentionSignals,
  getOkfReviewSchedule,
  getWorkspaceKnowledgePosture,
} from "./workspaceKnowledgePosture";

describe("workspace knowledge posture", () => {
  it("keeps current, overdue, unscheduled, and invalid review dates distinct", () => {
    expect(getOkfReviewSchedule(
      { staleAfter: "2026-08-01" },
      "2026-07-29",
    )).toBe("current");
    expect(getOkfReviewSchedule(
      { staleAfter: "2026-07-29" },
      "2026-07-29",
    )).toBe("due");
    expect(getOkfReviewSchedule({}, "2026-07-29")).toBe("unscheduled");
    expect(getOkfReviewSchedule(
      { staleAfter: "soon" },
      "2026-07-29",
    )).toBe("invalid");
  });

  it("summarizes operational OKF posture without counting reserved files", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.2\"\n---\n\n# Knowledge",
      },
      {
        id: "current",
        path: "systems/current.md",
        markdown: [
          "---",
          "type: Service",
          "status: stable",
          "stale_after: 2026-08-31",
          "verified: { by: human:taeha, at: 2026-07-20T00:00:00Z }",
          "---",
          "",
          "# Current",
        ].join("\n"),
      },
      {
        id: "due",
        path: "policies/due.md",
        markdown: [
          "---",
          "type: Policy",
          "status: draft",
          "stale_after: 2026-07-01",
          "---",
          "",
          "# Due",
        ].join("\n"),
      },
      {
        id: "unscheduled",
        path: "runbooks/unscheduled.md",
        markdown: "---\ntype: Runbook\n---\n\n# Unscheduled",
      },
      {
        id: "invalid",
        path: "legacy/invalid.md",
        markdown: [
          "---",
          "type: API",
          "status: deprecated",
          "stale_after: later",
          "---",
          "",
          "# Invalid",
        ].join("\n"),
      },
    ]);

    expect(getWorkspaceKnowledgePosture(index, "2026-07-29")).toEqual({
      conceptCount: 4,
      currentCount: 1,
      reviewDueCount: 1,
      unscheduledCount: 1,
      invalidReviewDateCount: 1,
      unverifiedCount: 3,
      draftCount: 1,
      deprecatedCount: 1,
    });
  });

  it("keeps independent lifecycle, trust, and freshness concerns visible", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "deprecated",
        path: "deprecated.md",
        markdown: "---\ntype: API\nstatus: deprecated\n---\n\n# Deprecated",
      },
      {
        id: "unverified",
        path: "unverified.md",
        markdown: "---\ntype: Runbook\nstatus: draft\nstale_after: 2026-07-01\n---\n\n# Unverified",
      },
      {
        id: "due",
        path: "due.md",
        markdown: [
          "---",
          "type: Policy",
          "stale_after: 2026-07-01",
          "verified: { by: human:taeha, at: 2026-07-20T00:00:00Z }",
          "---",
          "",
          "# Due",
        ].join("\n"),
      },
      {
        id: "current",
        path: "current.md",
        markdown: [
          "---",
          "type: Service",
          "stale_after: 2026-08-01",
          "verified: { by: human:taeha, at: 2026-07-20T00:00:00Z }",
          "---",
          "",
          "# Current",
        ].join("\n"),
      },
      {
        id: "index",
        path: "index.md",
        markdown: "---\ntype: Index\n---\n\n# Index",
      },
    ]);
    const signals = (documentId: string) => getOkfDocumentAttentionSignals(
      index.analysesByDocumentId.get(documentId)!,
      "2026-07-29",
    );

    expect(signals("deprecated")).toEqual([
      "deprecated",
      "unverified",
      "review-unscheduled",
    ]);
    expect(signals("unverified")).toEqual([
      "draft",
      "unverified",
      "review-due",
    ]);
    expect(signals("due")).toEqual(["review-due"]);
    expect(signals("current")).toEqual([]);
    expect(signals("index")).toEqual([]);
  });
});
