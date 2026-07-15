import { describe, expect, it } from "vitest";
import { DEFAULT_SEARCH_OPTIONS } from "./editorSearchModel";
import { searchWorkspaceFileNames } from "./workspaceFileSearchModel";

describe("searchWorkspaceFileNames", () => {
  const files = [
    { fileId: "alpha", displayPath: "Notes/Alpha" },
    { fileId: "beta", displayPath: "Planning/Beta" },
    { fileId: "other", displayPath: "Other" },
  ];

  it("matches file names and logical folder paths", () => {
    expect(searchWorkspaceFileNames(files, "planning", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([{ fileId: "beta", displayPath: "Planning/Beta" }]);
    expect(searchWorkspaceFileNames(files, "alpha", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([{ fileId: "alpha", displayPath: "Notes/Alpha" }]);
  });

  it("does not search Markdown content", () => {
    expect(searchWorkspaceFileNames(files, "workspace body", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([]);
  });

  it("applies shared case and regular-expression settings", () => {
    expect(searchWorkspaceFileNames(files, "notes", {
      ...DEFAULT_SEARCH_OPTIONS,
      caseSensitive: true,
    }).files).toEqual([]);
    expect(searchWorkspaceFileNames(files, "^(Notes|Planning)/", {
      ...DEFAULT_SEARCH_OPTIONS,
      regexp: true,
    }).files.map((file) => file.fileId)).toEqual(["alpha", "beta"]);
  });

  it("returns a regular-expression error without partial results", () => {
    expect(searchWorkspaceFileNames(files, "(", {
      ...DEFAULT_SEARCH_OPTIONS,
      regexp: true,
    })).toMatchObject({ error: expect.any(String), files: [] });
  });
});
