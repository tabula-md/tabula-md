export type MarkdownTextEdit = {
  from: number;
  to: number;
  insert: string;
  selection: number;
};

export type MarkdownRangeSelection = {
  from: number;
  to: number;
};

export type MarkdownRangeEdit = {
  from: number;
  to: number;
  insert: string;
  selection: MarkdownRangeSelection;
};

type MarkdownLineMatch = {
  marker: string;
  content: string;
  nextMarker: string;
};

const getLineAtOffset = (text: string, offset: number) => {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, safeOffset - 1)) + 1;
  const nextLineBreak = text.indexOf("\n", safeOffset);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const lineText = text.slice(lineStart, lineEnd);
  const column = safeOffset - lineStart;

  return {
    lineStart,
    lineText,
    beforeCursor: lineText.slice(0, column),
    afterCursor: lineText.slice(column),
  };
};

const markdownUrlPattern = /^(?:https?:\/\/|mailto:)[^\s<>()]+$/i;

const normalizePastedMarkdownText = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201f]/g, '"')
    .replace(/\t/g, "  ")
    .replace(/\n[ \t]+(?=\n)/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

const isMarkdownUrl = (text: string) => markdownUrlPattern.test(text);

const formatMarkdownLinkText = (text: string) => {
  const label = text.replace(/\s+/g, " ").trim() || "link";
  return label.replace(/]/g, "\\]");
};

const getMarkdownLineMatch = (beforeCursor: string): MarkdownLineMatch | null => {
  const checklistMatch = beforeCursor.match(/^(\s*)([-*+])\s+\[[ xX]\]\s+(.*)$/);
  if (checklistMatch) {
    return {
      marker: beforeCursor.slice(0, beforeCursor.length - checklistMatch[3].length),
      content: checklistMatch[3],
      nextMarker: `${checklistMatch[1]}${checklistMatch[2]} [ ] `,
    };
  }

  const numberedMatch = beforeCursor.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (numberedMatch) {
    return {
      marker: beforeCursor.slice(0, beforeCursor.length - numberedMatch[3].length),
      content: numberedMatch[3],
      nextMarker: `${numberedMatch[1]}${Number(numberedMatch[2]) + 1}. `,
    };
  }

  const bulletMatch = beforeCursor.match(/^(\s*)([-*+])\s+(.*)$/);
  if (bulletMatch) {
    return {
      marker: beforeCursor.slice(0, beforeCursor.length - bulletMatch[3].length),
      content: bulletMatch[3],
      nextMarker: `${bulletMatch[1]}${bulletMatch[2]} `,
    };
  }

  const quoteMatch = beforeCursor.match(/^(\s*(?:>\s?)+)(.*)$/);
  if (quoteMatch) {
    const marker = quoteMatch[1].endsWith(" ") ? quoteMatch[1] : `${quoteMatch[1]} `;
    return {
      marker: quoteMatch[1],
      content: quoteMatch[2],
      nextMarker: marker,
    };
  }

  return null;
};

const getSelectedLineRange = (text: string, selection: MarkdownRangeSelection) => {
  const safeFrom = Math.max(0, Math.min(Math.min(selection.from, selection.to), text.length));
  const safeTo = Math.max(0, Math.min(Math.max(selection.from, selection.to), text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, safeFrom - 1)) + 1;
  const selectedEnd = safeTo > safeFrom && text[safeTo - 1] === "\n" ? safeTo - 1 : safeTo;
  const nextLineBreak = text.indexOf("\n", selectedEnd);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;

  return {
    from: lineStart,
    to: lineEnd,
    selectionFrom: safeFrom,
    selectionTo: safeTo,
    lines: text.slice(lineStart, lineEnd).split("\n"),
  };
};

const getListLineIndentChange = (line: string, direction: "indent" | "outdent") => {
  const listMatch = line.match(/^(\s*)(?:[-*+]\s+|\d+\.\s+)/);
  if (!listMatch) {
    return { line, delta: 0 };
  }

  if (direction === "indent") {
    return { line: `  ${line}`, delta: 2 };
  }

  const indent = listMatch[1];
  const removeCount = Math.min(2, indent.length);
  if (removeCount === 0) {
    return { line, delta: 0 };
  }

  return {
    line: line.slice(removeCount),
    delta: -removeCount,
  };
};

