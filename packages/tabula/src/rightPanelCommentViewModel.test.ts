import { describe, expect, it } from "vitest";
import {
  getRightPanelCommentGroups,
  getRightPanelCommentScopeModel,
  type RightPanelComment,
  type RightPanelCommentFile,
  type RightPanelCommentGroup,
} from "./rightPanelCommentViewModel";

const importedFile = (id: string, title: string): RightPanelCommentFile => ({
  id,
  title,
});

const fileComment = (id: string, createdAt: string, overrides: Partial<RightPanelComment> = {}): RightPanelComment => ({
  id,
  createdAt,
  resolved: false,
  replies: [],
  ...overrides,
});

describe("rightPanelCommentViewModel", () => {
  it("separates open and resolved comment groups", () => {
    const files = [importedFile("file-a", "Plan.md"), importedFile("file-b", "Notes.md")];
    const result = getRightPanelCommentGroups(files, {
      "file-a": [
        fileComment("open-a", "2026-01-01T00:00:00.000Z"),
        fileComment("resolved-a", "2026-01-02T00:00:00.000Z", { resolved: true }),
      ],
      "file-b": [fileComment("open-b", "2026-01-03T00:00:00.000Z")],
    });

    expect(result.openCommentGroups.map((group) => group.file.id)).toEqual(["file-a", "file-b"]);
    expect(result.openCommentGroups.flatMap((group) => group.comments.map((comment) => comment.id))).toEqual([
      "open-a",
      "open-b",
    ]);
    expect(result.resolvedCommentGroups.map((group) => group.file.id)).toEqual(["file-a"]);
    expect(result.resolvedCommentGroups[0].comments.map((comment) => comment.id)).toEqual(["resolved-a"]);
  });

  it("models current-file scope", () => {
    const activeFile = importedFile("file-a", "Plan.md");
    const openCommentGroups: RightPanelCommentGroup[] = [
      { file: activeFile, comments: [fileComment("open-a", "2026-01-01T00:00:00.000Z")] },
      {
        file: importedFile("file-b", "Notes.md"),
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
      activeFileId: activeFile.id,
      openCommentGroups,
      resolvedCommentGroups,
      commentScope: "current",
    });

    expect(result.hideSingleActiveFileHeader).toBe(true);
    expect(result.hasAnyComments).toBe(true);
    expect(result.scopedOpenCommentGroups.map((group) => group.file.id)).toEqual(["file-a"]);
    expect(result.scopedResolvedCommentGroups.map((group) => group.file.id)).toEqual(["file-a"]);
  });

  it("sorts all-scope groups and comments by latest activity", () => {
    const fileA = importedFile("file-a", "Plan.md");
    const fileB = importedFile("file-b", "Notes.md");
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
      activeFileId: fileB.id,
      openCommentGroups,
      resolvedCommentGroups: [],
      commentScope: "all",
    });

    expect(result.hideSingleActiveFileHeader).toBe(false);
    expect(result.scopedOpenCommentGroups.map((group) => group.file.id)).toEqual(["file-a", "file-b"]);
    expect(result.scopedOpenCommentGroups[0].comments.map((comment) => comment.id)).toEqual([
      "old-with-new-reply",
      "oldest",
    ]);
  });
});
