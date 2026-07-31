import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import { validateOkf02AdvancedContracts } from "./workspaceOkfAdvancedContracts";

const createIndex = (
  computationFrontmatter: string,
  body = "# Computation\n\n```sql\nselect 1\n```",
) => createWorkspaceKnowledgeIndex([
  {
    id: "index",
    path: "index.md",
    markdown: "---\nokf_version: \"0.2\"\n---\n\n# Index",
  },
  {
    id: "computation",
    path: "computations/revenue.md",
    markdown: `---\ntype: Attested Computation\n${computationFrontmatter}---\n\n${body}`,
  },
  {
    id: "consumer",
    path: "metrics/revenue.md",
    markdown: "---\ntype: Metric\n---\n\n[Revenue](../computations/revenue.md)",
  },
]);

describe("OKF 0.2 advanced contracts", () => {
  it("validates a supported attested computation without executing it", () => {
    const report = validateOkf02AdvancedContracts(createIndex([
      "runtime: bigquery",
      "parameters:",
      "  - { name: year, type: integer, required: true }",
      "executor:",
      "  resource: ../references/run.md",
      "  receipt: [job_id, executed_sql, result]",
      "attester:",
      "  resource: ../references/check.py",
      "stale_after: 2027-12-31",
    ].join("\n") + "\n"), {
      availablePaths: [
        "index.md",
        "computations/revenue.md",
        "metrics/revenue.md",
        "references/run.md",
        "references/check.py",
      ],
      today: "2026-07-30",
    });

    expect(report.support).toEqual({
      level: "advanced",
      attestedComputationCount: 1,
      supportedComputationCount: 1,
      unsupportedComputationCount: 0,
      unsupportedRuntimes: [],
    });
    expect(report.diagnostics).toEqual([]);
  });

  it("reports structural, resource, receipt, and freshness problems", () => {
    const report = validateOkf02AdvancedContracts(createIndex([
      "runtime: bigquery",
      "parameters:",
      "  - { name: year, type: integer, required: true }",
      "  - { name: year, type: integer, required: false }",
      "computation: ../references/missing.sql",
      "executor:",
      "  resource: ../references/missing-run.md",
      "  receipt: []",
      "attester:",
      "  resource: ../references/missing-check.py",
      "stale_after: 2026-01-01",
    ].join("\n") + "\n", "# Notes"), { today: "2026-07-30" });
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain("okf_02_parameter_duplicate");
    expect(codes).toContain("okf_02_computation_resource_missing");
    expect(codes).toContain("okf_02_executor_resource_missing");
    expect(codes).toContain("okf_02_receipt_empty");
    expect(codes).toContain("okf_02_attester_resource_missing");
    expect(codes).toContain("okf_02_stale_computation_in_use");
  });

  it("keeps unknown runtimes as partially supported instead of invalid", () => {
    const report = validateOkf02AdvancedContracts(createIndex(
      "runtime: custom-engine\n",
    ));

    expect(report.support).toMatchObject({
      level: "advanced-partial",
      unsupportedComputationCount: 1,
      unsupportedRuntimes: ["custom-engine"],
    });
    expect(report.diagnostics).toContainEqual(expect.objectContaining({
      code: "okf_02_runtime_unsupported",
      severity: "warning",
    }));
  });

  it("validates source credibility windows and actors", () => {
    const index = createWorkspaceKnowledgeIndex([{
      id: "concept",
      path: "concept.md",
      markdown: [
        "---",
        "type: Reference",
        "sources:",
        "  - resource: https://example.com",
        "    author: Team Finance",
        "    usage_count: 20",
        "usage_window: { from: 2026-08-01, to: 2026-07-01 }",
        "---",
      ].join("\n"),
    }]);
    const codes = validateOkf02AdvancedContracts(index).diagnostics.map(
      (diagnostic) => diagnostic.code,
    );

    expect(codes).toContain("okf_02_source_author_invalid");
    expect(codes).toContain("okf_02_usage_window_invalid");
  });
});
