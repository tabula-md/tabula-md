import { describe, expect, it } from "vitest";
import {
  createWorkspaceKnowledgeIndex,
  removeWorkspaceDocumentFromKnowledgeIndex,
  updateWorkspaceKnowledgeIndex,
  type WorkspaceSourceDocument,
} from "@tabula-md/tabula";
import {
  applyWorkspaceKnowledgeIndexDelta,
  createWorkspaceKnowledgeIndexDelta,
} from "./workspaceKnowledgeWorkerDelta";

const document = (
  id: string,
  path: string,
  markdown: string,
): WorkspaceSourceDocument => ({ id, path, markdown });

describe("workspace knowledge worker delta", () => {
  it("reconstructs an index after documents and link resolutions change", () => {
    const previous = createWorkspaceKnowledgeIndex([
      document("start", "docs/Start.md", "[Guide](Guide.md)\n[Missing](Missing.md)"),
      document("guide", "docs/Guide.md", "---\ntype: Guide\ntags: [docs]\n---\n# Guide"),
      document("removed", "Removed.md", "# Removed"),
    ]);
    const nextDocuments = [
      document("start", "docs/Start.md", "[Guide](Guide.md)\n[Found](Missing.md)"),
      document("guide", "docs/Guide.md", "---\ntype: Reference\ntags: [docs, api]\n---\n# Guide"),
      document("missing", "docs/Missing.md", "# Found"),
    ];
    let next = removeWorkspaceDocumentFromKnowledgeIndex(previous, "removed");
    for (const nextDocument of nextDocuments) {
      const current = next.documentsById.get(nextDocument.id);
      if (
        !current ||
        current.path !== nextDocument.path ||
        current.markdown !== nextDocument.markdown
      ) {
        next = updateWorkspaceKnowledgeIndex(next, nextDocument);
      }
    }

    expect(applyWorkspaceKnowledgeIndexDelta(
      previous,
      createWorkspaceKnowledgeIndexDelta(previous, next),
      new Map(nextDocuments.map((item) => [item.id, item])),
    )).toEqual(next);
  });

  it("omits unchanged global link collections", () => {
    const previous = createWorkspaceKnowledgeIndex([
      document("guide", "Guide.md", "[Website](https://tabula.md)"),
    ]);
    const next = updateWorkspaceKnowledgeIndex(
      previous,
      document("guide", "Guide.md", "[Website](https://tabula.md)\n\n# Renamed"),
    );

    const delta = createWorkspaceKnowledgeIndexDelta(previous, next);

    expect(delta.externalLinks).toBeUndefined();
    expect(delta.brokenLinks).toBeUndefined();
    expect(delta.ambiguousLinks).toBeUndefined();
    expect(delta.analysesByDocumentId.upsertedEntries).toHaveLength(1);
    expect(delta.outgoingLinksByDocumentId.upsertedEntries).toHaveLength(0);
    expect(delta.backlinksByDocumentId.upsertedEntries).toHaveLength(0);
  });
});
