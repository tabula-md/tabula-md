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
  metadataValues?: Readonly<Record<string, readonly string[]>>;
  markdown?: string;
};

export type WorkspaceFileSearchFilters = {
  types: ReadonlySet<string>;
  tags: ReadonlySet<string>;
  statuses?: ReadonlySet<OkfLifecycleStatus>;
  trustTiers?: ReadonlySet<OkfTrustTier>;
  freshness?: ReadonlySet<OkfFreshness>;
  sources?: ReadonlySet<string>;
  generatedBy?: ReadonlySet<string>;
  verifiedBy?: ReadonlySet<string>;
  metadata?: ReadonlyMap<string, ReadonlySet<string>>;
};

export type WorkspaceFileStructuredQuery = {
  filters: WorkspaceFileSearchFilters;
  text: string;
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
  metadataKey?: string;
};

export type MetadataFacet<TValue extends string = string> = {
  value: TValue;
  count: number;
};

export type WorkspaceMetadataField = {
  key: string;
  documentCount: number;
  values: MetadataFacet[];
};

const structuredFieldPattern = /(?:^|\s)([\p{L}\p{N}_.-]+):(?:"([^"]+)"|(\S+))/giu;

export const parseWorkspaceFileSearchQuery = (
  query: string,
  metadataFieldKeys: readonly string[] = [],
): WorkspaceFileStructuredQuery => {
  const filters: {
    types: Set<string>;
    tags: Set<string>;
    statuses: Set<OkfLifecycleStatus>;
    trustTiers: Set<OkfTrustTier>;
    freshness: Set<OkfFreshness>;
    sources: Set<string>;
    generatedBy: Set<string>;
    verifiedBy: Set<string>;
    metadata: Map<string, Set<string>>;
  } = {
    types: new Set(),
    tags: new Set(),
    statuses: new Set(),
    trustTiers: new Set(),
    freshness: new Set(),
    sources: new Set(),
    generatedBy: new Set(),
    verifiedBy: new Set(),
    metadata: new Map(),
  };
  const metadataFieldsByNormalizedKey = new Map(
    metadataFieldKeys.map((key) => [key.toLocaleLowerCase(), key]),
  );
  const text = query.replace(
    structuredFieldPattern,
    (match, rawField: string, quotedValue: string | undefined, value: string | undefined) => {
      const field = rawField.toLocaleLowerCase();
      const filterValue = (quotedValue ?? value ?? "").trim();
      if (field === "type") filters.types.add(filterValue);
      else if (field === "tag" || field === "tags") filters.tags.add(filterValue);
      else if (field === "status") filters.statuses.add(filterValue as OkfLifecycleStatus);
      else if (field === "trust" || field === "trust-tier") {
        filters.trustTiers.add(filterValue as OkfTrustTier);
      } else if (field === "freshness") {
        filters.freshness.add(filterValue as OkfFreshness);
      } else if (field === "source") filters.sources.add(filterValue);
      else if (field === "generated-by") filters.generatedBy.add(filterValue);
      else if (field === "verified-by") filters.verifiedBy.add(filterValue);
      else {
        const metadataKey = metadataFieldsByNormalizedKey.get(field);
        if (!metadataKey) return match;
        const values = filters.metadata.get(metadataKey) ?? new Set<string>();
        values.add(filterValue);
        filters.metadata.set(metadataKey, values);
      }
      return " ";
    },
  ).replace(/\s+/g, " ").trim();

  return { filters, text };
};

const normalizeFilterValue = (value: string) => value.trim().toLocaleLowerCase();
const includesFilterValue = (values: readonly string[] | undefined, expected: string) => {
  const normalizedExpected = normalizeFilterValue(expected);
  return values?.some((value) =>
    normalizeFilterValue(value).includes(normalizedExpected)) ?? false;
};
const matchesAnyExactValue = (
  value: string | undefined,
  expected: ReadonlySet<string> | undefined,
) => !expected?.size || Boolean(
  value && [...expected].some((candidate) =>
    normalizeFilterValue(candidate) === normalizeFilterValue(value)),
);

const appendMetadataValue = (
  values: Record<string, string[]>,
  key: string,
  value: unknown,
) => {
  if (!key || value === null || typeof value === "undefined") return;
  if (Array.isArray(value)) {
    for (const item of value) appendMetadataValue(values, key, item);
    return;
  }
  if (typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      appendMetadataValue(values, `${key}.${nestedKey}`, nestedValue);
    }
    return;
  }
  const serialized = String(value).trim();
  if (!serialized) return;
  const existing = values[key] ?? [];
  if (!existing.some((candidate) => normalizeFilterValue(candidate) === normalizeFilterValue(serialized))) {
    existing.push(serialized);
  }
  values[key] = existing;
};

