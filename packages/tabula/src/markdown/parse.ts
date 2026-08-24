import { isMap, isScalar, parseDocument, stringify } from "yaml";

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

type MarkdownFence = {
  character: string;
  length: number;
};

const frontmatterOpeningDelimiterPattern = /^---\s*$/;
const frontmatterClosingDelimiterPattern = /^(?:---|\.\.\.)\s*$/;

const getOpeningMarkdownFence = (line: string): MarkdownFence | null => {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (!match || (match[1][0] === "`" && match[2].includes("`"))) {
    return null;
  }

  return {
    character: match[1][0],
    length: match[1].length,
  };
};

const closesMarkdownFence = (line: string, fence: MarkdownFence) => {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})[\t ]*$/);
  return Boolean(
    match
      && match[1][0] === fence.character
      && match[1].length >= fence.length,
  );
};

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
        rawStart,
        closingStart: cursor,
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

export type FrontmatterValueUpdate =
  | { ok: true; markdown: string }
  | { ok: false; reason: "duplicate_key" | "invalid_frontmatter" | "invalid_key" | "missing_key" };

const stringifyFrontmatterValue = (value: unknown) => stringify(value, {
  collectionStyle: "flow",
  lineWidth: 0,
}).replace(/\n$/, "");

const normalizeFrontmatterKey = (key: string) => {
  const normalized = key.trim();
  return normalized && !/[\r\n]/.test(normalized) ? normalized : null;
};

const stringifyFrontmatterKey = (key: string) => stringify(key, {
  collectionStyle: "flow",
  lineWidth: 0,
}).replace(/\n$/, "");

export const updateFrontmatterValue = (
  markdown: string,
  key: string,
  value: unknown,
): FrontmatterValueUpdate => {
  const frontmatterBlock = getFrontmatterBlock(markdown);
  if (!frontmatterBlock) return { ok: false, reason: "invalid_frontmatter" };

  const document = parseDocument(frontmatterBlock.rawFrontmatter, { prettyErrors: false });
  if (document.errors.length > 0 || !isMap(document.contents) || !document.has(key)) {
    return {
      ok: false,
      reason: document.has(key) ? "invalid_frontmatter" : "missing_key",
    };
  }

  const valueNode = document.get(key, true) as { range?: readonly number[] } | undefined;
  if (!valueNode || !valueNode.range) return { ok: false, reason: "missing_key" };
  const serializedValue = stringifyFrontmatterValue(value);
  const serialized = `${frontmatterBlock.rawFrontmatter.slice(0, valueNode.range[0])}${serializedValue}${frontmatterBlock.rawFrontmatter.slice(valueNode.range[1])}`;
  const lineBreak = markdown.includes("\r\n") ? "\r\n" : "\n";
  return {
    ok: true,
    markdown: `${markdown.slice(0, frontmatterBlock.rawStart)}${serialized}${lineBreak}${markdown.slice(frontmatterBlock.closingStart)}`,
  };
};

export const addFrontmatterValue = (
  markdown: string,
  key: string,
  value: unknown,
): FrontmatterValueUpdate => {
  const normalizedKey = normalizeFrontmatterKey(key);
  if (!normalizedKey) {
    return { ok: false, reason: "invalid_key" };
  }
  const frontmatterBlock = getFrontmatterBlock(markdown);
  if (!frontmatterBlock) return { ok: false, reason: "invalid_frontmatter" };
  const document = parseDocument(frontmatterBlock.rawFrontmatter, { prettyErrors: false });
  if (
    document.errors.length > 0 ||
    (document.contents !== null && !isMap(document.contents))
  ) {
    return { ok: false, reason: "invalid_frontmatter" };
  }
  if (isMap(document.contents) && document.has(normalizedKey)) {
    return { ok: false, reason: "duplicate_key" };
  }

  const lineBreak = markdown.includes("\r\n") ? "\r\n" : "\n";
  const inserted = `${stringifyFrontmatterKey(normalizedKey)}: ${stringifyFrontmatterValue(value)}${lineBreak}`;
  return {
    ok: true,
    markdown: `${markdown.slice(0, frontmatterBlock.closingStart)}${inserted}${markdown.slice(frontmatterBlock.closingStart)}`,
  };
};

