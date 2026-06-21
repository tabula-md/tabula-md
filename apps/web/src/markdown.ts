export type ParsedFrontmatter = {
  attributes: Array<{ key: string; value: string }>;
  body: string;
};

export type PreviewBody = {
  body: string;
  sourceLineOffset: number;
};

export type MarkdownHeading = {
  depth: number;
  text: string;
  lineIndex: number;
  sourceLineIndex: number;
};

export type SearchMatch = {
  start: number;
  end: number;
  preview: string;
};

const cleanFrontmatterValue = (value: string) => value.trim().replace(/^["']|["']$/g, "");

const formatInlineFrontmatterValue = (value: string) => {
  const cleanedValue = cleanFrontmatterValue(value);
  if (cleanedValue.startsWith("[") && cleanedValue.endsWith("]")) {
    return cleanedValue
      .slice(1, -1)
      .split(",")
      .map((item) => cleanFrontmatterValue(item))
      .filter(Boolean)
      .join(", ");
  }

  if (cleanedValue.startsWith("{") && cleanedValue.endsWith("}")) {
    return cleanedValue
      .slice(1, -1)
      .split(",")
      .map((entry) => {
        const separatorIndex = entry.indexOf(":");
        if (separatorIndex === -1) {
          return cleanFrontmatterValue(entry);
        }

        const key = cleanFrontmatterValue(entry.slice(0, separatorIndex));
        const nestedValue = cleanFrontmatterValue(entry.slice(separatorIndex + 1));
        return `${key}: ${nestedValue}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  return cleanedValue;
};

const parseIndentedFrontmatterBlock = (lines: string[]) => {
  const trimmedLines = lines.map((line) => line.trim()).filter(Boolean);
  if (trimmedLines.length === 0) {
    return "";
  }

  if (trimmedLines.every((line) => line.startsWith("- "))) {
    return trimmedLines.map((line) => cleanFrontmatterValue(line.slice(2))).join(", ");
  }

  if (trimmedLines.every((line) => line.includes(":"))) {
    return trimmedLines
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        const key = line.slice(0, separatorIndex).trim();
        const value = formatInlineFrontmatterValue(line.slice(separatorIndex + 1));
        return value ? `${key}: ${value}` : key;
      })
      .join("\n");
  }

  return trimmedLines.map(cleanFrontmatterValue).join(" ");
};

const frontmatterOpeningDelimiterPattern = /^---\s*$/;
const frontmatterClosingDelimiterPattern = /^(?:---|\.\.\.)\s*$/;
const frontmatterKeyPattern = /^[A-Za-z_][A-Za-z0-9_.-]*(?:\s+[A-Za-z_][A-Za-z0-9_.-]*)*$/;

const getLineBreakLength = (text: string, lineBreakIndex: number) =>
  text.startsWith("\r\n", lineBreakIndex) ? 2 : 1;

const getFrontmatterBlock = (markdown: string) => {
  const firstLineBreakIndex = markdown.search(/\r?\n/);
  if (firstLineBreakIndex === -1) {
    return null;
  }

  const firstLine = markdown.slice(0, firstLineBreakIndex);
  if (!frontmatterOpeningDelimiterPattern.test(firstLine)) {
    return null;
  }

  const rawStart = firstLineBreakIndex + getLineBreakLength(markdown, firstLineBreakIndex);
  let cursor = rawStart;

  while (cursor < markdown.length) {
    const nextLineBreakIndex = markdown.indexOf("\n", cursor);
    const lineEnd =
      nextLineBreakIndex === -1
        ? markdown.length
        : markdown[nextLineBreakIndex - 1] === "\r"
          ? nextLineBreakIndex - 1
          : nextLineBreakIndex;
    const line = markdown.slice(cursor, lineEnd);

    if (frontmatterClosingDelimiterPattern.test(line)) {
      const bodyStart = nextLineBreakIndex === -1 ? markdown.length : nextLineBreakIndex + 1;
      return {
        rawFrontmatter: markdown.slice(rawStart, cursor).replace(/\r?\n$/, ""),
        body: markdown.slice(bodyStart).replace(/^(?:\r?\n)+/, ""),
      };
    }

    if (nextLineBreakIndex === -1) {
      break;
    }
    cursor = nextLineBreakIndex + 1;
  }

  return null;
};

export const getPreviewBody = (body: string): PreviewBody => ({ body, sourceLineOffset: 0 });

export const parseFrontmatter = (markdown: string): ParsedFrontmatter => {
  const frontmatterBlock = getFrontmatterBlock(markdown);
  if (!frontmatterBlock) {
    return { attributes: [], body: markdown };
  }

  const rawFrontmatter = frontmatterBlock.rawFrontmatter.trim();
  const hasKeyValueLine = rawFrontmatter
    .split(/\r?\n/)
    .some((line) => frontmatterKeyPattern.test(line.slice(0, line.indexOf(":")).trim()) && line.includes(":"));
  if (!hasKeyValueLine) {
    return { attributes: [], body: markdown };
  }

  const attributes: ParsedFrontmatter["attributes"] = [];
  const lines = rawFrontmatter.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      if (!frontmatterKeyPattern.test(trimmedLine)) {
        return { attributes: [], body: markdown };
      }
      attributes.push({ key: trimmedLine, value: "" });
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!frontmatterKeyPattern.test(key)) {
      return { attributes: [], body: markdown };
    }
    let value = line.slice(separatorIndex + 1).trim();

    if (value === "|" || value === ">") {
      const blockLines: string[] = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        blockLines.push(lines[index].replace(/^\s{2}/, ""));
      }
      value = blockLines.join(value === ">" ? " " : "\n");
    } else if (!value && index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
      const nestedLines: string[] = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        nestedLines.push(lines[index]);
      }
      value = parseIndentedFrontmatterBlock(nestedLines);
    } else {
      const continuationLines: string[] = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        continuationLines.push(lines[index].trim());
      }
      if (continuationLines.length > 0) {
        value = [value, ...continuationLines].join(" ");
      }
    }

    attributes.push({
      key,
      value: formatInlineFrontmatterValue(value),
    });
  }

  return { attributes, body: frontmatterBlock.body };
};

export const getOutlineHeadings = (previewBody: PreviewBody): MarkdownHeading[] => {
  return previewBody.body
    .split("\n")
    .map((line, lineIndex) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (!match) {
        return null;
      }

      return {
        depth: match[1].length,
        text: match[2].replace(/\s+#+\s*$/, "").trim(),
        lineIndex,
        sourceLineIndex: lineIndex + previewBody.sourceLineOffset,
      };
    })
    .filter((heading): heading is MarkdownHeading => Boolean(heading?.text));
};

export const getSearchMatches = (text: string, query: string): SearchMatch[] => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  const matches: SearchMatch[] = [];
  let fromIndex = 0;
  const searchableText = text.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();

  while (fromIndex < searchableText.length) {
    const foundIndex = searchableText.indexOf(lowerQuery, fromIndex);
    if (foundIndex === -1) {
      break;
    }

    const previewStart = Math.max(0, foundIndex - 28);
    const previewEnd = Math.min(text.length, foundIndex + normalizedQuery.length + 40);
    matches.push({
      start: foundIndex,
      end: foundIndex + normalizedQuery.length,
      preview: text.slice(previewStart, previewEnd).replace(/\s+/g, " ").trim(),
    });
    fromIndex = foundIndex + Math.max(normalizedQuery.length, 1);
  }

  return matches;
};

export const getLineStartOffset = (markdown: string, targetLineIndex: number) => {
  const lines = markdown.split("\n");
  let offset = 0;

  for (let index = 0; index < targetLineIndex; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1;
  }

  return offset;
};

export const getLineNumberForOffset = (content: string, offset: number) => content.slice(0, offset).split("\n").length;
