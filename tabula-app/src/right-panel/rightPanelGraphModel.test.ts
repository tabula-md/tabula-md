import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import {
  getRightPanelGraphLayout,
  getRightPanelGraphModel,
} from "./rightPanelGraphModel";

describe("right panel graph model", () => {
  it("builds a deterministic two-hop graph from resolved links in either direction", () => {
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
      ["start", 0],
      ["guide", 1],
      ["incoming", 1],
      ["details", 2],
    ]);
    expect(model.edges).toEqual([
      { sourceDocumentId: "guide", targetDocumentId: "details", linkCount: 1 },
      { sourceDocumentId: "incoming", targetDocumentId: "start", linkCount: 1 },
      { sourceDocumentId: "start", targetDocumentId: "guide", linkCount: 2 },
    ]);
    expect(model.hasConnections).toBe(true);
    expect(model.isTruncated).toBe(false);
  });

  it("caps dense graphs while reporting the nearby document count", () => {
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

    const model = getRightPanelGraphModel(index, "start", { maxNodes: 3 });
    expect(model.nodes).toHaveLength(3);
    expect(model.totalNodeCount).toBe(6);
    expect(model.isTruncated).toBe(true);
    expect(model.edges).toHaveLength(2);
  });

  it("places the active document at the center and connected depths on separate rings", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "start", path: "Start.md", markdown: "[[Guide]]" },
      { id: "guide", path: "Guide.md", markdown: "[[Details]]" },
      { id: "details", path: "Details.md", markdown: "" },
    ]);
    const layout = getRightPanelGraphLayout(getRightPanelGraphModel(index, "start"));

    expect(layout.find((node) => node.documentId === "start")).toMatchObject({ x: 50, y: 50 });
    expect(layout.find((node) => node.documentId === "guide")).toMatchObject({ x: 50, y: 25 });
    expect(layout.find((node) => node.documentId === "details")).toMatchObject({ x: 50, y: 92 });
    expect(layout.every(({ x, y }) => x >= 8 && x <= 92 && y >= 8 && y <= 92)).toBe(true);
  });

  it("returns a quiet empty graph for an isolated or missing document", () => {
    const index = createWorkspaceKnowledgeIndex([
      { id: "empty", path: "Empty.md", markdown: "# Empty" },
    ]);
    expect(getRightPanelGraphModel(index, "empty")).toMatchObject({
      hasConnections: false,
      totalNodeCount: 1,
    });
    expect(getRightPanelGraphModel(index, "missing")).toMatchObject({
      nodes: [],
      hasConnections: false,
      totalNodeCount: 0,
    });
  });
});
