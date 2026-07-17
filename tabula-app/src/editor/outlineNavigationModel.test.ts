import { describe, expect, it } from "vitest";
import type { MarkdownHeading } from "@tabula-md/tabula";
import {
  getActiveOutlineHeadingIndex,
  getOutlineHeadingOffsets,
} from "./outlineNavigationModel";

const heading = (text: string, sourceLineIndex: number): MarkdownHeading => ({
  depth: 2,
  lineIndex: sourceLineIndex,
  sourceLineIndex,
  text,
});

describe("outline navigation model", () => {
  it("collects heading offsets in one forward pass", () => {
    const markdown = "intro\n\n## First\nbody\n\n## Second\nend";
    const headings = [heading("First", 2), heading("Second", 5)];

    expect(getOutlineHeadingOffsets(markdown, headings)).toEqual([
      markdown.indexOf("## First"),
      markdown.indexOf("## Second"),
    ]);
  });

  it("finds the nearest heading at or before the cursor", () => {
    const offsets = [7, 28, 52];

    expect(getActiveOutlineHeadingIndex(offsets, 6)).toBeUndefined();
    expect(getActiveOutlineHeadingIndex(offsets, 7)).toBe(0);
    expect(getActiveOutlineHeadingIndex(offsets, 51)).toBe(1);
    expect(getActiveOutlineHeadingIndex(offsets, 100)).toBe(2);
  });
});
