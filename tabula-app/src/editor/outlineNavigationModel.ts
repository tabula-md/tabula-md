import type { MarkdownHeading } from "@tabula-md/tabula";

export const getOutlineHeadingOffsets = (
  markdown: string,
  headings: readonly MarkdownHeading[],
) => {
  const offsets: number[] = [];
  let lineIndex = 0;
  let lineStartOffset = 0;

  for (const heading of headings) {
    while (lineIndex < heading.sourceLineIndex) {
      const lineBreakOffset = markdown.indexOf("\n", lineStartOffset);
      if (lineBreakOffset === -1) {
        lineStartOffset = markdown.length;
        break;
      }
      lineStartOffset = lineBreakOffset + 1;
      lineIndex += 1;
    }
    offsets.push(lineStartOffset);
  }

  return offsets;
};

export const getActiveOutlineHeadingIndex = (
  headingOffsets: readonly number[],
  sourceOffset: number,
) => {
  let lowerBound = 0;
  let upperBound = headingOffsets.length;

  while (lowerBound < upperBound) {
    const middle = Math.floor((lowerBound + upperBound) / 2);
    if (headingOffsets[middle] <= sourceOffset) {
      lowerBound = middle + 1;
    } else {
      upperBound = middle;
    }
  }

  return lowerBound === 0 ? undefined : lowerBound - 1;
};
