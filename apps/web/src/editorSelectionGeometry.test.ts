import { describe, expect, it } from "vitest";
import { buildSelectionSegments, type SelectionSegment, type SelectionSourceRectangle } from "./editorSelectionGeometry";

const textRect = (rectangle: Omit<SelectionSourceRectangle, "kind" | "runIndex"> & { runIndex?: number }) => ({
  kind: "text" as const,
  runIndex: rectangle.runIndex ?? 0,
  ...rectangle,
});

const emptyLineRect = (rectangle: Omit<SelectionSourceRectangle, "kind" | "runIndex"> & { runIndex?: number }) => ({
  kind: "empty-line" as const,
  runIndex: rectangle.runIndex ?? 0,
  ...rectangle,
});

const textSegments = (segments: SelectionSegment[]) => segments.filter((segment) => segment.kind === "text");
const bridgeSegments = (segments: SelectionSegment[]) => segments.filter((segment) => segment.kind === "bridge");

describe("selection geometry", () => {
  it("normalizes wrapped rows so text segments do not overlap", () => {
    const segments = buildSelectionSegments([
      textRect({ left: 10, top: 0, width: 240, height: 24 }),
      textRect({ left: 10, top: 20, width: 120, height: 18 }),
    ]);

    expect(textSegments(segments).map((segment) => [segment.top, segment.height])).toEqual([
      [0, 20],
      [20, 18],
    ]);
    expect(textSegments(segments)[1].top).toBeGreaterThanOrEqual(
      textSegments(segments)[0].top + textSegments(segments)[0].height,
    );
  });

  it("adds bridge segments only between adjacent visual rows in the same selection run", () => {
    const segments = buildSelectionSegments([
      textRect({ left: 10, top: 0, width: 240, height: 18 }),
      textRect({ left: 10, top: 18, width: 120, height: 18 }),
      textRect({ left: 10, top: 36, width: 80, height: 18, runIndex: 1 }),
    ]);

    expect(bridgeSegments(segments)).toHaveLength(1);
    expect(bridgeSegments(segments)[0]).toMatchObject({
      left: 10,
      top: 14,
      width: 10,
      height: 8,
      runIndex: 0,
      kind: "bridge",
    });
  });

  it("squares only edges that continue into adjacent rows", () => {
    const segments = buildSelectionSegments([
      textRect({ left: 10, top: 0, width: 240, height: 18 }),
      textRect({ left: 10, top: 18, width: 120, height: 18 }),
    ]);
    const [firstTextSegment, secondTextSegment] = textSegments(segments);

    expect(firstTextSegment.classNames).toContain("selection-square-bottom-left");
    expect(firstTextSegment.classNames).not.toContain("selection-square-bottom-right");
    expect(secondTextSegment.classNames).toContain("selection-square-top-left");
    expect(secondTextSegment.classNames).toContain("selection-square-top-right");
  });

  it("does not connect visual rows when their left edges do not align", () => {
    const segments = buildSelectionSegments([
      textRect({ left: 40, top: 0, width: 160, height: 18 }),
      textRect({ left: 10, top: 18, width: 120, height: 18 }),
    ]);

    expect(bridgeSegments(segments)).toHaveLength(0);
    expect(textSegments(segments).flatMap((segment) => segment.classNames)).not.toContain("selection-square-top-left");
  });

  it("keeps selected empty lines distinct from bridge segments", () => {
    const segments = buildSelectionSegments([
      textRect({ left: 10, top: 0, width: 16, height: 18 }),
      emptyLineRect({ left: 10, top: 18, width: 8, height: 18 }),
      textRect({ left: 10, top: 36, width: 40, height: 18 }),
    ]);

    expect(segments.filter((segment) => segment.kind === "empty-line")).toHaveLength(1);
    expect(segments.filter((segment) => segment.kind === "empty-line")[0].classNames).toContain("cm-user-selection-empty");
    expect(bridgeSegments(segments)).toHaveLength(2);
  });
});
