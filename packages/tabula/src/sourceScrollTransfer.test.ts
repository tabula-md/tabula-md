import { describe, expect, it } from "vitest";
import { applyPreviewBlockMeasurements, createPreviewBlockIndex } from "./previewBlockModel";
import {
  applyPreviewSegmentMeasurements,
  buildSourceScrollSegments,
  getPreviewScrollTopForSourcePosition,
  resolveSourcePosition,
} from "./sourceScrollTransfer";

const viewport = { edgePadding: 0, viewportHeight: 80 };

describe("source scroll transfer", () => {
  it("maps original frontmatter lines to a frontmatter preview segment", () => {
    const body = ["# Title", "", "Body"].join("\n");
    const index = createPreviewBlockIndex(body);
    const map = buildSourceScrollSegments(body, index, {
      frontmatterLineCount: 4,
      frontmatterMeasuredHeight: 120,
      sourceLineOffset: 4,
    });

    expect(map.segments[0]).toMatchObject({
      id: "frontmatter",
      kind: "frontmatter",
      previewHeight: 120,
      sourceStartLine: 1,
      sourceEndLine: 4,
    });

    const frontmatterPosition = resolveSourcePosition({
      atDocumentEnd: false,
      lineNumber: 1,
      lineOffsetRatio: 0,
    }, map);
    const bodyPosition = resolveSourcePosition({
      atDocumentEnd: false,
      lineNumber: 5,
      lineOffsetRatio: 0,
    }, map);

    const frontmatterTarget = getPreviewScrollTopForSourcePosition(map, frontmatterPosition, viewport);
    const bodyTarget = getPreviewScrollTopForSourcePosition(map, bodyPosition, viewport);

    expect(frontmatterTarget.scrollTop).toBe(0);
    expect(bodyTarget.scrollTop).toBeGreaterThan(frontmatterTarget.scrollTop);
  });

  it("collapses blank lines without reversing preview scroll progress", () => {
    const index = createPreviewBlockIndex(["before", "", "", "after"].join("\n"));
    const measured = applyPreviewBlockMeasurements(index, {
      [index.blocks[0]?.id ?? ""]: 120,
      [index.blocks[1]?.id ?? ""]: 0,
      [index.blocks[2]?.id ?? ""]: 120,
    });
    const map = buildSourceScrollSegments("before\n\n\nafter", measured);

    const before = getPreviewScrollTopForSourcePosition(
      map,
      resolveSourcePosition({ atDocumentEnd: false, lineNumber: 1, lineOffsetRatio: 0 }, map),
      viewport,
    );
    const blank = getPreviewScrollTopForSourcePosition(
      map,
      resolveSourcePosition({ atDocumentEnd: false, lineNumber: 2, lineOffsetRatio: 0 }, map),
      viewport,
    );
    const after = getPreviewScrollTopForSourcePosition(
      map,
      resolveSourcePosition({ atDocumentEnd: false, lineNumber: 4, lineOffsetRatio: 0 }, map),
      viewport,
    );

    expect(blank.scrollTop).toBeGreaterThanOrEqual(before.scrollTop);
    expect(after.scrollTop).toBeGreaterThanOrEqual(blank.scrollTop);
  });

  it("maps zero-height sanitized html to the nearest stable rendered boundary", () => {
    const markdown = ["before", "", "<style>body{display:none}</style>", "", "after"].join("\n");
    const index = createPreviewBlockIndex(markdown);
    const htmlBlock = index.blocks.find((block) => block.kind === "html");
    const measured = applyPreviewBlockMeasurements(index, htmlBlock ? { [htmlBlock.id]: 0 } : {});
    const map = buildSourceScrollSegments(markdown, measured);
    const htmlPosition = resolveSourcePosition({
      atDocumentEnd: false,
      lineNumber: 3,
      lineOffsetRatio: 0,
    }, map);
    const nextRenderable = map.segments.find((segment) => segment.sourceStartLine === 5);

    expect(htmlPosition.segmentId).toBe(htmlBlock ? `block:${htmlBlock.id}` : null);
    const unclampedTarget = getPreviewScrollTopForSourcePosition(map, htmlPosition, {
      edgePadding: 0,
      viewportHeight: 1,
    });
    expect(unclampedTarget.scrollTop).toBe(nextRenderable?.previewTop ?? unclampedTarget.scrollTop);
  });

  it("interpolates monotonically through code fences, tables, and lists", () => {
    const markdown = [
      "```ts",
      "const a = 1;",
      "const b = 2;",
      "```",
      "",
      "| A | B |",
      "| - | - |",
      "| 1 | 2 |",
      "",
      "- one",
      "- two",
      "- three",
    ].join("\n");
    const index = createPreviewBlockIndex(markdown);
    const map = buildSourceScrollSegments(markdown, index);
    const targets = [1, 2, 4, 6, 8, 10, 12].map((lineNumber) =>
      getPreviewScrollTopForSourcePosition(
        map,
        resolveSourcePosition({ atDocumentEnd: false, lineNumber, lineOffsetRatio: 0 }, map),
        viewport,
      ).scrollTop,
    );

    expect(targets).toEqual([...targets].sort((first, second) => first - second));
  });

  it("clamps document end to the final preview scroll position", () => {
    const markdown = Array.from({ length: 30 }, (_, index) => `Line ${index + 1}`).join("\n\n");
    const index = createPreviewBlockIndex(markdown);
    const map = buildSourceScrollSegments(markdown, index);
    const endPosition = resolveSourcePosition({
      atDocumentEnd: true,
      lineNumber: 1,
      lineOffsetRatio: 0,
    }, map);
    const target = getPreviewScrollTopForSourcePosition(map, endPosition, viewport);

    expect(target.scrollTop).toBe(Math.max(0, map.totalPreviewHeight - viewport.viewportHeight));
    expect(target.sourceProgress).toBe(1);
  });

  it("recomputes segment tops when measurements are applied", () => {
    const index = createPreviewBlockIndex(["# Title", "", "paragraph"].join("\n"));
    const map = buildSourceScrollSegments("# Title\n\nparagraph", index);
    const heading = index.blocks[0];
    const paragraph = index.blocks[2];
    if (!heading || !paragraph) {
      throw new Error("expected heading and paragraph blocks");
    }

    const measured = applyPreviewSegmentMeasurements(map, {
      [heading.id]: 200,
      [paragraph.id]: 80,
    });
    const measuredParagraph = measured.segments.find((segment) => segment.blockId === paragraph.id);

    expect(measuredParagraph?.previewTop).toBe(200);
    expect(measured.totalPreviewHeight).toBe(280);
  });
});
