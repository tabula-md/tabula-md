import { describe, expect, it } from "vitest";
import {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  getNewFilePreferenceOverrides,
  isSupportedImportFileDescriptor,
} from "./workspaceIoModel";

describe("workspaceIoModel", () => {
  const preferences = {
    newFileViewMode: "split",
    readingWidth: "wide",
    lineWrapping: true,
    lineNumbers: false,
  } as const;

  it("builds new file preference overrides", () => {
    expect(getNewFilePreferenceOverrides(preferences)).toEqual({
      viewMode: "split",
      readingWidth: "wide",
      lineWrapping: true,
      lineNumbers: false,
    });
  });

  it("accepts Markdown and plain text import descriptors", () => {
    expect(isSupportedImportFileDescriptor({ name: "Spec.md", type: "" })).toBe(true);
    expect(isSupportedImportFileDescriptor({ name: "Spec.markdown", type: "" })).toBe(true);
    expect(isSupportedImportFileDescriptor({ name: "notes", type: "text/plain" })).toBe(true);
    expect(isSupportedImportFileDescriptor({ name: "archive.json", type: "application/json" })).toBe(false);
  });

  it("creates text file download drafts", () => {
    expect(createCurrentFileDownloadDraft({ title: "README.md", text: "# Hello" })).toEqual({
      fileName: "README.md",
      content: "# Hello",
      type: "text/markdown;charset=utf-8",
    });
  });

  it("normalizes imported workspace file titles", () => {
    expect(createImportedWorkspaceFileDraft("Design Brief", "# Design", preferences)).toEqual({
      title: "Design Brief.md",
      text: "# Design",
      viewMode: "split",
      overrides: {
        viewMode: "split",
        readingWidth: "wide",
        lineWrapping: true,
        lineNumbers: false,
      },
    });
  });
});
