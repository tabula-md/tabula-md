import { isMap, parseDocument } from "yaml";
import { inspectFrontmatterData } from "./markdown/parse";
import type { TextPatch } from "./textPatches";

export type OkfConceptTypeUpdateFailure = {
  ok: false;
  reason: "empty_type" | "invalid_frontmatter";
};

export type OkfConceptTypeUpdateSuccess = {
  ok: true;
  changed: boolean;
  markdown: string;
  patches: readonly TextPatch[];
};

export type OkfConceptTypeUpdateResult =
  | OkfConceptTypeUpdateFailure
  | OkfConceptTypeUpdateSuccess;

type FrontmatterSource = {
  raw: string;
  rawStart: number;
  rawEnd: number;
  newline: "\n" | "\r\n";
};

const frontmatterClosingDelimiterPattern = /^(?:---|\.\.\.)\s*$/;

const getFrontmatterSource = (markdown: string): FrontmatterSource | null => {
  const openingLineEnd = markdown.indexOf("\n");
  if (openingLineEnd === -1) return null;
  const newline = markdown[openingLineEnd - 1] === "\r" ? "\r\n" : "\n";
  const rawStart = openingLineEnd + 1;
  let cursor = rawStart;

  while (cursor < markdown.length) {
    const nextLineBreak = markdown.indexOf("\n", cursor);
    const lineEnd = nextLineBreak === -1
      ? markdown.length
      : markdown[nextLineBreak - 1] === "\r"
        ? nextLineBreak - 1
        : nextLineBreak;
    if (frontmatterClosingDelimiterPattern.test(markdown.slice(cursor, lineEnd))) {
      return {
        raw: markdown.slice(rawStart, cursor),
        rawStart,
        rawEnd: cursor,
        newline,
      };
    }
    if (nextLineBreak === -1) return null;
    cursor = nextLineBreak + 1;
  }

  return null;
};

const serializeTypeFrontmatter = (
  rawFrontmatter: string,
  type: string,
  newline: "\n" | "\r\n",
) => {
  const document = parseDocument(rawFrontmatter, { prettyErrors: false });
  if (
    document.errors.length > 0 ||
    (document.contents !== null && !isMap(document.contents))
  ) {
    return null;
  }
  document.set("type", type);
  const serialized = document.toString({ lineWidth: 0 });
  return newline === "\n" ? serialized : serialized.replace(/\n/g, "\r\n");
};

export const setOkfConceptType = (
  markdown: string,
  conceptType: string,
): OkfConceptTypeUpdateResult => {
  const type = conceptType.trim();
  if (!type) return { ok: false, reason: "empty_type" };

  const inspection = inspectFrontmatterData(markdown);
  if (inspection.status === "invalid") {
    return { ok: false, reason: "invalid_frontmatter" };
  }

  if (inspection.status === "absent") {
    const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
    const serialized = serializeTypeFrontmatter("", type, newline);
    if (serialized === null) return { ok: false, reason: "invalid_frontmatter" };
    const insert = `---${newline}${serialized}---${newline}${markdown ? newline : ""}`;
    return {
      ok: true,
      changed: true,
      markdown: `${insert}${markdown}`,
      patches: [{ from: 0, to: 0, insert }],
    };
  }

  const source = getFrontmatterSource(markdown);
  if (!source) return { ok: false, reason: "invalid_frontmatter" };
  const serialized = serializeTypeFrontmatter(source.raw, type, source.newline);
  if (serialized === null) return { ok: false, reason: "invalid_frontmatter" };
  if (serialized === source.raw) {
    return { ok: true, changed: false, markdown, patches: [] };
  }
  const patch = { from: source.rawStart, to: source.rawEnd, insert: serialized };
  return {
    ok: true,
    changed: true,
    markdown: `${markdown.slice(0, patch.from)}${patch.insert}${markdown.slice(patch.to)}`,
    patches: [patch],
  };
};
