export const LARGE_DOCUMENT_CHAR_THRESHOLD = 64_000;
export const LARGE_DOCUMENT_LINE_THRESHOLD = 800;
export const LARGE_DOCUMENT_WORD_THRESHOLD = 8_000;
export const LARGE_DOCUMENT_LONG_LINE_THRESHOLD = 8_000;
export const LARGE_DOCUMENT_TABLE_RUN_THRESHOLD = 120;
export const LIVE_PREVIEW_CHAR_THRESHOLD = 24_000;
export const HEAVY_PREVIEW_TABLE_RUN_THRESHOLD = 16;
export const HEAVY_PREVIEW_FENCE_LINE_THRESHOLD = 80;
export const HEAVY_PREVIEW_FENCE_CHAR_THRESHOLD = 12_000;

export type PreviewBlockKind =
  | "blank"
  | "blockquote"
  | "fence"
  | "heading"
  | "html"
  | "list"
  | "paragraph"
  | "table"
  | "thematic";

export type PreviewBlock = {
  id: string;
  kind: PreviewBlockKind;
  text: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  estimatedTop: number;
  estimatedHeight: number;
};

export type PreviewBlockIndex = {
  blocks: PreviewBlock[];
  lineCount: number;
  totalEstimatedHeight: number;
};

export type PreviewBlockMeasurements = Readonly<Record<string, number>>;

export type PreviewWindow = {
  blocks: PreviewBlock[];
  endIndex: number;
  startIndex: number;
};

type MarkdownLine = {
  text: string;
  startOffset: number;
  endOffset: number;
};

const DEFAULT_LINE_HEIGHT = 27;
const BLOCK_GAP_HEIGHT = 10;
const HEADING_EXTRA_HEIGHT = 18;
const CODE_LINE_HEIGHT = 24;
const PREVIEW_PARAGRAPH_LINE_CHUNK_SIZE = 40;
const PREVIEW_PARAGRAPH_CHAR_CHUNK_SIZE = 4_000;
const PREVIEW_PARAGRAPH_ESTIMATED_CHARS_PER_LINE = 92;

