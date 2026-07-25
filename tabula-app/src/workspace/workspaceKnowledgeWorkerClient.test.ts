import { describe, expect, it } from "vitest";
import type { WorkspaceSourceDocument } from "@tabula-md/tabula";
import {
  getWorkspaceKnowledgePathChanges,
  getWorkspaceKnowledgeSyncDelta,
} from "./workspaceKnowledgeWorkerClient";

const document = (
  id: string,
  path: string,
  markdown: string,
): WorkspaceSourceDocument => ({ id, path, markdown });

describe("workspace knowledge worker client", () => {
  it("sends only added, removed, or changed documents", () => {
    const unchanged = document("unchanged", "Unchanged.md", "# Same");
    const changed = document("changed", "Changed.md", "# Before");
    const removed = document("removed", "Removed.md", "# Removed");
    const added = document("added", "Added.md", "# Added");
    const changedNext = document("changed", "Changed.md", "# After");

    const delta = getWorkspaceKnowledgeSyncDelta(
      new Map([
        [unchanged.id, unchanged],
        [changed.id, changed],
        [removed.id, removed],
      ]),
      new Map([
        [unchanged.id, unchanged],
        [changedNext.id, changedNext],
        [added.id, added],
      ]),
    );

    expect(delta.removedDocumentIds).toEqual(["removed"]);
    expect(delta.upsertedDocuments).toEqual([changedNext, added]);
  });

  it("treats a path change as an upsert even when Markdown is unchanged", () => {
    const previous = document("guide", "docs/Guide.md", "# Guide");
    const next = document("guide", "handbook/Guide.md", "# Guide");

    expect(getWorkspaceKnowledgeSyncDelta(
      new Map([[previous.id, previous]]),
      new Map([[next.id, next]]),
    ).upsertedDocuments).toEqual([next]);
  });

  it("sends only changed paths for knowledge maintenance", () => {
    const unchanged = document("same", "Same.md", "# Same");
    const previous = document("guide", "docs/Guide.md", "# Guide");
    const next = document("guide", "handbook/Guide.md", "# Guide");

    expect(getWorkspaceKnowledgePathChanges(
      new Map([
        [unchanged.id, unchanged],
        [previous.id, previous],
      ]),
      new Map([
        [unchanged.id, unchanged],
        [next.id, next],
      ]),
    )).toEqual([{
      documentId: "guide",
      previousPath: "docs/Guide.md",
      nextPath: "handbook/Guide.md",
    }]);
  });
});
