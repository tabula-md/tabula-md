import { describe, expect, it } from "vitest";
import {
  buildLineSurfaceAnnotationRows,
  buildLineSurfaceVisualRows,
  getLineNumbersForSourceRanges,
  sourceRangeIntersectsLine,
} from "@tabula-md/tabula";

const sourceLines = [
  { number: 1, start: 0, end: 5 },
  { number: 2, start: 6, end: 6 },
  { number: 3, start: 7, end: 14 },
];

const resolveLineAt = (position: number) =>
  sourceLines.find((line) => position >= line.start && position <= line.end) ?? sourceLines[sourceLines.length - 1];

describe("line surface model", () => {
  it("normalizes wrapped visual rows without changing source row order", () => {
    const rows = buildLineSurfaceVisualRows([
      { kind: "text", runIndex: 0, left: 10, top: 0, width: 240, height: 24 },
      { kind: "text", runIndex: 0, left: 10, top: 20, width: 120, height: 18 },
      { kind: "empty-line", runIndex: 0, left: 10, top: 38, width: 8, height: 18 },
    ]);

    expect(rows.map((row) => [row.rowIndex, row.top, row.bottom])).toEqual([
      [0, 0, 20],
      [1, 20, 38],
      [2, 38, 56],
    ]);
    expect(rows[2].rectangles[0].kind).toBe("empty-line");
  });

  it("resolves multi-line and empty source ranges to line numbers", () => {
    expect(
      Array.from(
        getLineNumbersForSourceRanges({
          docLength: 14,
          ranges: [
            { start: 2, end: 12 },
            { start: 6, end: 6 },
          ],
          resolveLineAt,
        }),
      ),
    ).toEqual([1, 2, 3]);
  });

  it("treats empty source lines as addressable line surfaces", () => {
    const emptyLine = { start: 6, end: 6 };

    expect(sourceRangeIntersectsLine({ start: 6, end: 6 }, emptyLine)).toBe(true);
    expect(sourceRangeIntersectsLine({ start: 5, end: 7 }, emptyLine)).toBe(true);
    expect(sourceRangeIntersectsLine({ start: 7, end: 8 }, emptyLine)).toBe(false);
  });

  it("maps annotations to visual rows with deterministic fallback rows", () => {
    const rows = buildLineSurfaceAnnotationRows(
      [
        { lineNumber: 2, start: 6, end: 6, hasBookmark: true, hasComment: false },
        { lineNumber: 5, start: 20, end: 25, hasBookmark: false, hasComment: true },
        { lineNumber: 5, start: 20, end: 25, hasBookmark: false, hasComment: true },
      ],
      [{ startLine: 1, endLine: 3, top: 0, bottom: 90 }],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ lineNumber: 2, top: 30, height: 30, hasBookmark: true });
    expect(rows[1]).toMatchObject({ lineNumber: 5, top: 96, height: 24, hasComment: true });
  });
});
