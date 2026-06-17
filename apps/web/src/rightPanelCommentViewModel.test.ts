import { describe, expect, it } from "vitest";
import {
  getRightPanelCommentGroups,
  getRightPanelCommentScopeModel,
  type RightPanelCommentGroup,
} from "./rightPanelCommentViewModel";
import type { FileComment, MarkdownFile } from "./workspaceStorage";

const markdownFile = (id: string, title: string): MarkdownFile => ({
  id,
  title,
  text: "",
  viewMode: "edit",
  readingWidth: "standard",
  lineWrapping: true,
  connectionStatus: "idle",
});

const fileComment = (id: string, createdAt: string, overrides: Partial<FileComment> = {}): FileComment => ({
  id,
  body: id,
  createdAt,
  resolved: false,
  replies: [],
  ...overrides,
});

describe("rightPanelCommentViewModel", () => {
  it("separates open and resolved comment groups", () => {
    const files = [markdownFile("file-a", "Plan.md"), markdownFile("file-b", "Notes.md")];
    const result = getRightPanelCommentGroups(files, {
      "file-a": [
        fileComment("open-a", "2026-01-01T00:00:00.000Z"),
        fileComment("resolved-a", "2026-01-02T00:00:00.000Z", { resolved: true }),
      ],
      "file-b": [fileComment("open-b", "2026-01-03T00:00:00.000Z")],
    });

    expect(result.openCommentCount).toBe(2);
    expect(result.openCommentGroups.map((group) => group.file.id)).toEqual(["file-a", "file-b"]);
    expect(result.openCommentGroups.flatMap((group) => group.comments.map((comment) => comment.id))).toEqual([
      "open-a",
      "open-b",
    ]);
    expect(result.resolvedCommentGroups.map((group) => group.file.id)).toEqual(["file-a"]);
    expect(result.resolvedCommentGroups[0].comments.map((comment) => comment.id)).toEqual(["resolved-a"]);
  });

  it("models current-file scope labels and counts", () => {
    const activeFile = markdownFile("file-a", "Plan.md");
    const openCommentGroups: RightPanelCommentGroup[] = [
      { file: activeFile, comments: [fileComment("open-a", "2026-01-01T00:00:00.000Z")] },
      {
        file: markdownFile("file-b", "Notes.md"),
        comments: [fileComment("open-b", "2026-01-02T00:00:00.000Z")],
      },
    ];
    const resolvedCommentGroups: RightPanelCommentGroup[] = [
      {
        file: activeFile,
        comments: [fileComment("resolved-a", "2026-01-03T00:00:00.000Z", { resolved: true })],
      },
    ];

    const result = getRightPanelCommentScopeModel({
      activeFile,
      activeFileId: activeFile.id,
      activeFileTitle: activeFile.title,
      openCommentGroups,
      resolvedCommentGroups,
      commentScope: "current",
    });

    expect(result.commentsTitle).toBe("Plan");
    expect(result.switchLabel).toBe("All comments");
    expect(result.switchCount).toBe(3);
    expect(result.hideSingleActiveFileHeader).toBe(true);
    expect(result.hasAnyComments).toBe(true);
    expect(result.scopedOpenCommentGroups.map((group) => group.file.id)).toEqual(["file-a"]);
    expect(result.scopedResolvedCommentGroups.map((group) => group.file.id)).toEqual(["file-a"]);
  });

  it("sorts all-scope groups and comments by latest activity", () => {
    const fileA = markdownFile("file-a", "Plan.md");
    const fileB = markdownFile("file-b", "Notes.md");
    const openCommentGroups: RightPanelCommentGroup[] = [
      {
        file: fileB,
        comments: [fileComment("newer-than-base", "2026-01-02T00:00:00.000Z")],
      },
      {
        file: fileA,
        comments: [
          fileComment("old-with-new-reply", "2026-01-01T00:00:00.000Z", {
            replies: [
              {
                id: "reply-a",
                body: "reply",
                createdAt: "2026-01-03T00:00:00.000Z",
              },
            ],
          }),
          fileComment("oldest", "2025-12-31T00:00:00.000Z"),
        ],
      },
    ];

    const result = getRightPanelCommentScopeModel({
      activeFile: fileB,
      activeFileId: fileB.id,
      activeFileTitle: fileB.title,
      openCommentGroups,
      resolvedCommentGroups: [],
      commentScope: "all",
    });

    expect(result.commentsTitle).toBe("All comments");
    expect(result.switchLabel).toBe("Current file");
    expect(result.switchCount).toBe(1);
    expect(result.hideSingleActiveFileHeader).toBe(false);
    expect(result.scopedOpenCommentGroups.map((group) => group.file.id)).toEqual(["file-a", "file-b"]);
    expect(result.scopedOpenCommentGroups[0].comments.map((comment) => comment.id)).toEqual([
      "old-with-new-reply",
      "oldest",
    ]);
  });
});
