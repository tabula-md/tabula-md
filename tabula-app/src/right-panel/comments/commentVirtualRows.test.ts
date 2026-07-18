import { describe, expect, it } from "vitest";
import { createWorkspaceFile } from "../../workspaceStorage";
import { getCommentVirtualRows } from "./commentVirtualRows";

const comment = (id: string, resolved = false) => ({
  id,
  body: id,
  createdAt: "2026-07-12T00:00:00.000Z",
  resolved,
});

describe("comment virtual rows", () => {
  it("keeps large comment sets as flat rows for windowed rendering", () => {
    const file = createWorkspaceFile(1, { title: "Plan" });
    const comments = Array.from({ length: 5_000 }, (_, index) => comment(`comment-${index}`));

    const rows = getCommentVirtualRows({
      activeFileId: file.id,
      openCommentGroups: [{ file, comments }],
      resolvedCommentGroups: [],
      hideSingleActiveFileHeader: true,
      collapsedCommentFileIds: new Set(),
      showResolved: false,
    });

    expect(rows).toHaveLength(5_000);
    expect(rows[0]?.key).toBe("open:comment:comment-0");
    expect(rows.at(-1)?.key).toBe("open:comment:comment-4999");
  });

  it("omits comments under collapsed file and resolved sections", () => {
    const firstFile = createWorkspaceFile(1, { title: "Plan" });
    const secondFile = createWorkspaceFile(2, { title: "Notes" });
    const rows = getCommentVirtualRows({
      activeFileId: firstFile.id,
      openCommentGroups: [{ file: firstFile, comments: [comment("open")] }],
      resolvedCommentGroups: [{ file: secondFile, comments: [comment("done", true)] }],
      hideSingleActiveFileHeader: false,
      collapsedCommentFileIds: new Set([firstFile.id]),
      showResolved: false,
    });

    expect(rows.map((row) => row.key)).toEqual([
      `open:group:${firstFile.id}`,
      "resolved-header",
    ]);
  });
});
