import { RegExpCursor, SearchCursor } from "@codemirror/search";
import { Text } from "@codemirror/state";
import { applyTextPatches, type TextPatch } from "@tabula-md/tabula";

export type SearchOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
};

export type SearchMatch = {
  start: number;
  end: number;
  preview: string;
};

export type SearchResult = {
  error: string | null;
  matches: SearchMatch[];
};

export type EditorSearchReplaceSelection = {
  from: number;
  to: number;
};

export type EditorSearchReplaceEdit = {
  text: string;
  patches: TextPatch[];
  selection: EditorSearchReplaceSelection;
  replacedCount: number;
};

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  regexp: false,
};

const getNormalizedSearchQuery = (query: string) => query.trim();

const createSearchDocument = (text: string | Text) =>
  typeof text === "string" ? Text.of(text.split("\n")) : text;

const searchWordCharacterPattern = /[\p{L}\p{N}_]/u;

const hasSearchWordCharacter = (value: string) => searchWordCharacterPattern.test(value);

const isSearchWordCharacter = (value: string) => value.length > 0 && searchWordCharacterPattern.test(value);

const isWholeWordMatch = (doc: Text, from: number, to: number) => {
  const matchText = doc.sliceString(from, to);
  if (!hasSearchWordCharacter(matchText)) {
    return true;
  }

  const previousCharacter = from > 0 ? doc.sliceString(from - 1, from) : "";
  const nextCharacter = to < doc.length ? doc.sliceString(to, to + 1) : "";
  return !isSearchWordCharacter(previousCharacter) && !isSearchWordCharacter(nextCharacter);
};

const createMatchPreview = (doc: Text, from: number, to: number) => {
  const previewStart = Math.max(0, from - 28);
  const previewEnd = Math.min(doc.length, to + 40);
  return doc.sliceString(previewStart, previewEnd).replace(/\s+/g, " ").trim();
};

export const getEditorSearchResult = (
  text: string | Text,
  query: string,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): SearchResult => {
  const normalizedQuery = getNormalizedSearchQuery(query);
  if (!normalizedQuery) {
    return { error: null, matches: [] };
  }

  const doc = createSearchDocument(text);
  const matches: SearchMatch[] = [];
  const wholeWordTest = options.wholeWord
    ? (from: number, to: number) => isWholeWordMatch(doc, from, to)
    : undefined;

  if (options.regexp) {
    let cursor: RegExpCursor;
    try {
      cursor = new RegExpCursor(
        doc,
        normalizedQuery,
        {
          ignoreCase: !options.caseSensitive,
          test: wholeWordTest ? (from, to) => wholeWordTest(from, to) : undefined,
        },
        0,
        doc.length,
      );
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Invalid regular expression.",
        matches: [],
      };
    }

    for (cursor.next(); !cursor.done; cursor.next()) {
      const { from, to } = cursor.value;
      if (to <= from) {
        continue;
      }

      matches.push({
        start: from,
        end: to,
        preview: createMatchPreview(doc, from, to),
      });
    }

    return { error: null, matches };
  }

  const cursor = new SearchCursor(
    doc,
    normalizedQuery,
    0,
    doc.length,
    options.caseSensitive ? undefined : (value) => value.toLowerCase(),
    wholeWordTest ? (from, to) => wholeWordTest(from, to) : undefined,
  );

  for (cursor.next(); !cursor.done; cursor.next()) {
    const { from, to } = cursor.value;
    matches.push({
      start: from,
      end: to,
      preview: createMatchPreview(doc, from, to),
    });
  }

  return { error: null, matches };
};

export const getEditorSearchMatches = (
  text: string | Text,
  query: string,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): SearchMatch[] => getEditorSearchResult(text, query, options).matches;

export const getSearchQueryError = (
  query: string,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
) => getEditorSearchResult("", query, options).error;

const createSearchReplacementEdit = (
  text: string,
  patches: TextPatch[],
  selection: EditorSearchReplaceSelection,
): EditorSearchReplaceEdit | null => {
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

export const replaceCurrentEditorSearchMatch = (
  text: string,
  query: string,
  replacement: string,
  activeMatchIndex: number,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): EditorSearchReplaceEdit | null => {
  const matches = getEditorSearchMatches(text, query, options);
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

export const replaceAllEditorSearchMatches = (
  text: string,
  query: string,
  replacement: string,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): EditorSearchReplaceEdit | null => {
  const patches = getEditorSearchMatches(text, query, options)
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
