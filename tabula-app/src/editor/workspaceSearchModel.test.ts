import { describe, expect, it } from "vitest";
import { createWorkspaceFile } from "../workspaceStorage";
import { DEFAULT_SEARCH_OPTIONS } from "./editorSearchModel";
import { searchWorkspaceFiles } from "./workspaceSearchModel";

describe("searchWorkspaceFiles", () => {
  const files = [
    createWorkspaceFile(1, { id: "alpha", title: "Alpha.md", text: "Tabula workspace" }),
    createWorkspaceFile(2, { id: "beta", title: "Beta.md", text: "workspace workspace" }),
    createWorkspaceFile(3, { id: "other", title: "Other.md", text: "unrelated" }),
  ];

  it("groups matches by document", () => {
    const result = searchWorkspaceFiles(files, "workspace", DEFAULT_SEARCH_OPTIONS);

    expect(result.error).toBeNull();
    expect(result.matchCount).toBe(3);
    expect(result.truncated).toBe(false);
    expect(result.groups.map(({ fileId, matches }) => [fileId, matches.length])).toEqual([
      ["alpha", 1],
      ["beta", 2],
    ]);
  });

  it("returns one regular expression error for the workspace", () => {
    expect(searchWorkspaceFiles(files, "(", {
      ...DEFAULT_SEARCH_OPTIONS,
      regexp: true,
    })).toMatchObject({ error: expect.any(String), groups: [], matchCount: 0, truncated: false });
  });

  it("bounds broad queries before they can create an unbounded result tree", () => {
    const result = searchWorkspaceFiles(
      [createWorkspaceFile(4, { id: "large", title: "Large.md", text: "a ".repeat(1_000) })],
      "a",
      DEFAULT_SEARCH_OPTIONS,
    );
    expect(result.matchCount).toBe(100);
    expect(result.truncated).toBe(true);
  });
});
