import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import { getAmbiguousWorkspaceLinkResolutionEdit } from "./workspaceLinkResolution";

describe("workspace link resolution", () => {
  it("rewrites only an ambiguous wiki target while preserving its alias and relation", () => {
    const markdown = "# Start\n\nBefore ![[ Shared |Team page ]] after.";
    const index = createWorkspaceKnowledgeIndex([
      { id: "start", path: "Start.md", markdown },
      { id: "shared-a", path: "wiki/team-a/Shared.md", markdown: "# Shared A" },
      { id: "shared-b", path: "wiki/team-b/Shared.md", markdown: "# Shared B" },
    ]);
    const link = index.ambiguousLinks[0];
    const edit = link
      ? getAmbiguousWorkspaceLinkResolutionEdit(
          markdown,
          link,
          "wiki/team-a/Shared.md",
        )
      : null;

    expect(edit).not.toBeNull();
    expect(
      edit
        ? `${markdown.slice(0, edit.patch.from)}${edit.patch.insert}${markdown.slice(edit.patch.to)}`
        : markdown,
    ).toBe("# Start\n\nBefore ![[ /wiki/team-a/Shared |Team page ]] after.");
  });

  it("preserves a fragment and declines non-ambiguous or non-wiki links", () => {
    const markdown = "[[Shared#Decision]]";
    const index = createWorkspaceKnowledgeIndex([
      { id: "start", path: "Start.md", markdown },
      {
        id: "shared-a",
        path: "team-a/Shared.md",
        markdown: "# A\n\n## Decision",
      },
      {
        id: "shared-b",
        path: "team-b/Shared.md",
        markdown: "# B\n\n## Decision",
      },
    ]);
    const link = index.ambiguousLinks[0];
    const edit = link
      ? getAmbiguousWorkspaceLinkResolutionEdit(markdown, link, "team-b/Shared.md")
      : null;

    expect(edit?.patch.insert).toBe("/team-b/Shared#Decision");
    expect(
      link
        ? getAmbiguousWorkspaceLinkResolutionEdit(
            markdown,
            { ...link, status: "broken" },
            "team-b/Shared.md",
          )
        : null,
    ).toBeNull();
  });
});
