import {
  getEditorSearchResultWithLimit,
  type SearchOptions,
} from "./editorSearchModel";

export type WorkspaceFileSearchEntry = {
  fileId: string;
  displayPath: string;
  type?: string;
  tags?: readonly string[];
  resource?: string;
};

export type WorkspaceFileSearchFilters = {
  types: ReadonlySet<string>;
  tags: ReadonlySet<string>;
};

export type WorkspaceFileSearchResult = {
  error: string | null;
  files: WorkspaceFileSearchEntry[];
};

export const searchWorkspaceFiles = (
  entries: readonly WorkspaceFileSearchEntry[],
  query: string,
  options: SearchOptions,
  filters?: WorkspaceFileSearchFilters,
): WorkspaceFileSearchResult => {
  const hasQuery = query.trim().length > 0;
  const hasFilters = Boolean(filters && (filters.types.size > 0 || filters.tags.size > 0));
  if (!hasQuery && !hasFilters) return { error: null, files: [] };

  const files: WorkspaceFileSearchEntry[] = [];
  for (const entry of entries) {
    if (
      filters?.types.size &&
      (!entry.type || !filters.types.has(entry.type))
    ) {
      continue;
    }
    if (
      filters?.tags.size &&
      ![...filters.tags].every((tag) => entry.tags?.includes(tag))
    ) {
      continue;
    }
    if (!hasQuery) {
      files.push(entry);
      continue;
    }

    const searchableValues = [
      entry.displayPath,
      entry.type,
      ...(entry.tags ?? []),
      entry.resource,
    ].filter((value): value is string => Boolean(value));
    let matched = false;
    for (const value of searchableValues) {
      const result = getEditorSearchResultWithLimit(value, query, options, 1);
      if (result.error) return { error: result.error, files: [] };
      if (result.matches.length > 0) {
        matched = true;
        break;
      }
    }
    if (matched) files.push(entry);
  }

  return { error: null, files };
};