export const flattenWorkspaceMetadata = (
  metadata: Readonly<Record<string, unknown>>,
): Readonly<Record<string, readonly string[]>> => {
  const values: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(metadata)) appendMetadataValue(values, key, value);
  return values;
};

export const getWorkspaceMetadataFields = (
  entries: readonly WorkspaceFileSearchEntry[],
): WorkspaceMetadataField[] => {
  const fields = new Map<string, {
    key: string;
    documentIds: Set<string>;
    values: Map<string, { value: string; documentIds: Set<string> }>;
  }>();
  for (const entry of entries) {
    for (const [key, entryValues] of Object.entries(entry.metadataValues ?? {})) {
      const normalizedKey = key.toLocaleLowerCase();
      const field = fields.get(normalizedKey) ?? {
        key,
        documentIds: new Set<string>(),
        values: new Map(),
      };
      field.documentIds.add(entry.fileId);
      for (const value of entryValues) {
        const normalizedValue = normalizeFilterValue(value);
        const facet = field.values.get(normalizedValue) ?? {
          value,
          documentIds: new Set<string>(),
        };
        facet.documentIds.add(entry.fileId);
        field.values.set(normalizedValue, facet);
      }
      fields.set(normalizedKey, field);
    }
  }
  return [...fields.values()]
    .map((field) => ({
      key: field.key,
      documentCount: field.documentIds.size,
      values: [...field.values.values()]
        .map(({ value, documentIds }) => ({ value, count: documentIds.size }))
        .sort((first, second) => second.count - first.count || first.value.localeCompare(second.value)),
    }))
    .sort((first, second) => second.documentCount - first.documentCount || first.key.localeCompare(second.key));
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
    filters.freshness?.size ||
    filters.sources?.size ||
    filters.generatedBy?.size ||
    filters.verifiedBy?.size ||
    filters.metadata?.size
  ));
  if (!hasQuery && !hasFilters) return { error: null, files: [], matches: [] };

  const matches: Array<WorkspaceFileSearchMatch & { sourceIndex: number }> = [];
  for (const [sourceIndex, entry] of entries.entries()) {
    if (
      !matchesAnyExactValue(entry.type, filters?.types)
    ) {
      continue;
    }
    if (
      filters?.tags.size &&
      ![...filters.tags].every((tag) =>
        entry.tags?.some((entryTag) =>
          normalizeFilterValue(entryTag) === normalizeFilterValue(tag)))
    ) {
      continue;
    }
    if (
      !matchesAnyExactValue(entry.status, filters?.statuses)
    ) {
      continue;
    }
    if (
      !matchesAnyExactValue(entry.trustTier, filters?.trustTiers)
    ) {
      continue;
    }
    if (
      !matchesAnyExactValue(entry.freshness, filters?.freshness)
    ) {
      continue;
    }
    if (
      filters?.sources?.size &&
      ![...filters.sources].every((source) => includesFilterValue(entry.sourceValues, source))
    ) continue;
    if (
      filters?.generatedBy?.size &&
      ![...filters.generatedBy].every((generator) =>
        includesFilterValue(entry.generatedBy ? [entry.generatedBy] : undefined, generator))
    ) continue;
    if (
      filters?.verifiedBy?.size &&
      ![...filters.verifiedBy].every((verifier) =>
        includesFilterValue(entry.verifiedBy, verifier))
    ) continue;
    if (filters?.metadata?.size) {
      const entryFields = new Map(
        Object.entries(entry.metadataValues ?? {}).map(([key, values]) => [
          key.toLocaleLowerCase(),
          values,
        ]),
      );
      const matchesMetadata = [...filters.metadata].every(([key, expectedValues]) => {
        const actualValues = entryFields.get(key.toLocaleLowerCase());
        return [...expectedValues].every((expected) => includesFilterValue(actualValues, expected));
      });
      if (!matchesMetadata) continue;
    }
    if (!hasQuery) {
      matches.push({ file: entry, field: "metadata", score: 0, sourceIndex });
      continue;
    }

    const searchableValues: Array<{
      value: string;
      field: WorkspaceFileSearchMatch["field"];
      score: number;
      metadataKey?: string;
    }> = [];
    const addSearchableValue = (
      value: string | undefined,
      field: WorkspaceFileSearchMatch["field"],
      score: number,
      metadataKey?: string,
    ) => {
      if (value) searchableValues.push({ value, field, score, metadataKey });
    };
    addSearchableValue(entry.title, "title", 400);
    addSearchableValue(entry.displayPath, "path", 300);
    for (const [metadataKey, values] of Object.entries(entry.metadataValues ?? {})) {
      for (const value of values) addSearchableValue(value, "metadata", 220, metadataKey);
    }
    for (const value of [
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
    ]) addSearchableValue(value, "metadata", 200);
    addSearchableValue(entry.markdown, "body", 100);
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
            metadataKey: candidate.metadataKey,
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
