import { isMap, isScalar, parseDocument } from "yaml";

export type ParsedFrontmatter = {
  attributes: { key: string; value: string }[];
  body: string;
};

export type ParsedFrontmatterData = {
  metadata: Record<string, unknown>;
  body: string;
  bodyOffset: number;
};

export type FrontmatterInspection = ParsedFrontmatterData & {
  status: "absent" | "valid" | "invalid";
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

const frontmatterOpeningDelimiterPattern = /^---\s*$/;
const frontmatterClosingDelimiterPattern = /^(?:---|\.\.\.)\s*$/;

const getLineBreakLength = (text: string, lineBreakIndex: number) =>
  text.startsWith("\r\n", lineBreakIndex) ? 2 : 1;

const formatYamlMetadataValue = (value: unknown): string => {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(formatYamlMetadataValue).join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${key}: ${formatYamlMetadataValue(nestedValue)}`)
      .join("\n");
  }

  return String(value).replace(/\n$/, "");
};

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
        body: markdown.slice(bodyStart),
        bodyOffset: bodyStart,
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

export const inspectFrontmatterData = (markdown: string): FrontmatterInspection => {
  const frontmatterBlock = getFrontmatterBlock(markdown);
  if (!frontmatterBlock) {
    return {
      status: frontmatterOpeningDelimiterPattern.test(markdown.split(/\r?\n/, 1)[0] ?? "")
        ? "invalid"
        : "absent",
      metadata: {},
      body: markdown,
      bodyOffset: 0,
    };
  }

  const document = parseDocument(frontmatterBlock.rawFrontmatter, { prettyErrors: false });
  if (document.errors.length > 0) {
    return { status: "invalid", metadata: {}, body: markdown, bodyOffset: 0 };
  }
  if (document.contents === null) {
    return {
      status: "valid",
      metadata: {},
      body: frontmatterBlock.body,
      bodyOffset: frontmatterBlock.bodyOffset,
    };
  }
  if (!isMap(document.contents)) {
    return { status: "invalid", metadata: {}, body: markdown, bodyOffset: 0 };
  }

  const entries: [string, unknown][] = [];
  for (const item of document.contents.items) {
    if (!isScalar(item.key)) {
      return { status: "invalid", metadata: {}, body: markdown, bodyOffset: 0 };
    }

    const key = formatYamlMetadataValue(item.key.value).trim();
    if (!key) {
      return { status: "invalid", metadata: {}, body: markdown, bodyOffset: 0 };
    }

    entries.push([key, item.value?.toJSON() ?? null]);
  }

  return {
    status: "valid",
    metadata: Object.fromEntries(entries),
    body: frontmatterBlock.body,
    bodyOffset: frontmatterBlock.bodyOffset,
  };
};

export const parseFrontmatterData = (markdown: string): ParsedFrontmatterData => {
  const inspected = inspectFrontmatterData(markdown);
  return inspected.status === "valid" && Object.keys(inspected.metadata).length > 0
    ? {
        metadata: inspected.metadata,
        body: inspected.body,
        bodyOffset: inspected.bodyOffset,
      }
    : { metadata: {}, body: markdown, bodyOffset: 0 };
};

export const parseFrontmatter = (markdown: string): ParsedFrontmatter => {
  const parsed = parseFrontmatterData(markdown);
  return {
    attributes: Object.entries(parsed.metadata).map(([key, value]) => ({
      key,
      value: formatYamlMetadataValue(value),
    })),
    body: parsed.body,
  };
};

export const getMarkdownDocumentTitle = (markdown: string) => {
  const parsed = parseFrontmatter(markdown);
  const metadataTitle = parsed.attributes
    .find((attribute) => attribute.key.toLowerCase() === "title")
    ?.value.trim();

  if (metadataTitle) {
    return metadataTitle;
  }

  const headingTitle = parsed.body.match(/^#{1,2}\s+(.+?)\s*#*\s*$/m)?.[1]?.trim();
  return headingTitle || "";
};

export const getOutlineHeadings = (previewBody: PreviewBody): MarkdownHeading[] =>
  previewBody.body
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

export const getOutlineHeadingsFromMarkdown = (markdown: string): MarkdownHeading[] => {
  const headings: MarkdownHeading[] = [];
  let lineIndex = 0;
  let lineStart = 0;

  while (lineStart <= markdown.length) {
    const lineBreakIndex = markdown.indexOf("\n", lineStart);
    const lineEnd =
      lineBreakIndex === -1
        ? markdown.length
        : markdown[lineBreakIndex - 1] === "\r"
          ? lineBreakIndex - 1
          : lineBreakIndex;
    const line = markdown.slice(lineStart, lineEnd);
    const match = line.match(/^(#{1,3})\s+(.+)$/);

    if (match) {
      const text = match[2].replace(/\s+#+\s*$/, "").trim();
      if (text) {
        headings.push({
          depth: match[1].length,
          text,
          lineIndex,
          sourceLineIndex: lineIndex,
        });
      }
    }

    if (lineBreakIndex === -1) {
      break;
    }

    lineIndex += 1;
    lineStart = lineBreakIndex + 1;
  }

  return headings;
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
