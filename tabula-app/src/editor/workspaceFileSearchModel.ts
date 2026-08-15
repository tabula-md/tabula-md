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
  contentKind?: "markdown" | "text";
  browseByDefault?: boolean;
  format?: string;
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
  content?: string;
};

export type WorkspaceFileSearchMatch = {
  kind: "document" | "heading" | "passage" | "metadata";
  label: string;
  preview?: string;
  from?: number;
  to?: number;
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
  matchesByFileId: ReadonlyMap<string, readonly WorkspaceFileSearchMatch[]>;
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
  if (!hasQuery && !hasFilters) {
    return { error: null, files: [], matchesByFileId: new Map() };
  }

  const files: WorkspaceFileSearchEntry[] = [];
  const matchesByFileId = new Map<string, WorkspaceFileSearchMatch[]>();
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
      files.push(entry);
      continue;
    }

    const matches: WorkspaceFileSearchMatch[] = [];
    const addValueMatch = (
      value: string | undefined,
      kind: WorkspaceFileSearchMatch["kind"],
      label: string,
    ) => {
      if (!value) return null;
      const valueResult = getEditorSearchResultWithLimit(value, query, options, 1);
      if (valueResult.error) return valueResult.error;
      if (valueResult.matches.length > 0) {
        matches.push({ kind, label, preview: value });
      }
      return null;
    };

    let error = addValueMatch(entry.displayPath, "document", entry.displayPath);
    if (!error && matches.length === 0) {
      error = addValueMatch(entry.title, "document", entry.title ?? entry.displayPath);
    }
    const metadataValues = [
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
    ].filter((value): value is string => Boolean(value));
    for (const value of metadataValues) {
      if (error) break;
      const before = matches.length;
      error = addValueMatch(value, "metadata", value);
      if (matches.length > before) break;
    }
    if (error) {
      return { error, files: [], matchesByFileId: new Map() };
    }

    if (entry.content) {
      const contentResult = getEditorSearchResultWithLimit(
        entry.content,
        query,
        options,
        3,
      );
      if (contentResult.error) {
        return {
          error: contentResult.error,
          files: [],
          matchesByFileId: new Map(),
        };
      }
      for (const match of contentResult.matches) {
        const lineStart = entry.content.lastIndexOf("\n", match.start - 1) + 1;
        const nextBreak = entry.content.indexOf("\n", match.end);
        const lineEnd = nextBreak === -1 ? entry.content.length : nextBreak;
        const line = entry.content.slice(lineStart, lineEnd);
        const heading = entry.contentKind === "markdown"
          ? line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)
          : null;
        matches.push(heading
          ? {
              kind: "heading",
              label: heading[1] ?? line.trim(),
              preview: line.trim(),
              from: lineStart,
              to: lineEnd,
            }
          : {
              kind: "passage",
              label: match.preview,
              preview: match.preview,
              from: match.start,
              to: match.end,
            });
      }
    }
    if (matches.length > 0) {
      files.push(entry);
      matchesByFileId.set(entry.fileId, matches);
    }
  }

  return { error: null, files, matchesByFileId };
};