const fenceLinePattern = /^ {0,3}(`{3,}|~{3,})/;
const headingLinePattern = /^ {0,3}#{1,6}\s+\S/;
const thematicLinePattern = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const blockquoteLinePattern = /^ {0,3}>/;
const listLinePattern = /^ {0,3}(?:[-+*]|\d{1,9}[.)])\s+/;
const indentedContinuationPattern = /^(?: {2,}|\t)\S/;
const tableSeparatorPattern = /^ {0,3}\|?\s*:?-{1,}:?\s*(?:\|\s*:?-{1,}:?\s*)+\|?\s*$/;
const htmlLinePattern = /^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(?:\s|>|\/>)/;
const displayMathLinePattern = /^ {0,3}\$\$\s*$/;
const heavyFenceLanguagePattern = /^(?:mermaid|mmd|math|tex|latex|katex)$/i;
const frontmatterFencePattern = /^---\s*$/;
const yamlKeyLinePattern = /^[A-Za-z0-9_-]+:\s*/;
const footnoteDefinitionLinePattern = /^ {0,3}\[\^[^\]\n]+]:/;
const footnoteReferencePattern = /\[\^[^\]\n]+]/;
const referenceDefinitionLinePattern = /^ {0,3}\[(?!\^)([^\]\n]+)]:\s+\S/;
const referenceLinkPattern = /\[[^\]\n]+]\[[^\]\n]*]/;
const definitionListLinePattern = /^ {0,3}:\s+\S/;

export const getMarkdownLineCount = (markdown: string) => {
  if (markdown.length === 0) {
    return 1;
  }

  let lineCount = 1;
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown.charCodeAt(index) === 10) {
      lineCount += 1;
    }
  }
  return lineCount;
};

export const hasLongMarkdownLine = (
  markdown: string,
  threshold = LARGE_DOCUMENT_LONG_LINE_THRESHOLD,
) => {
  let currentLineLength = 0;

  for (let index = 0; index < markdown.length; index += 1) {
    const characterCode = markdown.charCodeAt(index);
    if (characterCode === 10) {
      if (currentLineLength >= threshold) {
        return true;
      }
      currentLineLength = 0;
      continue;
    }

    if (characterCode !== 13) {
      currentLineLength += 1;
    }
  }

  return currentLineLength >= threshold;
};

export const hasLargeMarkdownWordCount = (markdown: string) => {
  let wordCount = 0;
  let inWord = false;

  for (let index = 0; index < markdown.length; index += 1) {
    const character = markdown.charCodeAt(index);
    const isWhitespace =
      character === 32 ||
      character === 9 ||
      character === 10 ||
      character === 13 ||
      character === 12 ||
      character === 11;

    if (isWhitespace) {
      inWord = false;
      continue;
    }

    if (!inWord) {
      wordCount += 1;
      if (wordCount >= LARGE_DOCUMENT_WORD_THRESHOLD) {
        return true;
      }
      inWord = true;
    }
  }

  return false;
};

export const hasLargeMarkdownDocumentShape = (markdown: string) => {
  let currentLineLength = 0;
  let currentTableRun = 0;
  let lineHasTableDelimiter = false;

  const finishLine = () => {
    if (currentLineLength >= LARGE_DOCUMENT_LONG_LINE_THRESHOLD) {
      return true;
    }

    currentTableRun = lineHasTableDelimiter ? currentTableRun + 1 : 0;
    if (currentTableRun >= LARGE_DOCUMENT_TABLE_RUN_THRESHOLD) {
      return true;
    }

    currentLineLength = 0;
    lineHasTableDelimiter = false;
    return false;
  };

  for (let index = 0; index < markdown.length; index += 1) {
    const characterCode = markdown.charCodeAt(index);
    if (characterCode === 10) {
      if (finishLine()) {
        return true;
      }
      continue;
    }

    if (characterCode !== 13) {
      currentLineLength += 1;
    }
    if (characterCode === 124) {
      lineHasTableDelimiter = true;
    }
  }

  return finishLine();
};

export const isLargeMarkdownDocument = (markdown: string) =>
  markdown.length >= LARGE_DOCUMENT_CHAR_THRESHOLD ||
  getMarkdownLineCount(markdown) >= LARGE_DOCUMENT_LINE_THRESHOLD ||
  hasLargeMarkdownWordCount(markdown) ||
  hasLargeMarkdownDocumentShape(markdown);

export const hasHeavyMarkdownPreviewShape = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  let tableRun = 0;
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;
  let fenceLanguage = "";
  let fenceLineCount = 0;
  let fenceCharCount = 0;
  let inDisplayMath = false;

  const finishFence = () => {
    const isHeavyFence =
      heavyFenceLanguagePattern.test(fenceLanguage) ||
      fenceLineCount >= HEAVY_PREVIEW_FENCE_LINE_THRESHOLD ||
      fenceCharCount >= HEAVY_PREVIEW_FENCE_CHAR_THRESHOLD;
    fenceLanguage = "";
    fenceLineCount = 0;
    fenceCharCount = 0;
    return isHeavyFence;
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_-]+)?/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLength = marker.length;
        fenceLanguage = fenceMatch[2]?.toLowerCase() ?? "";
        fenceLineCount = 0;
        fenceCharCount = 0;
        if (heavyFenceLanguagePattern.test(fenceLanguage)) {
          return true;
        }
        continue;
      }

      if (marker[0] === fenceChar && marker.length >= fenceLength) {
        inFence = false;
        if (finishFence()) {
          return true;
        }
        continue;
      }
    }

    if (inFence) {
      fenceLineCount += 1;
      fenceCharCount += line.length;
      if (
        fenceLineCount >= HEAVY_PREVIEW_FENCE_LINE_THRESHOLD ||
        fenceCharCount >= HEAVY_PREVIEW_FENCE_CHAR_THRESHOLD
      ) {
        return true;
      }
      continue;
    }

    if (displayMathLinePattern.test(line)) {
      inDisplayMath = !inDisplayMath;
      return true;
    }

    if (inDisplayMath) {
      return true;
    }

    if (htmlLinePattern.test(line)) {
      return true;
    }

    tableRun = line.includes("|") ? tableRun + 1 : 0;
    if (tableRun >= HEAVY_PREVIEW_TABLE_RUN_THRESHOLD) {
      return true;
    }
  }

  return inFence ? finishFence() : false;
};

export const hasGlobalMarkdownSyntax = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  if (
    lines.length >= 3 &&
    frontmatterFencePattern.test(lines[0] ?? "") &&
    lines.slice(1, Math.min(lines.length, 40)).some((line) => yamlKeyLinePattern.test(line)) &&
    lines.slice(1).some((line) => frontmatterFencePattern.test(line))
  ) {
    return true;
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLength = marker.length;
        continue;
      }

      if (marker[0] === fenceChar && marker.length >= fenceLength) {
        inFence = false;
        continue;
      }
    }

    if (inFence) {
      continue;
    }

    if (
      footnoteDefinitionLinePattern.test(line) ||
      footnoteReferencePattern.test(line) ||
      referenceDefinitionLinePattern.test(line) ||
      referenceLinkPattern.test(line) ||
      definitionListLinePattern.test(line)
    ) {
      return true;
    }
  }

  return false;
};

export const shouldUseImmediateMarkdownPreview = (markdown: string) =>
  markdown.length <= LIVE_PREVIEW_CHAR_THRESHOLD &&
  !isLargeMarkdownDocument(markdown) &&
  !hasHeavyMarkdownPreviewShape(markdown);

const splitMarkdownLines = (markdown: string): MarkdownLine[] => {
  if (markdown.length === 0) {
    return [{ text: "", startOffset: 0, endOffset: 0 }];
  }

  const lines: MarkdownLine[] = [];
  let startOffset = 0;
  while (startOffset <= markdown.length) {
    const lineBreakIndex = markdown.indexOf("\n", startOffset);
    const rawEndOffset = lineBreakIndex === -1 ? markdown.length : lineBreakIndex;
    const endOffset =
      rawEndOffset > startOffset && markdown.charCodeAt(rawEndOffset - 1) === 13
        ? rawEndOffset - 1
        : rawEndOffset;
    lines.push({
      text: markdown.slice(startOffset, endOffset),
      startOffset,
      endOffset,
    });

    if (lineBreakIndex === -1) {
      break;
    }

    startOffset = lineBreakIndex + 1;
  }

  return lines;
};

const isBlankLine = (line: MarkdownLine) => line.text.trim().length === 0;

const startsStructuralBlock = (line: MarkdownLine, nextLine?: MarkdownLine) =>
  isBlankLine(line) ||
  fenceLinePattern.test(line.text) ||
  headingLinePattern.test(line.text) ||
  thematicLinePattern.test(line.text) ||
  blockquoteLinePattern.test(line.text) ||
  listLinePattern.test(line.text) ||
  htmlLinePattern.test(line.text) ||
  isTableStart(line, nextLine);

const isTableStart = (line: MarkdownLine, nextLine?: MarkdownLine) =>
  Boolean(nextLine && line.text.includes("|") && tableSeparatorPattern.test(nextLine.text));

const estimateBlockHeight = (kind: PreviewBlockKind, lineCount: number) => {
  if (kind === "blank") {
    return Math.max(16, lineCount * DEFAULT_LINE_HEIGHT * 0.72);
  }

  if (kind === "fence") {
    return Math.max(54, lineCount * CODE_LINE_HEIGHT + 34);
  }

  if (kind === "heading") {
    return DEFAULT_LINE_HEIGHT + HEADING_EXTRA_HEIGHT;
  }

  if (kind === "table") {
    return Math.max(52, lineCount * DEFAULT_LINE_HEIGHT + 20);
  }

  return Math.max(DEFAULT_LINE_HEIGHT, lineCount * DEFAULT_LINE_HEIGHT) + BLOCK_GAP_HEIGHT;
};

const createBlock = (
  lines: MarkdownLine[],
  startIndex: number,
  endIndex: number,
  kind: PreviewBlockKind,
  estimatedTop: number,
): PreviewBlock => {
  const startLine = startIndex + 1;
  const endLine = endIndex + 1;
  const startOffset = lines[startIndex]?.startOffset ?? 0;
  const endOffset = lines[endIndex]?.endOffset ?? startOffset;
  const text = lines
    .slice(startIndex, endIndex + 1)
    .map((line) => line.text)
    .join("\n");
  const estimatedHeight = estimateBlockHeight(kind, endLine - startLine + 1);

  return {
    id: `${startLine}:${endLine}:${startOffset}`,
    kind,
    text,
    startLine,
    endLine,
    startOffset,
    endOffset,
    estimatedTop,
    estimatedHeight,
  };
};

const findParagraphTextChunkEnd = (text: string, startOffset: number) => {
  const preferredEnd = Math.min(text.length, startOffset + PREVIEW_PARAGRAPH_CHAR_CHUNK_SIZE);
  if (preferredEnd >= text.length) {
    return text.length;
  }

  const searchEnd = Math.min(text.length, preferredEnd + 600);
  for (let index = preferredEnd; index < searchEnd; index += 1) {
    const character = text.charCodeAt(index);
    if (character === 32 || character === 9) {
      return index + 1;
    }
  }

  return preferredEnd;
};

const createParagraphTextChunkBlock = (
  line: MarkdownLine,
  lineIndex: number,
  chunkStart: number,
  chunkEnd: number,
  estimatedTop: number,
): PreviewBlock => {
  const startLine = lineIndex + 1;
  const startOffset = line.startOffset + chunkStart;
  const endOffset = line.startOffset + chunkEnd;
  const text = line.text.slice(chunkStart, chunkEnd);
  const estimatedLineCount = Math.max(1, Math.ceil(text.length / PREVIEW_PARAGRAPH_ESTIMATED_CHARS_PER_LINE));
  const estimatedHeight = estimateBlockHeight("paragraph", estimatedLineCount);

  return {
    id: `${startLine}:${startLine}:${startOffset}:${endOffset}`,
    kind: "paragraph",
    text,
    startLine,
    endLine: startLine,
    startOffset,
    endOffset,
    estimatedTop,
    estimatedHeight,
  };
};

const createParagraphBlocks = (
  lines: MarkdownLine[],
  startIndex: number,
  endIndex: number,
  estimatedTop: number,
): { blocks: PreviewBlock[]; estimatedTop: number } => {
  const blocks: PreviewBlock[] = [];

  if (startIndex === endIndex && lines[startIndex].text.length > PREVIEW_PARAGRAPH_CHAR_CHUNK_SIZE) {
    const line = lines[startIndex];
    let chunkStart = 0;
    let nextEstimatedTop = estimatedTop;
    while (chunkStart < line.text.length) {
      const chunkEnd = findParagraphTextChunkEnd(line.text, chunkStart);
      const block = createParagraphTextChunkBlock(line, startIndex, chunkStart, chunkEnd, nextEstimatedTop);
      blocks.push(block);
      nextEstimatedTop += block.estimatedHeight;
      chunkStart = chunkEnd;
    }
    return { blocks, estimatedTop: nextEstimatedTop };
  }

  let chunkStartIndex = startIndex;
  let nextEstimatedTop = estimatedTop;
  while (chunkStartIndex <= endIndex) {
    const chunkEndIndex = Math.min(endIndex, chunkStartIndex + PREVIEW_PARAGRAPH_LINE_CHUNK_SIZE - 1);
    const block = createBlock(lines, chunkStartIndex, chunkEndIndex, "paragraph", nextEstimatedTop);
    blocks.push(block);
    nextEstimatedTop += block.estimatedHeight;
    chunkStartIndex = chunkEndIndex + 1;
  }

  return { blocks, estimatedTop: nextEstimatedTop };
};

const findFenceEnd = (lines: MarkdownLine[], startIndex: number) => {
  const openingMatch = lines[startIndex]?.text.match(fenceLinePattern);
  if (!openingMatch) {
    return startIndex;
  }

  const marker = openingMatch[1];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const closingMatch = lines[index].text.match(fenceLinePattern);
    if (closingMatch && closingMatch[1][0] === marker[0] && closingMatch[1].length >= marker.length) {
      return index;
    }
  }

  return lines.length - 1;
};

const findHtmlEnd = (lines: MarkdownLine[], startIndex: number) => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (isBlankLine(lines[index])) {
      return index - 1;
    }
  }
  return lines.length - 1;
};

const findListEnd = (lines: MarkdownLine[], startIndex: number) => {
  let sawBlank = false;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isBlankLine(line)) {
      sawBlank = true;
      continue;
    }
    if (listLinePattern.test(line.text) || indentedContinuationPattern.test(line.text)) {
      sawBlank = false;
      continue;
    }
    return sawBlank ? index - 2 : index - 1;
  }
  return lines.length - 1;
};

const findBlockquoteEnd = (lines: MarkdownLine[], startIndex: number) => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (isBlankLine(lines[index])) {
      return index - 1;
    }
    if (!blockquoteLinePattern.test(lines[index].text)) {
      return index - 1;
    }
  }
  return lines.length - 1;
};

const findTableEnd = (lines: MarkdownLine[], startIndex: number) => {
  for (let index = startIndex + 2; index < lines.length; index += 1) {
    if (!lines[index].text.includes("|") || isBlankLine(lines[index])) {
      return index - 1;
    }
  }
  return lines.length - 1;
};

const findParagraphEnd = (lines: MarkdownLine[], startIndex: number) => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (startsStructuralBlock(lines[index], lines[index + 1])) {
      return index - 1;
    }
  }
  return lines.length - 1;
};

const resolveBlockRange = (lines: MarkdownLine[], startIndex: number) => {
  const line = lines[startIndex];
  const nextLine = lines[startIndex + 1];

  if (isBlankLine(line)) {
    let endIndex = startIndex;
    while (endIndex + 1 < lines.length && isBlankLine(lines[endIndex + 1])) {
      endIndex += 1;
    }
    return { endIndex, kind: "blank" as const };
  }

  if (fenceLinePattern.test(line.text)) {
    return { endIndex: findFenceEnd(lines, startIndex), kind: "fence" as const };
  }

  if (isTableStart(line, nextLine)) {
    return { endIndex: findTableEnd(lines, startIndex), kind: "table" as const };
  }

  if (headingLinePattern.test(line.text)) {
    return { endIndex: startIndex, kind: "heading" as const };
  }

  if (thematicLinePattern.test(line.text)) {
    return { endIndex: startIndex, kind: "thematic" as const };
  }

  if (blockquoteLinePattern.test(line.text)) {
    return { endIndex: findBlockquoteEnd(lines, startIndex), kind: "blockquote" as const };
  }

  if (listLinePattern.test(line.text)) {
    return { endIndex: findListEnd(lines, startIndex), kind: "list" as const };
  }

  if (htmlLinePattern.test(line.text)) {
    return { endIndex: findHtmlEnd(lines, startIndex), kind: "html" as const };
  }

  return { endIndex: findParagraphEnd(lines, startIndex), kind: "paragraph" as const };
};

export const createPreviewBlockIndex = (markdown: string): PreviewBlockIndex => {
  const lines = splitMarkdownLines(markdown);
  const blocks: PreviewBlock[] = [];
  let lineIndex = 0;
  let estimatedTop = 0;

  while (lineIndex < lines.length) {
    const { endIndex, kind } = resolveBlockRange(lines, lineIndex);
    const safeEndIndex = Math.max(lineIndex, Math.min(endIndex, lines.length - 1));
    if (kind === "paragraph") {
      const paragraphBlocks = createParagraphBlocks(lines, lineIndex, safeEndIndex, estimatedTop);
      blocks.push(...paragraphBlocks.blocks);
      estimatedTop = paragraphBlocks.estimatedTop;
      lineIndex = safeEndIndex + 1;
      continue;
    }

    const block = createBlock(lines, lineIndex, safeEndIndex, kind, estimatedTop);
    blocks.push(block);
    estimatedTop += block.estimatedHeight;
    lineIndex = safeEndIndex + 1;
  }

  return {
    blocks,
    lineCount: lines.length,
    totalEstimatedHeight: estimatedTop,
  };
};

export const applyPreviewBlockMeasurements = (
  index: PreviewBlockIndex,
  measurements: PreviewBlockMeasurements,
): PreviewBlockIndex => {
  let estimatedTop = 0;
  const blocks = index.blocks.map((block) => {
    const measuredHeight = measurements[block.id];
    const estimatedHeight =
      Number.isFinite(measuredHeight) && measuredHeight > 0
        ? measuredHeight
        : block.estimatedHeight;
    const measuredBlock =
      block.estimatedTop === estimatedTop && block.estimatedHeight === estimatedHeight
        ? block
        : {
            ...block,
            estimatedTop,
            estimatedHeight,
          };
    estimatedTop += estimatedHeight;
    return measuredBlock;
  });

  return {
    ...index,
    blocks,
    totalEstimatedHeight: estimatedTop,
  };
};

export const getPreviewWindow = (
  index: PreviewBlockIndex,
  scrollTop: number,
  viewportHeight: number,
  overscan = 1_200,
): PreviewWindow => {
  const windowTop = Math.max(0, scrollTop - overscan);
  const windowBottom = Math.max(windowTop, scrollTop + viewportHeight + overscan);
  const startIndex = Math.max(
    0,
    index.blocks.findIndex((block) => block.estimatedTop + block.estimatedHeight >= windowTop),
  );
  let endIndex = startIndex;

  while (
    endIndex < index.blocks.length &&
    index.blocks[endIndex].estimatedTop <= windowBottom
  ) {
    endIndex += 1;
  }

  return {
    blocks: index.blocks.slice(startIndex, endIndex),
    startIndex,
    endIndex,
  };
};

export const mapPreviewLineToBlock = (index: PreviewBlockIndex, lineNumber: number) =>
  index.blocks.find((block) => block.startLine <= lineNumber && block.endLine >= lineNumber) ?? null;
