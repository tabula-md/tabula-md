import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import {
  exportWorkspaceJsonLd,
  exportWorkspaceSkosConceptScheme,
  previewJsonLdImport,
} from "./knowledgeInterchange";

const createIndex = () => createWorkspaceKnowledgeIndex([
  {
    id: "guide",
    path: "docs/guide.md",
    markdown: [
      "---",
      "type: Guide",
      "description: Start here",
      "resource: https://example.com/concepts/guide",
      "tags: [onboarding, public]",
      "custom_field: preserved only in Markdown",
      "---",
      "",
      "# Guide",
      "",
      "Read the [policy](policy.md) and [missing](missing.md).",
    ].join("\n"),
  },
  {
    id: "policy",
    path: "docs/policy.md",
    markdown: "---\ntype: Policy\n---\n\n# Policy",
  },
]);

describe("JSON-LD and SKOS interchange adapters", () => {
  it("exports OKF metadata, canonical resources, tags, and Markdown graph edges", () => {
    const index = createIndex();
    const sourceBefore = index.documentsById.get("guide")?.markdown;
    const result = exportWorkspaceJsonLd(index, {
      baseIri: "https://example.com/workspace/",
    });
    const graph = result.document["@graph"] as Record<string, unknown>[];
    const guide = graph.find((node) =>
      node["@id"] === "https://example.com/concepts/guide"
    );

    expect(guide).toMatchObject({
      "@type": "skos:Concept",
      "skos:prefLabel": "Guide",
      "skos:definition": "Start here",
      "tabula:knowledgeType": "Guide",
      "schema:keywords": ["onboarding", "public"],
      "tabula:linksTo": [{
        "@id": "https://example.com/workspace/docs/policy.md",
      }],
    });
    expect(result).toMatchObject({
      format: "json-ld",
      roundTrip: "partial",
      workspaceSourceChanged: false,
      rdfStoreRequired: false,
    });
    expect(result.losses).toContainEqual(expect.objectContaining({
      code: "broken_link_not_exported",
      documentId: "guide",
    }));
    expect(result.losses).toContainEqual(expect.objectContaining({
      code: "frontmatter_field_not_mapped",
      property: "custom_field",
    }));
    expect(result.losses).toContainEqual(expect.objectContaining({
      code: "markdown_body_not_exported",
      documentId: "guide",
    }));
    expect(index.documentsById.get("guide")?.markdown).toBe(sourceBefore);
  });

  it("exports a SKOS concept scheme without creating a required RDF store", () => {
    const result = exportWorkspaceSkosConceptScheme(createIndex(), {
      baseIri: "https://example.com/workspace/",
      schemeIri: "https://example.com/schemes/team",
      schemeTitle: "Team knowledge",
    });
    const graph = result.document["@graph"] as Record<string, unknown>[];

    expect(graph[0]).toMatchObject({
      "@id": "https://example.com/schemes/team",
      "@type": "skos:ConceptScheme",
      "skos:prefLabel": "Team knowledge",
    });
    expect(graph.find((node) => node["@type"] === "skos:Concept"))
      .toMatchObject({
        "skos:inScheme": { "@id": "https://example.com/schemes/team" },
      });
    expect(result.rdfStoreRequired).toBe(false);
  });

  it("previews JSON-LD mappings and losses without writing Markdown", () => {
    const preview = previewJsonLdImport({
      "@context": {
        skos: "http://www.w3.org/2004/02/skos/core#",
        tabula: "https://tabula.md/ns/knowledge#",
        label: "skos:prefLabel",
      },
      "@graph": [{
        "@id": "https://example.com/concepts/runbook",
        "@type": "skos:Concept",
        label: "Incident runbook",
        "skos:definition": "Respond safely.",
        "tabula:path": "operations/runbook.md",
        "tabula:knowledgeType": "Runbook",
        "skos:broader": { "@id": "https://example.com/concepts/operations" },
      }],
    });

    expect(preview).toMatchObject({
      valid: true,
      requiresReview: true,
      workspaceSourceChanged: false,
      rdfStoreCreated: false,
      candidates: [{
        sourceNodeId: "https://example.com/concepts/runbook",
        proposedPath: "operations/runbook.md",
        title: "Incident runbook",
        description: "Respond safely.",
        resource: "https://example.com/concepts/runbook",
        type: "Runbook",
        sources: [],
        roundTrip: "partial",
      }],
    });
    expect(preview.losses).toContainEqual(expect.objectContaining({
      code: "property_not_mapped",
      property: "skos:broader",
    }));
  });

  it("does not fetch remote contexts and rejects malformed JSON", () => {
    const remoteContext = previewJsonLdImport({
      "@context": "https://example.com/context.jsonld",
      "@id": "https://example.com/concept",
      "skos:prefLabel": "Concept",
    });
    expect(remoteContext.losses).toContainEqual(expect.objectContaining({
      code: "context_not_fetched",
    }));

    const malformed = previewJsonLdImport("{");
    expect(malformed).toMatchObject({
      valid: false,
      candidates: [],
      workspaceSourceChanged: false,
    });
    expect(malformed.losses).toEqual([{ code: "json_invalid" }]);
  });
});
