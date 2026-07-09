import { applyTextPatches, type TextPatch } from "../textPatches";

export type SearchMatch = {
  start: number;
  end: number;
  preview: string;
};

export type MarkdownSearchReplaceSelection = {
  from: number;
  to: number;
};

export type MarkdownSearchReplaceEdit = {
  text: string;
  patches: TextPatch[];
  selection: MarkdownSearchReplaceSelection;
  replacedCount: number;
};

const getNormalizedSearchQuery = (query: string) => query.trim();

export const getSearchMatches = (text: string, query: string): SearchMatch[] => {
  const normalizedQuery = getNormalizedSearchQuery(query);
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

const createSearchReplacementEdit = (
  text: string,
  patches: TextPatch[],
  selection: MarkdownSearchReplaceSelection,
): MarkdownSearchReplaceEdit | null => {
  if (patches.length === 0) {
    return null;
  }

  const nextText = applyTextPatches(text, patches);
  if (nextText === null || nextText === text) {
    return null;
  }

  return {
    text: nextText,
    patches,
    selection,
    replacedCount: patches.length,
  };
};

export const replaceCurrentSearchMatch = (
  text: string,
  query: string,
  replacement: string,
  activeMatchIndex: number,
): MarkdownSearchReplaceEdit | null => {
  const matches = getSearchMatches(text, query);
  if (matches.length === 0) {
    return null;
  }

  const match = matches[Math.max(0, Math.min(activeMatchIndex, matches.length - 1))];
  const patch = {
    from: match.start,
    to: match.end,
    insert: replacement,
  };

  return createSearchReplacementEdit(text, [patch], {
    from: patch.from,
    to: patch.from + replacement.length,
  });
};

export const replaceAllSearchMatches = (
  text: string,
  query: string,
  replacement: string,
): MarkdownSearchReplaceEdit | null => {
  const patches = getSearchMatches(text, query)
    .map((match) => ({
      from: match.start,
      to: match.end,
      insert: replacement,
    }))
    .filter((patch) => text.slice(patch.from, patch.to) !== patch.insert);

  const firstPatch = patches[0];
  if (!firstPatch) {
    return null;
  }

  return createSearchReplacementEdit(text, patches, {
    from: firstPatch.from,
    to: firstPatch.from + replacement.length,
  });
};
