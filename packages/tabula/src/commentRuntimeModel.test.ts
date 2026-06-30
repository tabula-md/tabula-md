import { describe, expect, it } from "vitest";
import {
  formatCommentDate,
  getItemsInSourceLineRange,
  getPreviewCommentAnchors,
  getPreviewLineAnnotations,
  toggleLineBookmarkInList,
} from "./commentRuntimeModel";

describe("commentRuntimeModel", () => {
  it("toggles a line bookmark by source line range", () => {
    const bookmark = {
      id: "existing",
      position: 12,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    expect(
      toggleLineBookmarkInList({
        bookmarks: [bookmark],
        createId: () => "new",
        lineStart: 10,
        lineEnd: 14,
        nowIso: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual([]);

    expect(
      toggleLineBookmarkInList({
        bookmarks: [],
        createId: () => "new",
        lineStart: 10,
        lineEnd: 14,
        nowIso: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual([{ id: "new", position: 10, createdAt: "2026-01-02T00:00:00.000Z" }]);
  });

  it("clips preview comment anchors to the rendered preview body", () => {
    expect(
      getPreviewCommentAnchors({
        commentAnchors: [
          { id: "before", start: 2, end: 7 },
          { id: "inside", start: 12, end: 16 },
          { id: "overlap", start: 18, end: 30 },
        ],
        previewBody: "0123456789",
        previewBodyStartOffset: 10,
      }),
    ).toEqual([
      { id: "inside", start: 2, end: 6 },
      { id: "overlap", start: 8, end: 10 },
    ]);
  });

  it("keeps preview line annotations on empty source lines", () => {
    expect(
      getPreviewLineAnnotations({
        body: "alpha\n\ncharlie",
        bodyStartOffset: 10,
        bookmarks: [{ id: "empty-bookmark", position: 16, createdAt: "2026-01-01T00:00:00.000Z" }],
        commentAnchors: [{ id: "empty-comment", start: 16, end: 16 }],
        activeCommentId: "empty-comment",
      }),
    ).toContainEqual({
      lineNumber: 2,
      start: 16,
      end: 16,
      hasBookmark: true,
      hasComment: true,
      hasActiveComment: true,
    });
  });

  it("filters items by source line range", () => {
    const items = [
      { id: "before", start: 1, end: 2 },
      { id: "inside", start: 6, end: 8 },
      { id: "empty", start: 10, end: 10 },
    ];

    expect(
      getItemsInSourceLineRange({
        items,
        lineStart: 5,
        lineEnd: 10,
        resolveRange: (item) => ({ start: item.start, end: item.end }),
      }).map((item) => item.id),
    ).toEqual(["inside", "empty"]);
  });

  it("formats relative comment dates", () => {
    const now = Date.parse("2026-01-01T01:00:00.000Z");

    expect(formatCommentDate("2026-01-01T00:59:40.000Z", now)).toBe("just now");
    expect(formatCommentDate("2026-01-01T00:58:00.000Z", now)).toBe("2 minutes ago");
    expect(formatCommentDate("2026-01-01T00:00:00.000Z", now)).toBe("1 hour ago");
  });
});
