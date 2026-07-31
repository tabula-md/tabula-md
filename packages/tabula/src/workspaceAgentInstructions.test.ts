import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import {
  analyzeWorkspaceAgentInstructions,
  getAgentInstructionChanges,
} from "./workspaceAgentInstructions";

describe("workspace agent instructions", () => {
  it("computes directory scopes and surfaces conflict candidates", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "root", path: "AGENTS.md", markdown: "- Use generated indexes." },
      {
        id: "nested",
        path: "wiki/AGENTS.md",
        markdown: "- Do not generated indexes.",
      },
      { id: "doc", path: "wiki/guide.md", markdown: "# Guide" },
      { id: "other", path: "notes.md", markdown: "# Notes" },
    ]);
    const report = analyzeWorkspaceAgentInstructions(index, [
      "AGENTS.md",
      "wiki/AGENTS.md",
      "wiki/guide.md",
      "notes.md",
    ]);

    expect(report.applications.find((item) => item.documentId === "doc")
      ?.instructions.map((instruction) => instruction.path)).toEqual([
        "AGENTS.md",
        "wiki/AGENTS.md",
      ]);
    expect(report.applications.find((item) => item.documentId === "other")
      ?.instructions.map((instruction) => instruction.path)).toEqual([
        "AGENTS.md",
      ]);
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: "agents_scope_conflict_candidate",
      documentId: "doc",
    }));
  });

  it("validates Skills without making scripts executable", () => {
    const index = createWorkspaceKnowledgeIndex([{
      id: "skill",
      path: ".agents/skills/review/SKILL.md",
      markdown: [
        "---",
        "name: review",
        "description: Review a document",
        "---",
        "",
        "[Guide](references/guide.md)",
        "[Script](scripts/check.py)",
        "[Missing](assets/missing.txt)",
      ].join("\n"),
    }]);
    const report = analyzeWorkspaceAgentInstructions(index, [
      ".agents/skills/review/SKILL.md",
      ".agents/skills/review/references/guide.md",
      ".agents/skills/review/scripts/check.py",
    ]);

    expect(report.skills[0]).toMatchObject({
      name: "review",
      trust: "unreviewed",
      hasReferencesDirectory: true,
      hasScriptsDirectory: true,
      hasAssetsDirectory: false,
      scriptsExecutable: false,
    });
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: "skill_reference_missing",
      value: ".agents/skills/review/assets/missing.txt",
    }));
  });

  it("marks every instruction change as critical", () => {
    const previous = createWorkspaceKnowledgeIndex([
      { id: "agents", path: "AGENTS.md", markdown: "Before" },
    ]);
    const current = createWorkspaceKnowledgeIndex([
      { id: "agents", path: "AGENTS.md", markdown: "After" },
      { id: "claude", path: "CLAUDE.md", markdown: "Vendor steering" },
    ]);

    expect(getAgentInstructionChanges(previous, current)).toEqual([
      { path: "AGENTS.md", kind: "modified", importance: "critical" },
      { path: "CLAUDE.md", kind: "added", importance: "critical" },
    ]);
  });
});
