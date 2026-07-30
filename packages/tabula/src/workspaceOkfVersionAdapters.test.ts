import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import {
  createWorkspaceOkfInspection,
  detectWorkspaceOkfVersion,
  getOkfVersionAdapter,
} from "./workspaceOkfVersionAdapters";

const inspect = (documents: Parameters<typeof createWorkspaceKnowledgeIndex>[0]) =>
  createWorkspaceOkfInspection(createWorkspaceKnowledgeIndex(documents));

describe("OKF version adapters", () => {
  it("uses the 0.1 contract for legacy timestamp and Citations conventions", () => {
    const bundle = inspect([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.1\"\n---\n\n# Catalog",
      },
      {
        id: "legacy",
        path: "legacy.md",
        markdown: [
          "---",
          "type: Reference",
          "timestamp: yesterday",
          "custom_field: preserved",
          "---",
          "",
          "# Citations",
          "",
          "[Source](https://example.com)",
        ].join("\n"),
      },
    ]);

    expect(detectWorkspaceOkfVersion(bundle)).toEqual({
      kind: "declared",
      declaredVersion: "0.1",
      version: "0.1",
    });
    const report = getOkfVersionAdapter("0.1")?.validate(bundle);
    expect(report?.diagnostics).toEqual([
      expect.objectContaining({
        code: "okf_01_timestamp_invalid",
        documentId: "legacy",
      }),
    ]);
    expect(report?.concepts[0]).toMatchObject({
      hasCitationsSection: true,
      unknownMetadataKeys: ["custom_field"],
    });
  });

  it("validates present 0.2 provenance fields without requiring optional families", () => {
    const bundle = inspect([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"0.2\"\n---\n\n# Catalog",
      },
      {
        id: "minimal",
        path: "minimal.md",
        markdown: "---\ntype: Note\n---\n\n# Minimal",
      },
      {
        id: "invalid",
        path: "invalid.md",
        markdown: [
          "---",
          "type: Note",
          "generated: { by: agent-without-version, at: yesterday }",
          "verified: []",
          "status: published",
          "stale_after: 2026-02-30",
          "sources:",
          "  - id: source-a",
          "    usage_count: -1",
          "---",
          "",
          "Claim.[^source-a]",
          "",
          "[^source-a]: Source A",
        ].join("\n"),
      },
    ]);

    const report = getOkfVersionAdapter("0.2")?.validate(bundle);
    expect(report?.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "okf_02_generated_invalid",
      "okf_02_actor_invalid",
      "okf_02_verified_invalid",
      "okf_02_sources_invalid",
      "okf_02_status_invalid",
      "okf_02_stale_after_invalid",
    ]);
    expect(report?.concepts.find((concept) => concept.documentId === "minimal"))
      .toMatchObject({ unknownMetadataKeys: [] });
    expect(report?.concepts.find((concept) => concept.documentId === "invalid")
      ?.sourceFootnoteLinks).toEqual([
        {
          sourceId: "source-a",
          referenceCount: 1,
          definitionPresent: true,
        },
      ]);
  });

  it("marks undeclared typed Markdown as OKF-like and preserves future versions", () => {
    expect(detectWorkspaceOkfVersion(inspect([
      {
        id: "concept",
        path: "concept.md",
        markdown: "---\ntype: Note\nunknown: keep\n---\n\n# Concept",
      },
    ]))).toEqual({ kind: "okf-like" });

    expect(detectWorkspaceOkfVersion(inspect([
      {
        id: "index",
        path: "index.md",
        markdown: "---\nokf_version: \"9.0\"\nfuture_key: keep\n---\n\n# Future",
      },
    ]))).toEqual({ kind: "future", declaredVersion: "9.0" });
  });
});
