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
      supportFiles: [
        {
          path: ".last-update.json",
          text: JSON.stringify({
            updatedAt: "2026-07-27T00:00:00Z",
            command: "update",
            gitHead: "abc123",
          }),
        },
        { path: "ignored.ts", text: "export {};" },
      ],
      sourcePaths: [
        "index.md",
        "architecture/index.md",
        "architecture/runtime.md",
        "log.md",
        ".last-update.json",
        "ignored.ts",
      ],
    });

    expect(profile).toMatchObject({
      format: "okf",
      okfVersion: "0.1",
      conventions: ["openwiki"],
      markdownFileCount: 4,
      preservedSupportPaths: [".last-update.json", "ignored.ts"],
      preservedSupportFileCount: 2,
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
      supportFiles: [{
        path: ".obsidian/app.json",
        text: "{}",
      }],
      sourcePaths: [
        ".obsidian/app.json",
        "Home.md",
        "Projects/Launch.md",
      ],
    });

    expect(profile).toMatchObject({
      format: "markdown-wiki",
      conventions: ["obsidian"],
      linkSyntaxes: ["wikilinks", "embeds"],
      markdownFileCount: 2,
      preservedSupportPaths: [".obsidian/app.json"],
      preservedSupportFileCount: 1,
    });
    expect(profile.okfVersion).toBeUndefined();
  });

  it("keeps an unlinked document folder classified as plain Markdown", () => {
    expect(detectWorkspaceImportProfile({
      documents: [
        { id: "one", path: "One.md", markdown: "# One" },
        { id: "two", path: "Two.md", markdown: "# Two" },
      ],
      supportFiles: [{ path: "notes.txt", text: "notes" }],
      sourcePaths: ["One.md", "Two.md", "notes.txt"],
    })).toMatchObject({
      format: "plain-markdown",
      conventions: [],
      linkSyntaxes: [],
      markdownFileCount: 2,
      preservedSupportPaths: ["notes.txt"],
      preservedSupportFileCount: 1,
    });
  });
});
