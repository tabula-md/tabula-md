import { describe, expect, it } from "vitest";
import { detectWorkspaceImportProfile } from "./workspaceImportProfile";

describe("workspace import profile", () => {
  it("separates an OKF declaration from OpenWiki producer conventions", () => {
    const profile = detectWorkspaceImportProfile({
      documents: [
        {
          id: "root",
          path: "index.md",
          markdown: "---\nokf_version: \"0.1\"\n---\n\n# Files\n\n- [Architecture](architecture/)",
        },
        {
          id: "directory",
          path: "architecture/index.md",
          markdown: "# Files\n\n- [Runtime](runtime.md)",
        },
        {
          id: "runtime",
          path: "architecture/runtime.md",
          markdown: "---\ntype: Architecture\ntitle: Runtime\n---\n\n# Runtime",
        },
        {
          id: "log",
          path: "log.md",
          markdown: "# Log\n\n## 2026-07-27\n\n- Updated runtime.",
        },
      ],
      supportFiles: [{
        path: ".last-update.json",
        text: JSON.stringify({
          updatedAt: "2026-07-27T00:00:00Z",
          command: "update",
          gitHead: "abc123",
        }),
      }],
      sourcePaths: [
        "index.md",
        "architecture/index.md",
        "architecture/runtime.md",
        "log.md",
        ".last-update.json",
        "ignored.ts",
      ],
      importedPaths: [
        "index.md",
        "architecture/index.md",
        "architecture/runtime.md",
        "log.md",
        ".last-update.json",
      ],
    });

    expect(profile).toMatchObject({
      syntaxes: ["gfm"],
      schemas: [{ id: "okf", version: "0.1" }],
      conventions: ["openwiki"],
      preservedSupportFileCount: 1,
      ignoredFileCount: 1,
    });
    expect(profile.evidence).toEqual(expect.arrayContaining([
      { code: "okf-version", value: "0.1" },
      { code: "typed-concepts", count: 1 },
      { code: "directory-indexes", count: 1 },
      { code: "activity-log" },
      { code: "openwiki-state" },
    ]));
  });

  it("recognizes Obsidian conventions without claiming an OKF standard", () => {
    const profile = detectWorkspaceImportProfile({
      documents: [
        {
          id: "home",
          path: "Home.md",
          markdown: "# Home\n\nSee [[Projects/Launch]].\n\n![[Assets/Plan]]",
        },
        {
          id: "launch",
          path: "Projects/Launch.md",
          markdown: "# Launch",
        },
      ],
      supportFiles: [],
      sourcePaths: [
        ".obsidian/app.json",
        "Home.md",
        "Projects/Launch.md",
      ],
      importedPaths: ["Home.md", "Projects/Launch.md"],
    });

    expect(profile).toMatchObject({
      syntaxes: ["gfm"],
      schemas: [],
      conventions: ["obsidian"],
      linkSyntaxes: ["wikilinks", "embeds"],
      ignoredFileCount: 1,
    });
  });

  it("keeps an unlinked document folder classified as plain Markdown", () => {
    expect(detectWorkspaceImportProfile({
      documents: [
        { id: "one", path: "One.md", markdown: "# One" },
        { id: "two", path: "Two.md", markdown: "# Two" },
      ],
      supportFiles: [],
      sourcePaths: ["One.md", "Two.md", "notes.txt"],
      importedPaths: ["One.md", "Two.md"],
    })).toMatchObject({
      syntaxes: ["gfm"],
      conventions: [],
      schemas: [],
      workflows: [],
      agentInstructions: [],
      deliveries: [],
      linkSyntaxes: [],
      preservedSupportFileCount: 0,
      ignoredFileCount: 1,
    });
  });

  it("represents mixed syntax, workflow, instruction, and delivery profiles together", () => {
    expect(detectWorkspaceImportProfile({
      documents: [
        { id: "raw", path: "raw/source.md", markdown: "# Source" },
        { id: "wiki", path: "wiki/guide.mdx", markdown: "# Guide" },
        { id: "agents", path: "AGENTS.md", markdown: "# Instructions" },
        { id: "skill", path: ".agents/skills/review/SKILL.md", markdown: "# Skill" },
      ],
      supportFiles: [{ path: "llms.txt", text: "# Docs" }],
      sourcePaths: [
        "raw/source.md",
        "wiki/guide.mdx",
        "AGENTS.md",
        ".agents/skills/review/SKILL.md",
        "llms.txt",
      ],
      importedPaths: [
        "raw/source.md",
        "wiki/guide.mdx",
        "AGENTS.md",
        ".agents/skills/review/SKILL.md",
        "llms.txt",
      ],
    })).toMatchObject({
      syntaxes: ["gfm", "mdx"],
      workflows: ["llm-wiki"],
      agentInstructions: ["agents-md", "agent-skills"],
      deliveries: ["llms-txt"],
    });
  });
});
