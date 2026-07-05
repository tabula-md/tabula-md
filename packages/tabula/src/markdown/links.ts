import type { TextPatch } from "../textPatches";

export type MarkdownLink = {
  from: number;
  to: number;
  text: string;
  url: string;
  urlFrom: number;
  urlTo: number;
  isImage: boolean;
  isSafe: boolean;
};

export type MarkdownLinkUrlEdit = {
  patch: TextPatch;
  selection: {
    from: number;
    to: number;
  };
};

const markdownLinkPattern = /(!?)\[([^\]\n]*(?:\\.[^\]\n]*)*)\]\(([^)\s]+)\)/g;
const safeMarkdownLinkUrlPattern = /^(?:https?:\/\/|mailto:|\/(?!\/)|#|\.\.?\/)/i;

export const isSafeMarkdownLinkUrl = (url: string) => safeMarkdownLinkUrlPattern.test(url.trim());

export const getMarkdownLinks = (text: string): MarkdownLink[] =>
  Array.from(text.matchAll(markdownLinkPattern)).map((match) => {
    const fullMatch = match[0];
    const from = match.index ?? 0;
    const textStart = from + match[1].length + 1;
    const textEnd = textStart + match[2].length;
    const urlFrom = textEnd + 2;
    const url = match[3];
    const urlTo = urlFrom + url.length;

    return {
      from,
      to: from + fullMatch.length,
      text: match[2],
      url,
      urlFrom,
      urlTo,
      isImage: match[1] === "!",
      isSafe: isSafeMarkdownLinkUrl(url),
    };
  });

export const getMarkdownLinkAtOffset = (text: string, offset: number): MarkdownLink | null => {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  return (
    getMarkdownLinks(text).find(
      (link) => !link.isImage && safeOffset >= link.from && safeOffset <= link.to,
    ) ?? null
  );
};

export const updateMarkdownLinkUrl = (
  text: string,
  linkFrom: number,
  nextUrl: string,
): MarkdownLinkUrlEdit | null => {
  const link = getMarkdownLinks(text).find((candidate) => candidate.from === linkFrom && !candidate.isImage);
  if (!link || link.url === nextUrl) {
    return null;
  }

  return {
    patch: {
      from: link.urlFrom,
      to: link.urlTo,
      insert: nextUrl,
    },
    selection: {
      from: link.urlFrom,
      to: link.urlFrom + nextUrl.length,
    },
  };
};
