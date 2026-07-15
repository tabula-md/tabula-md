import { describe, expect, it } from "vitest";
import type { MarkdownHeading } from "@tabula-md/tabula";
import {
  getCollapsibleOutlineHeadingIds,
  getOutlineHeadingId,
} from "./RightPanelOutline";

const heading = (
  depth: number,
  text: string,
  sourceLineIndex: number,
): MarkdownHeading => ({
  depth,
  text,
  lineIndex: sourceLineIndex,
  sourceLineIndex,
});

describe("right panel outline", () => {
  it("returns only headings that own nested descendants", () => {
    const overview = heading(2, "Overview", 0);
    const details = heading(3, "Details", 2);
    const nestedDetails = heading(4, "Nested details", 4);
    const nextSection = heading(2, "Next section", 8);

    expect(getCollapsibleOutlineHeadingIds([
      overview,
      details,
      nestedDetails,
      nextSection,
    ])).toEqual([
      getOutlineHeadingId(overview),
      getOutlineHeadingId(details),
    ]);
  });

  it("returns no controls for a flat outline", () => {
    expect(getCollapsibleOutlineHeadingIds([
      heading(2, "One", 0),
      heading(2, "Two", 2),
    ])).toEqual([]);
  });
});
