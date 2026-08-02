import {
  getEditorSearchResultWithLimit,
  type SearchOptions,
} from "./editorSearchModel";
import type {
  OkfFreshness,
  OkfLifecycleStatus,
  OkfTrustTier,
} from "@tabula-md/tabula";

export type WorkspaceFileSearchEntry = {
  fileId: string;
  displayPath: string;
  title?: string;
  description?: string;
  type?: string;
  tags?: readonly string[];
  resource?: string;
  sourceValues?: readonly string[];
  generatedBy?: string;
  verifiedBy?: readonly string[];
  status?: OkfLifecycleStatus;
  trustTier?: OkfTrustTier;
  freshness?: OkfFreshness;
  markdown?: string;
};

export type WorkspaceFileSearchFilters = {
  types: ReadonlySet<string>;
  tags: ReadonlySet<string>;
  statuses?: ReadonlySet<OkfLifecycleStatus>;
  trustTiers?: ReadonlySet<OkfTrustTier>;
  freshness?: ReadonlySet<OkfFreshness>;
};

export type WorkspaceFileSearchResult = {
  error: string | null;
  files: WorkspaceFileSearchEntry[];
  matches: WorkspaceFileSearchMatch[];
};

export type WorkspaceFileSearchMatch = {
  file: WorkspaceFileSearchEntry;
  field: "title" | "path" | "metadata" | "body";
  score: number;
  snippet?: string;
};

export type MetadataFacet<TValue extends string = string> = {
  value: TValue;
  count: number;
};

export const getMetadataFacets = <TEntry, TValue extends string>(
  entries: readonly TEntry[],
  getValue: (entry: TEntry) => TValue | readonly TValue[] | undefined,
): MetadataFacet<TValue>[] => {
  const counts = new Map<TValue, number>();
  for (const entry of entries) {
    const values = getValue(entry);
    const uniqueValues = new Set(
      Array.isArray(values) ? values : values ? [values] : [],
    );
    for (const value of uniqueValues) {
      counts.set(value as TValue, (counts.get(value as TValue) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((first, second) => first.value.localeCompare(second.value));
};

export const searchWorkspaceFiles = (
  entries: readonly WorkspaceFileSearchEntry[],
  query: string,
  options: SearchOptions,
  filters?: WorkspaceFileSearchFilters,
): WorkspaceFileSearchResult => {
  const hasQuery = query.trim().length > 0;
  const hasFilters = Boolean(filters && (
    filters.types.size > 0 ||
    filters.tags.size > 0 ||
    filters.statuses?.size ||
    filters.trustTiers?.size ||
    filters.freshness?.size
  ));
  if (!hasQuery && !hasFilters) return { error: null, files: [], matches: [] };

  const matches: Array<WorkspaceFileSearchMatch & { sourceIndex: number }> = [];
  for (const [sourceIndex, entry] of entries.entries()) {
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
    if (
      filters?.statuses?.size &&
      (!entry.status || !filters.statuses.has(entry.status))
    ) {
      continue;
    }
    if (
      filters?.trustTiers?.size &&
      (!entry.trustTier || !filters.trustTiers.has(entry.trustTier))
    ) {
      continue;
    }
    if (
      filters?.freshness?.size &&
      (!entry.freshness || !filters.freshness.has(entry.freshness))
    ) {
      continue;
    }
    if (!hasQuery) {
      matches.push({ file: entry, field: "metadata", score: 0, sourceIndex });
      continue;
    }

    const searchableValues = [
      { value: entry.title, field: "title" as const, score: 400 },
      { value: entry.displayPath, field: "path" as const, score: 300 },
      ...[
        entry.description,
        entry.type,
        ...(entry.tags ?? []),
        entry.resource,
        ...(entry.sourceValues ?? []),
        entry.generatedBy,
        ...(entry.verifiedBy ?? []),
        entry.status,
        entry.trustTier,
        entry.freshness,
      ].map((value) => ({ value, field: "metadata" as const, score: 200 })),
      { value: entry.markdown, field: "body" as const, score: 100 },
    ].filter((candidate): candidate is { value: string; field: WorkspaceFileSearchMatch["field"]; score: number } =>
      Boolean(candidate.value));
    let bestMatch: WorkspaceFileSearchMatch | undefined;
    for (const candidate of searchableValues) {
      const value = candidate.value;
      const result = getEditorSearchResultWithLimit(value, query, options, 1);
      if (result.error) return { error: result.error, files: [], matches: [] };
      if (result.matches.length > 0) {
        const firstMatch = result.matches[0];
        const normalizedValue = options.caseSensitive ? value : value.toLocaleLowerCase();
        const normalizedQuery = options.caseSensitive ? query.trim() : query.trim().toLocaleLowerCase();
        const exactBonus = normalizedValue === normalizedQuery ? 80 : 0;
        const prefixBonus = normalizedValue.startsWith(normalizedQuery) ? 40 : 0;
        const score = candidate.score + exactBonus + prefixBonus;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            file: entry,
            field: candidate.field,
            score,
            snippet: firstMatch?.preview,
          };
        }
      }
    }
    if (bestMatch) matches.push({ ...bestMatch, sourceIndex });
  }

  matches.sort((first, second) =>
    second.score - first.score || first.sourceIndex - second.sourceIndex);
  return {
    error: null,
    files: matches.map((match) => match.file),
    matches: matches.map(({ sourceIndex: _sourceIndex, ...match }) => match),
  };
};
