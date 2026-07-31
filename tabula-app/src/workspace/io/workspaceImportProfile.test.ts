import { describe, expect, it } from "vitest";
import { detectWorkspaceImportProfile } from "./workspaceImportProfile";
import { WORKSPACE_PROFILE_DETECTORS } from "./workspaceProfileDetector";

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
      syntaxes: ["commonmark"],
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
    expect(profile.detections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        profileId: "okf-0.1",
        confidence: "declared",
      }),
      expect.objectContaining({
        profileId: "openwiki",
        confidence: "strong",
      }),
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
      syntaxes: ["commonmark"],
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
      syntaxes: ["commonmark"],
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

  it("detects GFM only when GFM syntax is actually present", () => {
    const profile = detectWorkspaceImportProfile({
      documents: [{
        id: "tasks",
        path: "tasks.md",
        markdown: "# Tasks\n\n- [ ] Ship",
      }],
      supportFiles: [],
      sourcePaths: ["tasks.md"],
      importedPaths: ["tasks.md"],
    });

    expect(profile.syntaxes).toEqual(["commonmark", "gfm"]);
  });

  it("keeps wikilinks as a capability without claiming Obsidian", () => {
    const profile = detectWorkspaceImportProfile({
      documents: [{
        id: "home",
        path: "Home.md",
        markdown: "# Home\n\nSee [[Other]].",
      }],
      supportFiles: [],
      sourcePaths: ["Home.md"],
      importedPaths: ["Home.md"],
    });

    expect(profile.conventions).toEqual([]);
    expect(profile.linkSyntaxes).toEqual(["wikilinks"]);
  });

  it("preserves unknown declared OKF versions without failing detection", () => {
    const profile = detectWorkspaceImportProfile({
      documents: [{
        id: "root",
        path: "index.md",
        markdown: "---\nokf_version: \"0.3\"\n---\n\n# Files",
      }],
      supportFiles: [],
      sourcePaths: ["index.md"],
      importedPaths: ["index.md"],
    });

    expect(profile.schemas).toEqual([{ id: "okf", version: "0.3" }]);
    expect(profile.diagnostics).toEqual([]);
    expect(profile.detections).toContainEqual(expect.objectContaining({
      profileId: "okf-0.3",
      confidence: "declared",
    }));
  });

  it("represents mixed syntax, workflow, instruction, and delivery profiles together", () => {
    const profile = detectWorkspaceImportProfile({
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
    });
    expect(profile).toMatchObject({
      syntaxes: ["commonmark", "mdx"],
      workflows: ["llm-wiki"],
      agentInstructions: ["agents-md", "agent-skills"],
      deliveries: ["llms-txt"],
    });
    const workflow = profile.detections.find(
      (detection) => detection.profileId === "llm-wiki",
    );
    expect(workflow).toMatchObject({
      confidence: "heuristic",
      roleAssignments: expect.arrayContaining([
        {
          path: "raw/source.md",
          role: "source-material",
          basis: "heuristic",
        },
        {
          path: "wiki/guide.mdx",
          role: "compiled-knowledge",
          basis: "heuristic",
        },
        {
          path: "AGENTS.md",
          role: "workflow-rules",
          basis: "heuristic",
        },
      ]),
    });
    expect(workflow?.evidence).toEqual(expect.arrayContaining([
      { code: "llm-wiki-source-material", count: 1 },
      { code: "llm-wiki-compiled-knowledge", count: 1 },
      { code: "llm-wiki-health-issues", count: expect.any(Number) },
    ]));
  });

  it("isolates detector failures and keeps the remaining profile results", () => {
    const profile = detectWorkspaceImportProfile({
      documents: [
        { id: "one", path: "One.md", markdown: "# One" },
      ],
      supportFiles: [],
      sourcePaths: ["One.md"],
      importedPaths: ["One.md"],
    }, [
      WORKSPACE_PROFILE_DETECTORS[0]!,
      {
        id: "broken-test-detector",
        detect: () => {
          throw new Error("broken detector");
        },
      },
    ]);

    expect(profile.syntaxes).toEqual(["commonmark"]);
    expect(profile.diagnostics).toEqual([{
      code: "detector-failed",
      detectorId: "broken-test-detector",
    }]);
  });

  it("validates an existing llms.txt without rewriting it", () => {
    const source = [
      "## Docs",
      "",
      "- [Missing](/missing.md)",
      "- malformed",
    ].join("\n");
    const profile = detectWorkspaceImportProfile({
      documents: [{ id: "guide", path: "guide.md", markdown: "# Guide" }],
      supportFiles: [{ path: "llms.txt", text: source }],
      sourcePaths: ["guide.md", "llms.txt"],
      importedPaths: ["guide.md", "llms.txt"],
    });
    const detection = profile.detections.find(
      (candidate) => candidate.profileId === "llms-txt",
    );

    expect(detection?.evidence).toContainEqual({
      code: "llms-validation-issues",
      count: 3,
    });
    expect(profile.deliveries).toEqual(["llms-txt"]);
    expect(source).toContain("- malformed");
  });
});
