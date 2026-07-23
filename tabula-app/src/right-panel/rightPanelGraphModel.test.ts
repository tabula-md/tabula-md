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
      { sourceDocumentId: "guide", targetDocumentId: "details", linkCount: 1 },
      { sourceDocumentId: "incoming", targetDocumentId: "start", linkCount: 1 },
      { sourceDocumentId: "start", targetDocumentId: "guide", linkCount: 2 },
      { sourceDocumentId: "third-hop", targetDocumentId: "details", linkCount: 1 },
    ]);
    expect(model.totalNodeCount).toBe(6);
    expect(model.totalLinkCount).toBe(5);
    expect(model.hasConnections).toBe(true);
    expect(model.isTruncated).toBe(false);
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
});
