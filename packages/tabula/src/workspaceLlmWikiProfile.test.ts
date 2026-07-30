import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import { analyzeLlmWikiWorkflow } from "./workspaceLlmWikiProfile";

describe("LLM Wiki workflow profile", () => {
  it("separates heuristic roles and reports operational health signals", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "concept",
        path: "wiki/concepts/attention.md",
        markdown: [
          "---",
          "type: Synthesis",
          "stale_after: 2026-01-01",
          "---",
          "",
          "# Attention",
        ].join("\n"),
      },
      { id: "agents", path: "AGENTS.md", markdown: "# Rules" },
    ]);
    const report = analyzeLlmWikiWorkflow(index, [
      "raw/articles/paper.pdf",
      "wiki/concepts/attention.md",
      "AGENTS.md",
    ], { today: "2026-07-30" });

    expect(report).toMatchObject({
      detected: true,
      sourceMaterialCount: 1,
      compiledKnowledgeCount: 1,
      workflowRuleCount: 1,
    });
    expect(report.assignments).toEqual([
      { path: "AGENTS.md", role: "workflow-rules", basis: "heuristic" },
      { path: "raw/articles/paper.pdf", role: "source-material", basis: "heuristic" },
      { path: "wiki/concepts/attention.md", role: "compiled-knowledge", basis: "heuristic" },
    ]);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "raw_source_unreferenced",
      "compiled_provenance_missing",
      "compiled_synthesis_stale",
      "wiki_concept_orphan",
      "llm_wiki_index_missing",
      "llm_wiki_log_missing",
    ]));
  });

  it("keeps explicit role rules distinct from folder-name heuristics", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "compiled", path: "dist/guide.md", markdown: "---\ntype: Guide\n---\n" },
    ]);
    const report = analyzeLlmWikiWorkflow(index, [
      "evidence/paper.pdf",
      "dist/guide.md",
      "policy/agent.md",
    ], {
      rules: [
        { role: "source-material", pathPrefixes: ["evidence"] },
        { role: "compiled-knowledge", pathPrefixes: ["dist"] },
        { role: "workflow-rules", pathPrefixes: ["policy"] },
      ],
    });

    expect(report.detected).toBe(true);
    expect(report.assignments.every((assignment) => assignment.basis === "explicit"))
      .toBe(true);
  });

  it("does not classify a single raw folder as an LLM Wiki", () => {
    const report = analyzeLlmWikiWorkflow(
      createWorkspaceKnowledgeIndex([]),
      ["raw/paper.pdf"],
    );

    expect(report).toMatchObject({
      detected: false,
      sourceMaterialCount: 1,
      compiledKnowledgeCount: 0,
    });
  });
});
