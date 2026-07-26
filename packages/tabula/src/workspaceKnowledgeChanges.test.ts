import { describe, expect, it } from "vitest";
import {
  captureWorkspaceKnowledgeBaseline,
  getWorkspaceKnowledgeChangeSet,
  planWorkspaceOkfLog,
} from "./workspaceKnowledgeChanges";

const document = (id: string, path: string, markdown: string) => ({ id, path, markdown });

describe("workspace knowledge changes", () => {
  it("classifies added, modified, moved, and deleted concepts from a stable baseline", () => {
    const baseline = captureWorkspaceKnowledgeBaseline([
      document("guide", "guides/guide.md", "---\ntype: Guide\nstatus: draft\n---\n# Guide"),
      document("removed", "old.md", "---\ntype: Note\n---\n# Old"),
      document("index", "index.md", "# Files"),
    ], "2026-07-24T00:00:00Z");
    const changes = getWorkspaceKnowledgeChangeSet(baseline, [
      document(
        "guide",
        "handbook/guide.md",
        "---\ntype: Guide\nstatus: stable\n---\n# Guide\n\n[New](../new.md)",
      ),
      document("new", "new.md", "---\ntype: Note\n---\n# New"),
      document("index", "index.md", "# Files\n\nchanged bookkeeping"),
    ]);

    expect(changes).toMatchObject({
      baselineCapturedAt: "2026-07-24T00:00:00Z",
      addedCount: 1,
      modifiedCount: 1,
      deletedCount: 1,
    });
    expect(changes.changes).toEqual([
      expect.objectContaining({
        documentId: "guide",
        kind: "modified",
        path: "handbook/guide.md",
        previousPath: "guides/guide.md",
        bodyChanged: true,
        relationshipDelta: 1,
        metadataChanges: [{
          field: "status",
          before: "draft",
          after: "stable",
        }],
      }),
      expect.objectContaining({ documentId: "new", kind: "added", path: "new.md" }),
      expect.objectContaining({ documentId: "removed", kind: "deleted", path: "old.md" }),
    ]);
  });

  it("creates a deterministic root log and excludes index and log bookkeeping", () => {
    const baseline = captureWorkspaceKnowledgeBaseline([
      document("guide", "guide.md", "---\ntype: Guide\n---\n# Guide"),
      document("index", "index.md", "# Files"),
    ], "2026-07-24T00:00:00Z");
    const candidate = planWorkspaceOkfLog(baseline, [
      document("guide", "guide.md", "---\ntype: Guide\nstatus: stable\n---\n# Guide\n\nUpdated"),
      document("index", "index.md", "# Files\n\nGenerated"),
    ], "2026-07-25");

    expect(candidate.state).toBe("missing");
    expect(candidate.markdown).toContain("# Log\n\n## 2026-07-25");
    expect(candidate.markdown).toContain("- Updated [Guide](guide.md)");
    expect(candidate.markdown).toContain("  - status: not set → `stable`");
    expect(candidate.markdown).toContain("  - Content changed");
    expect(candidate.markdown).not.toContain("index.md");
  });

  it("appends to today's section while preserving existing log prose", () => {
    const baseline = captureWorkspaceKnowledgeBaseline([
      document("guide", "guide.md", "---\ntype: Guide\n---\n# Guide"),
      document("log", "log.md", "# Log\n\nIntro.\n\n## 2026-07-25\n\n- Existing\n\n## 2026-07-24\n\n- Earlier\n"),
    ]);
    const candidate = planWorkspaceOkfLog(baseline, [
      document("guide", "guide.md", "---\ntype: Guide\n---\n# Guide\n\nUpdated"),
      document("log", "log.md", "# Log\n\nIntro.\n\n## 2026-07-25\n\n- Existing\n\n## 2026-07-24\n\n- Earlier\n"),
    ], "2026-07-25");

    expect(candidate.state).toBe("appendable");
    expect(candidate.markdown).toContain("Intro.");
    expect(candidate.markdown).toContain("- Existing\n\n- Updated [Guide](guide.md)");
    expect(candidate.markdown?.indexOf("## 2026-07-25"))
      .toBeLessThan(candidate.markdown?.indexOf("## 2026-07-24") ?? 0);
  });

  it("blocks malformed or ascending logs instead of replacing them", () => {
    const baseline = captureWorkspaceKnowledgeBaseline([
      document("guide", "guide.md", "---\ntype: Guide\n---\n# Guide"),
    ]);
    const candidate = planWorkspaceOkfLog(baseline, [
      document("guide", "guide.md", "---\ntype: Guide\n---\n# Guide\n\nUpdated"),
      document("log", "log.md", "# Log\n\n## 2026-07-24\n\n- Old\n\n## 2026-07-25\n\n- New"),
    ], "2026-07-25");

    expect(candidate).toMatchObject({
      state: "blocked",
      currentDocumentId: "log",
    });
    expect(candidate.markdown).toBeUndefined();
  });
});