const mapOffsetThroughLineChanges = (
  offset: number,
  rangeStart: number,
  lineStarts: number[],
  lineDeltas: number[],
) => {
  let mappedOffset = offset;

  lineStarts.forEach((lineStart, index) => {
    const absoluteLineStart = rangeStart + lineStart;
    const delta = lineDeltas[index] ?? 0;
    if (delta > 0 && offset >= absoluteLineStart) {
      mappedOffset += delta;
    } else if (delta < 0 && offset > absoluteLineStart) {
      mappedOffset += delta;
      if (mappedOffset < absoluteLineStart) {
        mappedOffset = absoluteLineStart;
      }
    }
  });

  return mappedOffset;
};

export const getMarkdownEnterEdit = (text: string, offset: number): MarkdownTextEdit | null => {
  const { lineStart, beforeCursor, afterCursor } = getLineAtOffset(text, offset);
  const lineMatch = getMarkdownLineMatch(beforeCursor);
  if (!lineMatch) {
    return null;
  }

  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const hasEmptyItem = lineMatch.content.trim().length === 0 && afterCursor.trim().length === 0;
  if (hasEmptyItem) {
    return {
      from: lineStart,
      to: lineStart + lineMatch.marker.length,
      insert: "",
      selection: lineStart,
    };
  }

  const insert = `\n${lineMatch.nextMarker}`;
  return {
    from: safeOffset,
    to: safeOffset,
    insert,
    selection: safeOffset + insert.length,
  };
};

export const getMarkdownIndentEdit = (
  text: string,
  selection: MarkdownRangeSelection,
  direction: "indent" | "outdent",
): MarkdownRangeEdit | null => {
  const range = getSelectedLineRange(text, selection);
  let lineStartOffset = 0;
  const lineStarts: number[] = [];
  const lineDeltas: number[] = [];
  let changed = false;
  const nextLines = range.lines.map((line) => {
    const lineChange = getListLineIndentChange(line, direction);
    lineStarts.push(lineStartOffset);
    lineDeltas.push(lineChange.delta);
    lineStartOffset += line.length + 1;
    if (lineChange.delta !== 0) {
      changed = true;
    }
    return lineChange.line;
  });

  if (!changed) {
    return null;
  }

  const insert = nextLines.join("\n");
  return {
    from: range.from,
    to: range.to,
    insert,
    selection: {
      from: mapOffsetThroughLineChanges(range.selectionFrom, range.from, lineStarts, lineDeltas),
      to: mapOffsetThroughLineChanges(range.selectionTo, range.from, lineStarts, lineDeltas),
    },
  };
};

export const getMarkdownPasteEdit = (
  text: string,
  selection: MarkdownRangeSelection,
  pastedText: string,
): MarkdownRangeEdit | null => {
  if (!pastedText) {
    return null;
  }

  const range = getSelectedLineRange(text, selection);
  const from = range.selectionFrom;
  const to = range.selectionTo;
  const selectedText = text.slice(from, to);
  const normalizedText = normalizePastedMarkdownText(pastedText);
  const urlCandidate = normalizedText.trim();
  const shouldLinkSelection =
    selectedText.trim().length > 0 &&
    !selectedText.includes("\n") &&
    urlCandidate === normalizedText &&
    isMarkdownUrl(urlCandidate);

  if (shouldLinkSelection) {
    const linkText = formatMarkdownLinkText(selectedText);
    const insert = `[${linkText}](${urlCandidate})`;
    const nextOffset = from + insert.length;
    return {
      from,
      to,
      insert,
      selection: { from: nextOffset, to: nextOffset },
    };
  }

  if (normalizedText === pastedText) {
    return null;
  }

  const nextOffset = from + normalizedText.length;
  return {
    from,
    to,
    insert: normalizedText,
    selection: { from: nextOffset, to: nextOffset },
  };
};