export const renameFrontmatterKey = (
  markdown: string,
  key: string,
  nextKey: string,
): FrontmatterValueUpdate => {
  const normalizedKey = normalizeFrontmatterKey(nextKey);
  if (!normalizedKey) {
    return { ok: false, reason: "invalid_key" };
  }
  const frontmatterBlock = getFrontmatterBlock(markdown);
  if (!frontmatterBlock) return { ok: false, reason: "invalid_frontmatter" };
  const document = parseDocument(frontmatterBlock.rawFrontmatter, { prettyErrors: false });
  if (document.errors.length > 0 || !isMap(document.contents)) {
    return { ok: false, reason: "invalid_frontmatter" };
  }
  if (normalizedKey !== key && document.has(normalizedKey)) {
    return { ok: false, reason: "duplicate_key" };
  }
  const pair = document.contents.items.find((item) => isScalar(item.key) && item.key.value === key);
  if (!pair || !isScalar(pair.key) || !pair.key.range) {
    return { ok: false, reason: "missing_key" };
  }
  const [from, to] = pair.key.range;
  const raw = `${frontmatterBlock.rawFrontmatter.slice(0, from)}${stringifyFrontmatterKey(normalizedKey)}${frontmatterBlock.rawFrontmatter.slice(to)}`;
  const lineBreak = markdown.includes("\r\n") ? "\r\n" : "\n";
  return {
    ok: true,
    markdown: `${markdown.slice(0, frontmatterBlock.rawStart)}${raw}${lineBreak}${markdown.slice(frontmatterBlock.closingStart)}`,
  };
};

export const removeFrontmatterValue = (
  markdown: string,
  key: string,
): FrontmatterValueUpdate => {
  const frontmatterBlock = getFrontmatterBlock(markdown);
  if (!frontmatterBlock) return { ok: false, reason: "invalid_frontmatter" };
  const document = parseDocument(frontmatterBlock.rawFrontmatter, { prettyErrors: false });
  if (document.errors.length > 0 || !isMap(document.contents)) {
    return { ok: false, reason: "invalid_frontmatter" };
  }
  const index = document.contents.items.findIndex((item) => isScalar(item.key) && item.key.value === key);
  const pair = document.contents.items[index];
  if (!pair || !isScalar(pair.key) || !pair.key.range) {
    return { ok: false, reason: "missing_key" };
  }
  const nextPair = document.contents.items[index + 1];
  const from = pair.key.range[0];
  const to = nextPair && isScalar(nextPair.key) && nextPair.key.range
    ? nextPair.key.range[0]
    : frontmatterBlock.rawFrontmatter.length;
  const raw = `${frontmatterBlock.rawFrontmatter.slice(0, from)}${frontmatterBlock.rawFrontmatter.slice(to)}`.replace(/\r?\n$/, "");
  const lineBreak = markdown.includes("\r\n") ? "\r\n" : "\n";
  return {
    ok: true,
    markdown: `${markdown.slice(0, frontmatterBlock.rawStart)}${raw}${raw ? lineBreak : ""}${markdown.slice(frontmatterBlock.closingStart)}`,
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

const collectOutlineHeadings = (
  markdown: string,
  sourceLineOffset: number,
): MarkdownHeading[] => {
  const headings: MarkdownHeading[] = [];
  let openFence: MarkdownFence | null = null;
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
    const match = openFence ? null : line.match(/^(#{1,3})\s+(.+)$/);

    if (openFence) {
      if (closesMarkdownFence(line, openFence)) {
        openFence = null;
      }
    } else {
      openFence = getOpeningMarkdownFence(line);
    }

    if (!openFence && match) {
      const text = match[2].replace(/\s+#+\s*$/, "").trim();
      if (text) {
        headings.push({
          depth: match[1].length,
          text,
          lineIndex,
          sourceLineIndex: lineIndex + sourceLineOffset,
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

export const getOutlineHeadings = (previewBody: PreviewBody): MarkdownHeading[] =>
  collectOutlineHeadings(previewBody.body, previewBody.sourceLineOffset);

export const getOutlineHeadingsFromMarkdown = (markdown: string): MarkdownHeading[] =>
  collectOutlineHeadings(markdown, 0);

export const getLineStartOffset = (markdown: string, targetLineIndex: number) => {
  const lines = markdown.split("\n");
  let offset = 0;

  for (let index = 0; index < targetLineIndex; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1;
  }

  return offset;
};

export const getLineNumberForOffset = (content: string, offset: number) => content.slice(0, offset).split("\n").length;
