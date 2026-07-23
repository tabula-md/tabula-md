import { describe, expect, it } from "vitest";
import { createWorkspaceFile, createWorkspaceRootFolder } from "./workspaceStorage";
import {
  getWorkspaceKnowledgeDocuments,
  reconcileWorkspaceKnowledgeIndex,
} from "./workspaceKnowledgeModel";

describe("workspace knowledge model", () => {
  it("uses exact workspace paths when resolving links", () => {
    const folders = [
      createWorkspaceRootFolder(),
      { id: "docs", title: "Knowledge  Base", parentId: "workspace-root" },
    ];
    const documents = getWorkspaceKnowledgeDocuments([
      createWorkspaceFile(1, {
        id: "start",
        title: "Start.md",
        parentId: "docs",
        text: "[[Guide.MD]]",
      }),
      createWorkspaceFile(2, {
        id: "guide",
        title: "Guide.MD",
        parentId: "docs",
        text: "# Guide",
      }),
    ], folders);

    const index = reconcileWorkspaceKnowledgeIndex(undefined, documents);
    expect(index.documentsById.get("guide")?.path).toBe("Knowledge  Base/Guide.MD");
    expect(index.outgoingLinksByDocumentId.get("start")?.[0]).toMatchObject({
      status: "resolved",
      targetDocumentId: "guide",
    });
  });

  it("re-analyzes only changed documents and safely handles path swaps", () => {
    const initial = reconcileWorkspaceKnowledgeIndex(undefined, [
      { id: "a", path: "A.md", markdown: "[[B.md]]" },
      { id: "b", path: "B.md", markdown: "# B" },
    ]);
    const initialBAnalysis = initial.analysesByDocumentId.get("b");

    const unchanged = reconcileWorkspaceKnowledgeIndex(initial, [
      { id: "a", path: "A.md", markdown: "[[B.md]]" },
      { id: "b", path: "B.md", markdown: "# B" },
    ]);
    expect(unchanged).toBe(initial);

    const textChanged = reconcileWorkspaceKnowledgeIndex(initial, [
      { id: "a", path: "A.md", markdown: "[[B.md]]\n\nUpdated" },
      { id: "b", path: "B.md", markdown: "# B" },
    ]);
    expect(textChanged.analysesByDocumentId.get("b")).toBe(initialBAnalysis);

    const pathsSwapped = reconcileWorkspaceKnowledgeIndex(textChanged, [
      { id: "a", path: "B.md", markdown: "[[A.md]]" },
      { id: "b", path: "A.md", markdown: "# B" },
    ]);
    expect(pathsSwapped.documentsById.get("a")?.path).toBe("B.md");
    expect(pathsSwapped.documentsById.get("b")?.path).toBe("A.md");
  });
});
