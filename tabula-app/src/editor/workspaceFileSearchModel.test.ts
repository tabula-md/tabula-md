import { describe, expect, it } from "vitest";
import { DEFAULT_SEARCH_OPTIONS } from "./editorSearchModel";
import { searchWorkspaceFiles } from "./workspaceFileSearchModel";

describe("searchWorkspaceFiles", () => {
  const files = [
    {
      fileId: "alpha",
      displayPath: "Notes/Alpha",
      type: "Runbook",
      tags: ["oncall", "payments"],
      resource: "https://github.com/acme/payments",
    },
    {
      fileId: "beta",
      displayPath: "Planning/Beta",
      type: "Decision",
      tags: ["payments"],
      resource: "urn:tabula:planning",
    },
    { fileId: "other", displayPath: "Other" },
  ];

  it("matches file names and logical folder paths", () => {
    expect(searchWorkspaceFiles(files, "planning", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[1]]);
    expect(searchWorkspaceFiles(files, "alpha", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
  });

  it("does not search Markdown content", () => {
    expect(searchWorkspaceFiles(files, "workspace body", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([]);
  });

  it("searches normalized knowledge metadata", () => {
    expect(searchWorkspaceFiles(files, "runbook", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
    expect(searchWorkspaceFiles(files, "oncall", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
    expect(searchWorkspaceFiles(files, "github.com/acme", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
    expect(searchWorkspaceFiles(files, "urn:tabula", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[1]]);
  });

  it("combines type facets with all selected tag facets", () => {
    expect(searchWorkspaceFiles(files, "", DEFAULT_SEARCH_OPTIONS, {
      types: new Set(["Runbook", "Decision"]),
      tags: new Set(["payments"]),
    }).files).toEqual([files[0], files[1]]);
    expect(searchWorkspaceFiles(files, "", DEFAULT_SEARCH_OPTIONS, {
      types: new Set(["Runbook", "Decision"]),
      tags: new Set(["oncall", "payments"]),
    }).files).toEqual([files[0]]);
    expect(searchWorkspaceFiles(files, "planning", DEFAULT_SEARCH_OPTIONS, {
      types: new Set(["Runbook"]),
      tags: new Set<string>(),
    }).files).toEqual([]);
  });

  it("applies shared case and regular-expression settings", () => {
    expect(searchWorkspaceFiles(files, "notes", {
      ...DEFAULT_SEARCH_OPTIONS,
      caseSensitive: true,
    }).files).toEqual([]);
    expect(searchWorkspaceFiles(files, "^(Notes|Planning)/", {
      ...DEFAULT_SEARCH_OPTIONS,
      regexp: true,
    }).files.map((file) => file.fileId)).toEqual(["alpha", "beta"]);
  });

  it("returns a regular-expression error without partial results", () => {
    expect(searchWorkspaceFiles(files, "(", {
      ...DEFAULT_SEARCH_OPTIONS,
      regexp: true,
    })).toMatchObject({ error: expect.any(String), files: [] });
  });
});
