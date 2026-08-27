import { createWorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import { describe, expect, it } from "vitest";
import type { WorkspaceSearchIndexEntry } from "./workspaceSearchIndex";
import { createWorkspaceFile } from "./workspaceStorage";
import {
  buildWorkspaceKnowledgeBrowseModel,
  getWorkspaceKnowledgeConceptDocuments,
  getWorkspaceKnowledgeDocumentReason,
  getWorkspaceKnowledgeReviewDocuments,
  sanitizeWorkspaceKnowledgeFilters,
} from "./workspaceKnowledgeBrowseModel";

const entry = (
  id: string,
  metadata: Record<string, unknown>,
): WorkspaceSearchIndexEntry => ({
  body: "",
  displayPath: `${id}.md`,
  file: createWorkspaceFile(1, { id, parentId: "root", title: `${id}.md`, text: "" }),
  fileId: id,
  iconKind: "markdown",
  markdown: "",
  metadata,
  description: typeof metadata.description === "string" ? metadata.description : undefined,
  title: id,
  type: typeof metadata.type === "string" ? metadata.type : undefined,
  tags: Array.isArray(metadata.tags) ? metadata.tags as string[] : undefined,
});

const noFilters = { fields: {} } as const;

describe("workspace knowledge browse model", () => {
  const entries = [
    entry("runbook-a", {
      type: "Runbook",
      description: "Response procedure whose scheduled review date has passed and needs attention.",
      resource: "https://wiki.example.com/runbooks/payment-incident",
      tags: ["payments", "operations"],
      status: "stable",
      generated: { by: "human:taeha", at: "2026-01-01" },
    }),
    entry("runbook-b", {
      type: "Runbook",
      description: "Current payment response procedure for the on-call team.",
      tags: ["payments"],
      status: "draft",
    }),
    entry("decision", { type: "Decision", tags: ["architecture"], owner: "platform" }),
    entry("notes", { title: "Plain notes" }),
  ];

  it("keeps every metadata field while marking compact reusable fields as suggested", () => {
    const model = buildWorkspaceKnowledgeBrowseModel(entries);
    expect(model.conceptDocumentIds).toEqual(["runbook-a", "runbook-b", "decision", "notes"]);
    expect(model.fields.map(({ key }) => key)).toEqual([
      "description",
      "generated.at",
      "generated.by",
      "owner",
      "resource",
      "status",
      "tags",
      "title",
      "type",
    ]);
    expect(model.fields.filter(({ suggested }) => suggested).map(({ key }) => key)).toEqual([
      "status",
      "tags",
      "type",
    ]);
    expect(Object.fromEntries(model.fields.map(({ key, kind }) => [key, kind]))).toEqual({
      description: "text",
      "generated.at": "date",
      "generated.by": "text",
      owner: "text",
      resource: "text",
      status: "select",
      tags: "select",
      title: "text",
      type: "select",
    });
    expect(Object.fromEntries(model.metadataFields.map(({ key, role }) => [key, role]))).toEqual({
      description: "search",
      "generated.at": "lifecycle",
      "generated.by": "lifecycle",
      owner: "search",
      resource: "relation",
      status: "filter",
      tags: "filter",
      title: "search",
      type: "filter",
    });
    expect(model.fields.find(({ key }) => key === "status")?.values).toEqual([
      { key: "string:draft", label: "draft", count: 1 },
      { key: "string:stable", label: "stable", count: 1 },
      { key: "empty", label: "", count: 2 },
    ]);
    expect(model.reviewReady).toBe(false);
  });

  it("searches arbitrary metadata and combines select fields with AND semantics", () => {
    const model = buildWorkspaceKnowledgeBrowseModel(entries);
    expect(getWorkspaceKnowledgeConceptDocuments(entries, model, "payments", noFilters)
      .map(({ fileId }) => fileId)).toEqual(["runbook-a", "runbook-b"]);
    expect(getWorkspaceKnowledgeConceptDocuments(entries, model, "platform", noFilters)
      .map(({ fileId }) => fileId)).toEqual(["decision"]);
    expect(getWorkspaceKnowledgeConceptDocuments(entries, model, "", {
      fields: {
        type: { kind: "select", values: ["string:Decision"] },
        tags: { kind: "select", values: ["string:architecture"] },
      },
    }).map(({ fileId }) => fileId)).toEqual(["decision"]);
    expect(getWorkspaceKnowledgeConceptDocuments(entries, model, "", {
      fields: { status: { kind: "select", values: ["empty"] } },
    }).map(({ fileId }) => fileId)).toEqual(["decision", "notes"]);
  });

  it("exposes lifecycle and custom leaves with their inferred input types", () => {
    const nestedEntries = [
      entry("generated", {
        generated: { by: "agent:test", at: "2026-01-01" },
        verified: [{ by: "human:taeha", valid: true }, { by: "process:check", valid: false }],
        score: 3,
      }),
      entry("plain", { title: "Plain" }),
    ];
    const model = buildWorkspaceKnowledgeBrowseModel(nestedEntries);
    expect(Object.fromEntries(model.fields.map(({ key, kind }) => [key, kind]))).toEqual({
      "generated.at": "date",
      "generated.by": "text",
      score: "number",
      title: "text",
      "verified.by": "select",
      "verified.valid": "boolean",
    });
    expect(Object.fromEntries(model.metadataFields.map(({ key, role }) => [key, role]))).toEqual({
      "generated.at": "lifecycle",
      "generated.by": "lifecycle",
      score: "search",
      title: "search",
      "verified.by": "lifecycle",
      "verified.valid": "lifecycle",
    });
    expect(getWorkspaceKnowledgeConceptDocuments(nestedEntries, model, "agent:test", noFilters)
      .map(({ fileId }) => fileId)).toEqual(["generated"]);
  });

  it("infers compact reusable values as filters without requiring OKF field names", () => {
    const dynamicEntries = [
      entry("first", { priority: "high", aliases: ["alpha", "primary"], archived: true }),
      entry("second", { priority: "low", aliases: ["beta"], archived: false }),
    ];
    const model = buildWorkspaceKnowledgeBrowseModel(dynamicEntries);
    expect(model.fields.filter(({ suggested }) => suggested).map(({ key }) => key)).toEqual([
      "aliases",
      "archived",
      "priority",
    ]);
    expect(Object.fromEntries(model.fields.map(({ key, kind }) => [key, kind]))).toEqual({
      aliases: "select",
      archived: "boolean",
      priority: "select",
    });
  });

  it("filters text, dates, numbers, booleans, and empty fields with typed conditions", () => {
    const typedEntries = [
      entry("first", {
        description: "Payment incident response",
        generated: { at: "2026-01-10" },
        score: 8,
        archived: false,
      }),
      entry("second", {
        description: "Architecture decision",
        generated: { at: "2025-12-01" },
        score: 3,
        archived: true,
      }),
      entry("third", { title: "Missing values" }),
    ];
    const model = buildWorkspaceKnowledgeBrowseModel(typedEntries);
    expect(getWorkspaceKnowledgeConceptDocuments(typedEntries, model, "", {
      fields: { description: { kind: "text", operator: "contains", value: "incident" } },
    }).map(({ fileId }) => fileId)).toEqual(["first"]);
    expect(getWorkspaceKnowledgeConceptDocuments(typedEntries, model, "", {
      fields: { "generated.at": { kind: "date", operator: "before", value: "2026-01-01" } },
    }).map(({ fileId }) => fileId)).toEqual(["second"]);
    expect(getWorkspaceKnowledgeConceptDocuments(typedEntries, model, "", {
      fields: { score: { kind: "number", operator: "gte", value: "5" } },
    }).map(({ fileId }) => fileId)).toEqual(["first"]);
    expect(getWorkspaceKnowledgeConceptDocuments(typedEntries, model, "", {
      fields: { archived: { kind: "boolean", operator: "equals", value: false } },
    }).map(({ fileId }) => fileId)).toEqual(["first"]);
    expect(getWorkspaceKnowledgeConceptDocuments(typedEntries, model, "", {
      fields: { description: { kind: "text", operator: "empty", value: "" } },
    }).map(({ fileId }) => fileId)).toEqual(["third"]);
    expect(sanitizeWorkspaceKnowledgeFilters({
      fields: { "generated.at": { kind: "date", operator: "before", value: "2026-01-01" } },
    }, model)).toEqual({ fields: {} });
    expect(sanitizeWorkspaceKnowledgeFilters({
      fields: { "generated.at": { kind: "date", operator: "on", value: "2026-01-10" } },
    }, model)).toEqual({
      fields: { "generated.at": { kind: "date", operator: "on", value: "2026-01-10" } },
    });
  });

  it("keeps missing values distinct from literal labels that look empty", () => {
    const collisionEntries = [
      entry("literal-empty", { status: "Empty" }),
      entry("literal-no-value", { status: "No value" }),
      entry("missing-status", { title: "Missing status" }),
    ];
    const model = buildWorkspaceKnowledgeBrowseModel(collisionEntries);
    expect(model.fields.find(({ key }) => key === "status")?.values).toEqual([
      { key: "string:Empty", label: "Empty", count: 1 },
      { key: "string:No value", label: "No value", count: 1 },
      { key: "empty", label: "", count: 1 },
    ]);
    expect(getWorkspaceKnowledgeConceptDocuments(collisionEntries, model, "", {
      fields: { status: { kind: "select", values: ["string:Empty"] } },
    }).map(({ fileId }) => fileId)).toEqual(["literal-empty"]);
    expect(getWorkspaceKnowledgeConceptDocuments(collisionEntries, model, "", {
      fields: { status: { kind: "select", values: ["string:No value"] } },
    }).map(({ fileId }) => fileId)).toEqual(["literal-no-value"]);
    expect(getWorkspaceKnowledgeConceptDocuments(collisionEntries, model, "", {
      fields: { status: { kind: "select", values: ["empty"] } },
    }).map(({ fileId }) => fileId)).toEqual(["missing-status"]);
  });

  it("keeps default rows quiet and explains only active searches or filters", () => {
    const model = buildWorkspaceKnowledgeBrowseModel(entries);
    expect(getWorkspaceKnowledgeDocumentReason(entries[0], model, "", noFilters)).toBeUndefined();
    expect(getWorkspaceKnowledgeDocumentReason(entries[0], model, "scheduled review", noFilters))
      .toContain("Response procedure");
    expect(getWorkspaceKnowledgeDocumentReason(entries[0], model, "", {
      fields: { tags: { kind: "select", values: ["string:operations"] } },
    })).toBe("operations");
  });

  it("derives actionable review rows from the shared index", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "runbook-a",
        path: "runbook-a.md",
        markdown: "---\ntype: Runbook\nstale_after: 2000-01-01\n---\n[[decision]]",
      },
      {
        id: "decision",
        path: "decision.md",
        markdown: "---\ntype: Decision\ngenerated:\n  by: agent:test\n  at: 2026-01-01T00:00:00Z\n---\n",
      },
    ]);
    const model = buildWorkspaceKnowledgeBrowseModel(entries, index);
    const review = getWorkspaceKnowledgeReviewDocuments(entries, model, "", noFilters);

    expect(review).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entry: expect.objectContaining({ fileId: "runbook-a" }),
        review: expect.objectContaining({
          kinds: expect.arrayContaining(["freshness"]),
          primaryKind: "freshness",
        }),
      }),
      expect.objectContaining({
        entry: expect.objectContaining({ fileId: "decision" }),
        review: expect.objectContaining({
          kinds: expect.arrayContaining(["trust"]),
          primaryKind: "trust",
        }),
      }),
    ]));
    expect(model.reviewReady).toBe(true);
  });

  it("includes untyped metadata documents but not binary assets", () => {
    const binary = { ...entry("diagram", { type: "Image" }), iconKind: "image" as const };
    const plainMarkdown = entry("plain-empty", {});
    const hiddenMetadata = {
      ...entry("skill", { name: "Internal skill" }),
      displayPath: ".agents/skills/internal/SKILL.md",
    };
    const model = buildWorkspaceKnowledgeBrowseModel([
      ...entries,
      binary,
      plainMarkdown,
      hiddenMetadata,
    ]);
    expect(model.conceptDocumentIds).toEqual(["runbook-a", "runbook-b", "decision", "notes"]);
  });
});
