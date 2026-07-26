import { describe, expect, it } from "vitest";
import { captureWorkspaceKnowledgeBaseline } from "@tabula-md/tabula";
import { getWorkspaceKnowledgeDocuments } from "../workspaceKnowledgeModel";
import {
  WORKSPACE_ROOT_FOLDER_ID,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "../workspaceStorage";
import { getWorkspaceExportReview } from "./workspaceExportReviewModel";

const folders: WorkspaceFolder[] = [{
  id: WORKSPACE_ROOT_FOLDER_ID,
  title: "Project",
  parentId: "",
}];

const file = (
  id: string,
  title: string,
  text: string,
): WorkspaceFile => ({
  id,
  title,
  text,
  parentId: WORKSPACE_ROOT_FOLDER_ID,
  viewMode: "edit",
  readingWidth: "standard",
  lineWrapping: true,
  lineNumbers: false,
  splitRatio: 0.5,
  bookmarks: [],
});

describe("workspace export review", () => {
  it("keeps ordinary Markdown export direct", () => {
    expect(getWorkspaceExportReview([
      file("note", "note.md", "# Plain note"),
    ], folders)).toBeUndefined();
  });

  it("summarizes OKF compatibility and knowledge health", () => {
    const review = getWorkspaceExportReview([
      file("index", "index.md", "---\nokf_version: \"0.2\"\n---\n\n# Files"),
      file(
        "guide",
        "guide.md",
        "---\ntype: Guide\nstale_after: 2020-01-01\n---\n\n# Guide\n\n[Missing](missing.md)",
      ),
    ], folders);

    expect(review).toEqual(expect.objectContaining({
      standardVersion: "0.2",
      requiredChangeCount: 0,
      attentionCount: 2,
    }));
    expect(review).not.toHaveProperty("changeCount");
  });

  it("recognizes linked Markdown collections without requiring OKF metadata", () => {
    const review = getWorkspaceExportReview([
      file("first", "first.md", "# First\n\n[Second](second.md)"),
      file("second", "second.md", "# Second"),
    ], folders);

    expect(review?.requiredChangeCount).toBeGreaterThan(0);
  });

  it("counts changes that have not been recorded since the baseline", () => {
    const original = [
      file("guide", "guide.md", "---\ntype: Guide\n---\n\n# Guide"),
    ];
    const baseline = captureWorkspaceKnowledgeBaseline(
      getWorkspaceKnowledgeDocuments(original, folders),
      "2026-07-25T00:00:00.000Z",
    );
    const review = getWorkspaceExportReview([
      { ...original[0]!, text: "---\ntype: Guide\n---\n\n# Updated guide" },
    ], folders, baseline);

    expect(review?.changeCount).toBe(1);
  });
});
