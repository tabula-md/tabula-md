import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import {
  getRightPanelGraphLayout,
  getRightPanelGraphModel,
} from "./rightPanelGraphModel";

describe("right panel graph model", () => {
  it("builds the full workspace graph while marking the active neighborhood", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "start", path: "Start.md", markdown: "[[Guide]]\n[[Guide]]" },
      { id: "guide", path: "Guide.md", markdown: "[[Details]]" },
      { id: "details", path: "Details.md", markdown: "# Details" },
      { id: "incoming", path: "Incoming.md", markdown: "[[Start]]" },
      { id: "third-hop", path: "Third.md", markdown: "[[Details]]" },
      { id: "broken", path: "Broken.md", markdown: "[[Missing]]" },
    ]);

    const model = getRightPanelGraphModel(index, "start");
    expect(model.nodes.map(({ documentId, depth }) => [documentId, depth])).toEqual([
      ["broken", 2],
      ["details", 2],
      ["guide", 1],
      ["incoming", 1],
      ["start", 0],
      ["third-hop", 2],
    ]);
    expect(model.edges).toEqual([
      { sourceDocumentId: "guide", targetDocumentId: "details", linkCount: 1, kind: "relationship" },
      { sourceDocumentId: "incoming", targetDocumentId: "start", linkCount: 1, kind: "relationship" },
      { sourceDocumentId: "start", targetDocumentId: "guide", linkCount: 2, kind: "relationship" },
      { sourceDocumentId: "third-hop", targetDocumentId: "details", linkCount: 1, kind: "relationship" },
    ]);
    expect(model.totalNodeCount).toBe(6);
    expect(model.totalLinkCount).toBe(5);
    expect(model.hasConnections).toBe(true);
    expect(model.isTruncated).toBe(false);
  });

  it("builds a one-hop local map around the active document", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "start", path: "Start.md", markdown: "[[Guide]]" },
      { id: "guide", path: "Guide.md", markdown: "[[Details]]" },
      { id: "details", path: "Details.md", markdown: "# Details" },
      { id: "incoming", path: "Incoming.md", markdown: "[[Start]]" },
      { id: "orphan", path: "Orphan.md", markdown: "# Orphan" },
    ]);

    const model = getRightPanelGraphModel(index, "start", { scope: "local" });

    expect(model.nodes.map(({ documentId, depth }) => [documentId, depth])).toEqual([
      ["guide", 1],
      ["incoming", 1],
      ["start", 0],
    ]);
    expect(model.edges).toEqual([
      {
        sourceDocumentId: "incoming",
        targetDocumentId: "start",
        linkCount: 1,
        kind: "relationship",
      },
      {
        sourceDocumentId: "start",
        targetDocumentId: "guide",
        linkCount: 1,
        kind: "relationship",
      },
    ]);
    expect(model.totalNodeCount).toBe(3);
    expect(model.totalLinkCount).toBe(2);
  });

  it("keeps every node and resolved link in a dense graph", () => {
    const targets = Array.from({ length: 5 }, (_, index) => ({
      id: `target-${index}`,
      path: `Target ${index}.md`,
      markdown: "",
    }));
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "start",
        path: "Start.md",
        markdown: targets.map((target) => `[[${target.path}]]`).join("\n"),
      },
      ...targets,
    ]);

    const model = getRightPanelGraphModel(index, "start");
    expect(model.nodes).toHaveLength(6);
    expect(model.totalNodeCount).toBe(6);
    expect(model.totalLinkCount).toBe(5);
    expect(model.isTruncated).toBe(false);
    expect(model.edges).toHaveLength(5);
  });

  it("keeps a deterministic fitted layout when the active document changes", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "start", path: "Start.md", markdown: "[[Guide]]" },
      { id: "guide", path: "Guide.md", markdown: "" },
      { id: "incoming", path: "Incoming.md", markdown: "[[Start]]" },
    ]);
    const startLayout = getRightPanelGraphLayout(getRightPanelGraphModel(index, "start"));
    const guideLayout = getRightPanelGraphLayout(getRightPanelGraphModel(index, "guide"));
    const getCoordinates = (layout: typeof startLayout) => layout.map(
      ({ documentId, x, y }) => ({ documentId, x, y }),
    );

    expect(getCoordinates(startLayout)).toEqual(getCoordinates(guideLayout));
    expect(startLayout.every(({ x, y }) => x >= 9 && x <= 91 && y >= 9 && y <= 91)).toBe(true);
    expect(new Set(startLayout.map(({ x, y }) => `${x}:${y}`)).size).toBe(3);
  });

  it("returns a quiet empty graph for an isolated or missing document", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "empty", path: "Empty.md", markdown: "# Empty" },
    ]);
    expect(getRightPanelGraphModel(index, "empty")).toMatchObject({
      hasConnections: false,
      totalNodeCount: 1,
      totalLinkCount: 0,
    });
    expect(getRightPanelGraphModel(index, "missing")).toMatchObject({
      nodes: [],
      hasConnections: false,
      totalNodeCount: 0,
      totalLinkCount: 0,
    });
  });

  it("shows multiple isolated documents as part of the workspace map", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "first", path: "First.md", markdown: "# First" },
      { id: "second", path: "Second.md", markdown: "# Second" },
    ]);

    expect(getRightPanelGraphModel(index, "first")).toMatchObject({
      hasConnections: true,
      totalNodeCount: 2,
      totalLinkCount: 0,
      edges: [],
    });
  });

  it("separates workspace navigation from concept relationships", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "root-index",
        path: "index.md",
        markdown: "[Architecture](architecture/)\n[Log](log.md)",
      },
      {
        id: "architecture-index",
        path: "architecture/index.md",
        markdown: "[Runtime](runtime.md)\n[Authentication](authentication.md)",
      },
      {
        id: "runtime",
        path: "architecture/runtime.md",
        markdown: [
          "---",
          "type: Architecture",
          "description: How runtime services fit together.",
          "tags: [runtime, platform]",
          "resource: https://github.com/acme/runtime",
          "---",
          "[Authentication](authentication.md)",
        ].join("\n"),
      },
      {
        id: "authentication",
        path: "architecture/authentication.md",
        markdown: "---\ntype: Security\ntags: [platform]\n---\n# Authentication",
      },
      {
        id: "log",
        path: "log.md",
        markdown: "[Runtime](architecture/runtime.md)",
      },
    ]);

    const workspace = getRightPanelGraphModel(index, "runtime");
    expect(workspace.nodes.map(({ documentId, role }) => [documentId, role])).toEqual([
      ["authentication", "concept"],
      ["architecture-index", "index"],
      ["runtime", "concept"],
      ["root-index", "index"],
      ["log", "log"],
    ]);
    expect(workspace.edges.map((edge) => [
      edge.sourceDocumentId,
      edge.targetDocumentId,
      edge.kind,
    ])).toEqual([
      ["architecture-index", "authentication", "navigation"],
      ["architecture-index", "runtime", "navigation"],
      ["runtime", "authentication", "relationship"],
      ["root-index", "architecture-index", "navigation"],
      ["root-index", "log", "navigation"],
      ["log", "runtime", "navigation"],
    ]);

    const concepts = getRightPanelGraphModel(index, "runtime", { scope: "concept" });
    expect(concepts.nodes).toEqual([
      expect.objectContaining({
        documentId: "authentication",
        role: "concept",
        type: "Security",
        tags: ["platform"],
      }),
      expect.objectContaining({
        documentId: "runtime",
        role: "concept",
        type: "Architecture",
        description: "How runtime services fit together.",
        tags: ["runtime", "platform"],
        resource: "https://github.com/acme/runtime",
      }),
    ]);
    expect(concepts.edges).toEqual([
      {
        sourceDocumentId: "runtime",
        targetDocumentId: "authentication",
        linkCount: 1,
        kind: "relationship",
      },
    ]);
    expect(concepts.totalNodeCount).toBe(2);
    expect(concepts.totalLinkCount).toBe(1);
  });

  it("filters concepts by selected types and all selected tags", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "architecture",
        path: "Architecture.md",
        markdown: "---\ntype: Architecture\ntags: [platform, runtime]\n---\n# Architecture",
      },
      {
        id: "security",
        path: "Security.md",
        markdown: "---\ntype: Security\ntags: [platform]\n---\n# Security",
      },
      {
        id: "runbook",
        path: "Runbook.md",
        markdown: "---\ntype: Operations\ntags: [runtime]\n---\n# Runbook",
      },
    ]);

    const model = getRightPanelGraphModel(index, "architecture", {
      scope: "concept",
      filters: {
        types: new Set(["Architecture", "Security"]),
        tags: new Set(["platform", "runtime"]),
      },
    });

    expect(model.nodes.map((node) => node.documentId)).toEqual(["architecture"]);
  });

  it("exposes and filters OKF lifecycle, trust, freshness, and provenance", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "reviewed",
        path: "Reviewed.md",
        markdown: [
          "---",
          "type: Reference",
          "status: stable",
          "stale_after: 2026-08-01",
          "generated: { by: agent:research, at: 2026-07-20T00:00:00Z }",
          "verified: { by: human:taeha, at: 2026-07-24T00:00:00Z }",
          "sources:",
          "  - resource: https://example.com/source",
          "---",
          "# Reviewed",
        ].join("\n"),
      },
      {
        id: "draft",
        path: "Draft.md",
        markdown: "---\ntype: Reference\nstatus: draft\n---\n# Draft",
      },
    ]);

    const model = getRightPanelGraphModel(index, "reviewed", {
      scope: "concept",
      today: "2026-08-01",
      filters: {
        types: new Set(),
        tags: new Set(),
        statuses: new Set(["stable"]),
        trustTiers: new Set(["human-reviewed"]),
        freshness: new Set(["stale"]),
      },
    });

    expect(model.nodes).toEqual([
      expect.objectContaining({
        documentId: "reviewed",
        isTypedConcept: true,
        status: "stable",
        trustTier: "human-reviewed",
        freshness: "stale",
        sources: [{ resource: "https://example.com/source" }],
        generated: {
          by: "agent:research",
          at: "2026-07-20T00:00:00Z",
        },
      }),
    ]);
  });

  it("does not treat untyped Markdown defaults as declared OKF lifecycle metadata", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "typed",
        path: "Typed.md",
        markdown: "---\ntype: Reference\nstatus: stable\n---\n# Typed",
      },
      {
        id: "plain",
        path: "Plain.md",
        markdown: "# Plain",
      },
    ]);

    const concepts = getRightPanelGraphModel(index, "typed", {
      scope: "concept",
    });
    expect(concepts.nodes).toEqual([
      expect.objectContaining({
        documentId: "plain",
        isTypedConcept: false,
      }),
      expect.objectContaining({
        documentId: "typed",
        isTypedConcept: true,
      }),
    ]);

    const filtered = getRightPanelGraphModel(index, "typed", {
      scope: "concept",
      filters: {
        types: new Set(),
        tags: new Set(),
        statuses: new Set(["stable"]),
      },
    });
    expect(filtered.nodes.map((node) => node.documentId)).toEqual(["typed"]);
  });

  it("applies shared knowledge filters to the workspace map", () => {
    const index = createWorkspaceKnowledgeIndex([
      {
        id: "index",
        path: "index.md",
        markdown: "[Architecture](Architecture.md)\n[Security](Security.md)",
      },
      {
        id: "architecture",
        path: "Architecture.md",
        markdown: "---\ntype: Architecture\ntags: [platform]\n---\n# Architecture",
      },
      {
        id: "security",
        path: "Security.md",
        markdown: "---\ntype: Security\ntags: [platform]\n---\n# Security",
      },
    ]);

    const model = getRightPanelGraphModel(index, "architecture", {
      scope: "workspace",
      filters: {
        types: new Set(["Architecture"]),
        tags: new Set(),
      },
    });

    expect(model.nodes.map((node) => node.documentId)).toEqual(["architecture"]);
    expect(model.edges).toEqual([]);
  });
});
