import { isMap, parseDocument } from "yaml";
import { inspectFrontmatterData } from "./markdown/parse";
import type { TextPatch } from "./textPatches";
import type { OkfActorEvent } from "./workspaceOkfMetadata";

export type OkfVerificationUpdateFailure = {
  ok: false;
  reason:
    | "empty_actor"
    | "invalid_frontmatter"
    | "invalid_timestamp"
    | "invalid_verified";
};

export type OkfVerificationUpdateSuccess = {
  ok: true;
  markdown: string;
  patches: readonly TextPatch[];
  verification: OkfActorEvent;
};

export type OkfVerificationUpdateResult =
  | OkfVerificationUpdateFailure
  | OkfVerificationUpdateSuccess;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isActorEvent = (value: unknown): value is OkfActorEvent =>
  isRecord(value)
  && typeof value.by === "string"
  && Boolean(value.by.trim())
  && typeof value.at === "string"
  && Boolean(value.at.trim());

const getExistingVerifications = (value: unknown) => {
  if (typeof value === "undefined") return [];
  const values = Array.isArray(value) ? value : [value];
  return values.every(isActorEvent)
    ? values.map((event) => ({ by: event.by.trim(), at: event.at.trim() }))
    : null;
};

export const appendOkfVerification = (
  markdown: string,
  verifiedBy: string,
  verifiedAt = new Date().toISOString(),
): OkfVerificationUpdateResult => {
  const actor = verifiedBy.trim();
  if (!actor) return { ok: false, reason: "empty_actor" };
  if (!Number.isFinite(Date.parse(verifiedAt))) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const inspection = inspectFrontmatterData(markdown);
  if (inspection.status !== "valid") {
    return { ok: false, reason: "invalid_frontmatter" };
  }
  const source = getFrontmatterSource(markdown);
  if (!source) return { ok: false, reason: "invalid_frontmatter" };

  const document = parseDocument(source.raw, { prettyErrors: false });
  if (
    document.errors.length > 0
    || document.contents === null
    || !isMap(document.contents)
  ) {
    return { ok: false, reason: "invalid_frontmatter" };
  }

  const metadata = document.toJS() as Record<string, unknown>;
  const existing = getExistingVerifications(metadata.verified);
  if (!existing) return { ok: false, reason: "invalid_verified" };

  const verification = {
    by: actor.startsWith("human:") ? actor : `human:${actor}`,
    at: new Date(verifiedAt).toISOString(),
  };
  document.set("verified", [...existing, verification]);
  const serialized = document.toString({ lineWidth: 0 });
  const insert = source.newline === "\n"
    ? serialized
    : serialized.replace(/\n/g, "\r\n");
  const patch = {
    from: source.rawStart,
    to: source.rawEnd,
    insert,
  };

  return {
    ok: true,
    markdown: `${markdown.slice(0, patch.from)}${insert}${markdown.slice(patch.to)}`,
    patches: [patch],
    verification,
  };
};
