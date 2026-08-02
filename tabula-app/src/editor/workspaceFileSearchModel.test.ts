import { describe, expect, it } from "vitest";
import { DEFAULT_SEARCH_OPTIONS } from "./editorSearchModel";
import {
  getMetadataFacets,
  searchWorkspaceFiles,
} from "./workspaceFileSearchModel";

describe("searchWorkspaceFiles", () => {
  const files = [
    {
      fileId: "alpha",
      displayPath: "Notes/Alpha",
      title: "Checkout operations",
      description: "How responders mitigate failed payments",
      type: "Runbook",
      tags: ["oncall", "payments"],
      resource: "https://github.com/acme/payments",
      sourceValues: ["policy", "Finance policy", "team:finance"],
      generatedBy: "agent:research",
      verifiedBy: ["human:taeha"],
      status: "stable" as const,
      trustTier: "human-reviewed" as const,
      freshness: "current" as const,
      markdown: "# Operations\n\nRestart the settlement worker.",
    },
    {
      fileId: "beta",
      displayPath: "Planning/Beta",
      title: "Payment retry decision",
      type: "Decision",
      tags: ["payments"],
      resource: "urn:tabula:planning",
      status: "draft" as const,
      trustTier: "unverified" as const,
      freshness: "stale" as const,
      markdown: "# Decision\n\nUse exponential backoff.",
    },
    { fileId: "other", displayPath: "Other" },
  ];

  it("matches file names and logical folder paths", () => {
    expect(searchWorkspaceFiles(files, "planning", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[1]]);
    expect(searchWorkspaceFiles(files, "alpha", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
  });

  it("searches concept titles, descriptions, and Markdown content", () => {
    expect(searchWorkspaceFiles(files, "checkout operations", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
    expect(searchWorkspaceFiles(files, "mitigate failed", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
    expect(searchWorkspaceFiles(files, "settlement worker", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
    expect(searchWorkspaceFiles(files, "exponential backoff", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[1]]);
  });

  it("ranks titles before paths, metadata, and body matches and exposes context", () => {
    const result = searchWorkspaceFiles([
      { fileId: "body", displayPath: "Guides/Other", markdown: "Alpha launch plan" },
      { fileId: "path", displayPath: "Alpha/Reference" },
      { fileId: "title", displayPath: "Notes/Record", title: "Alpha" },
    ], "alpha", DEFAULT_SEARCH_OPTIONS);

    expect(result.files.map((file) => file.fileId)).toEqual(["title", "path", "body"]);
    expect(result.matches.map(({ field, snippet }) => ({ field, snippet }))).toEqual([
      { field: "title", snippet: "Alpha" },
      { field: "path", snippet: "Alpha/Reference" },
      { field: "body", snippet: "Alpha launch plan" },
    ]);
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
    expect(searchWorkspaceFiles(files, "Finance policy", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
    expect(searchWorkspaceFiles(files, "human:taeha", DEFAULT_SEARCH_OPTIONS).files)
      .toEqual([files[0]]);
  });

  it("filters lifecycle, trust, and freshness metadata", () => {
    expect(searchWorkspaceFiles(files, "", DEFAULT_SEARCH_OPTIONS, {
      types: new Set(),
      tags: new Set(),
      statuses: new Set(["stable"]),
      trustTiers: new Set(["human-reviewed"]),
      freshness: new Set(["current"]),
    }).files).toEqual([files[0]]);
    expect(searchWorkspaceFiles(files, "", DEFAULT_SEARCH_OPTIONS, {
      types: new Set(),
      tags: new Set(),
      statuses: new Set(["draft"]),
      trustTiers: new Set(["unverified"]),
      freshness: new Set(["stale"]),
    }).files).toEqual([files[1]]);
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

  it("builds reusable metadata facet counts", () => {
    expect(getMetadataFacets(files, (entry) => entry.tags)).toEqual([
      { value: "oncall", count: 1 },
      { value: "payments", count: 2 },
    ]);
    expect(getMetadataFacets(files, (entry) => [
      ...(entry.tags ?? []),
      ...(entry.tags ?? []),
    ])).toEqual([
      { value: "oncall", count: 1 },
      { value: "payments", count: 2 },
    ]);
  });
});
