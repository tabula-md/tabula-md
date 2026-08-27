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

export type WorkspaceFileSearchResult<
  Entry extends WorkspaceFileSearchEntry = WorkspaceFileSearchEntry,
> = {
  error: string | null;
  files: Entry[];
};

export const searchWorkspaceFiles = <Entry extends WorkspaceFileSearchEntry>(
  entries: readonly Entry[],
  query: string,
  options: SearchOptions,
  filters?: WorkspaceFileSearchFilters,
): WorkspaceFileSearchResult<Entry> => {
  const hasQuery = query.trim().length > 0;
  const hasFilters = Boolean(filters && (
    filters.types.size > 0 ||
    filters.tags.size > 0 ||
    filters.statuses?.size ||
    filters.trustTiers?.size ||
    filters.freshness?.size
  ));
  if (!hasQuery && !hasFilters) return { error: null, files: [] };

  const files: Entry[] = [];
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

    const searchableValues = [
      entry.displayPath,
      entry.title,
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
      entry.markdown,
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
