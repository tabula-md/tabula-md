import {
  getWorkspaceKnowledgeHealth,
  type WorkspaceKnowledgeHealthIssueCode,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import type { WorkspaceSearchIndexEntry } from "./workspaceSearchIndex";

export const EMPTY_KNOWLEDGE_FACET_VALUE = "empty";

export type WorkspaceKnowledgeFacetValue = {
  key: string;
  label: string;
  count: number;
};

export type WorkspaceKnowledgeFacetField = {
  key: string;
  kind: WorkspaceKnowledgeFilterKind;
  label: string;
  role: WorkspaceKnowledgeMetadataFieldRole;
  suggested: boolean;
  values: readonly WorkspaceKnowledgeFacetValue[];
};

export type WorkspaceKnowledgeFilterKind =
  | "select"
  | "text"
  | "date"
  | "number"
  | "boolean";

export type WorkspaceKnowledgeMetadataFieldRole =
  | "filter"
  | "lifecycle"
  | "relation"
  | "search";

export type WorkspaceKnowledgeMetadataField = {
  key: string;
  kind: WorkspaceKnowledgeFilterKind;
  label: string;
  role: WorkspaceKnowledgeMetadataFieldRole;
  suggested: boolean;
};

export type WorkspaceKnowledgeReviewKind =
  | "freshness"
  | "trust"
  | "links"
  | "sources"
  | "metadata"
  | "structure";

export type WorkspaceKnowledgeReviewDocument = {
  documentId: string;
  issueCount: number;
  attentionCount: number;
  kinds: readonly WorkspaceKnowledgeReviewKind[];
  primaryKind: WorkspaceKnowledgeReviewKind;
};

export type WorkspaceKnowledgeBrowseModel = {
  conceptDocumentIds: readonly string[];
  fields: readonly WorkspaceKnowledgeFacetField[];
  metadataFields: readonly WorkspaceKnowledgeMetadataField[];
  fieldValuesByDocumentId: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  reviewDocuments: readonly WorkspaceKnowledgeReviewDocument[];
  reviewIssueCount: number;
  reviewReady: boolean;
};

export type WorkspaceKnowledgeSelectFilter = {
  kind: "select";
  values: readonly string[];
};

export type WorkspaceKnowledgeTextFilter = {
  kind: "text";
  operator: "contains" | "equals" | "empty";
  value: string;
};

export type WorkspaceKnowledgeDateFilter = {
  kind: "date";
  operator: "on" | "before" | "after" | "empty";
  value: string;
};

export type WorkspaceKnowledgeNumberFilter = {
  kind: "number";
  operator: "equals" | "gte" | "lte" | "empty";
  value: string;
};

export type WorkspaceKnowledgeBooleanFilter = {
  kind: "boolean";
  operator: "equals" | "empty";
  value?: boolean;
};

export type WorkspaceKnowledgeFieldFilter =
  | WorkspaceKnowledgeSelectFilter
  | WorkspaceKnowledgeTextFilter
  | WorkspaceKnowledgeDateFilter
  | WorkspaceKnowledgeNumberFilter
  | WorkspaceKnowledgeBooleanFilter;

export type WorkspaceKnowledgeFilters = {
  fields: Readonly<Record<string, WorkspaceKnowledgeFieldFilter>>;
};

type ExtractedFacetValue = {
  key: string;
  label: string;
};

const SEARCH_ONLY_FIELD_NAMES = new Set([
  "abstract",
  "description",
  "id",
  "identifier",
  "name",
  "slug",
  "summary",
  "title",
]);

const RELATION_FIELD_NAMES = new Set([
  "dependencies",
  "links",
  "references",
  "related",
  "resource",
  "resources",
  "source",
  "sources",
]);

const LIFECYCLE_FIELD_NAMES = new Set([
  "generated",
  "stale_after",
  "verified",
]);

const OKF_FILTER_FIELD_NAMES = new Set(["status", "tags", "type"]);
const MAX_FILTER_VALUE_LENGTH = 48;
const MAX_FILTER_VALUE_WORDS = 6;
const MAX_DYNAMIC_FILTER_VALUES = 12;

const getRootFieldName = (fieldKey: string) =>
  fieldKey.split(".")[0]?.trim().toLocaleLowerCase() ?? "";

const getLeafFieldName = (fieldKey: string) =>
  fieldKey.split(".").at(-1)?.trim().toLocaleLowerCase() ?? "";

const isUrlValue = (value: string) => /^(?:https?:\/\/|mailto:|file:)/i.test(value.trim());

const isDateValue = (value: string) =>
  /^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?$/.test(value.trim());

const inferFilterKind = (
  values: readonly WorkspaceKnowledgeFacetValue[],
  role: WorkspaceKnowledgeMetadataFieldRole,
  hasMultiValueDocument: boolean,
): WorkspaceKnowledgeFilterKind => {
  const nonEmptyValues = values.filter(({ key }) => key !== EMPTY_KNOWLEDGE_FACET_VALUE);
  if (
    nonEmptyValues.length > 0 &&
    nonEmptyValues.every(({ key }) => key.startsWith("boolean:"))
  ) return "boolean";
  if (
    nonEmptyValues.length > 0 &&
    nonEmptyValues.every(({ key }) => key.startsWith("number:"))
  ) return "number";
  if (
    nonEmptyValues.length > 0 &&
    nonEmptyValues.every(({ label }) => isDateValue(label))
  ) return "date";
  if (role === "filter" || (hasMultiValueDocument && nonEmptyValues.every(isCompactFilterValue))) {
    return "select";
  }
  return "text";
};

const isCompactFilterValue = (value: WorkspaceKnowledgeFacetValue) => {
  if (value.key === EMPTY_KNOWLEDGE_FACET_VALUE) return true;
  if (value.key.startsWith("boolean:") || value.key.startsWith("number:")) return true;
  const label = value.label.trim();
  return label.length <= MAX_FILTER_VALUE_LENGTH &&
    label.split(/\s+/).filter(Boolean).length <= MAX_FILTER_VALUE_WORDS &&
    !isUrlValue(label) &&
    !isDateValue(label);
};

const classifyMetadataField = (
  fieldKey: string,
  values: readonly WorkspaceKnowledgeFacetValue[],
  observedDocumentCount: number,
  hasMultiValueDocument: boolean,
): WorkspaceKnowledgeMetadataFieldRole => {
  const root = getRootFieldName(fieldKey);
  const leaf = getLeafFieldName(fieldKey);
  const nonEmptyValues = values.filter(({ key }) => key !== EMPTY_KNOWLEDGE_FACET_VALUE);

  if (LIFECYCLE_FIELD_NAMES.has(root)) return "lifecycle";
  if (
    RELATION_FIELD_NAMES.has(root) ||
    nonEmptyValues.some(({ label }) => isUrlValue(label))
  ) return "relation";
  if (SEARCH_ONLY_FIELD_NAMES.has(root) || SEARCH_ONLY_FIELD_NAMES.has(leaf)) return "search";
  if (OKF_FILTER_FIELD_NAMES.has(root)) return "filter";
  if (nonEmptyValues.length === 0 || !nonEmptyValues.every(isCompactFilterValue)) return "search";

  const hasBooleanValue = nonEmptyValues.some(({ key }) => key.startsWith("boolean:"));
  const hasRepeatedValue = nonEmptyValues.some(({ count }) => count > 1);
  const hasSmallObservedVocabulary = observedDocumentCount > 1 &&
    nonEmptyValues.length <= MAX_DYNAMIC_FILTER_VALUES;
  return hasBooleanValue || hasMultiValueDocument || hasRepeatedValue || hasSmallObservedVocabulary
    ? "filter"
    : "search";
};

const asFacetValue = (value: unknown): ExtractedFacetValue | undefined => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized
      ? { key: `string:${normalized}`, label: normalized }
      : { key: EMPTY_KNOWLEDGE_FACET_VALUE, label: "" };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { key: `number:${value}`, label: String(value) };
  }
  if (typeof value === "boolean") {
    return { key: `boolean:${value}`, label: String(value) };
  }
  if (value === null) return { key: EMPTY_KNOWLEDGE_FACET_VALUE, label: "" };
  return undefined;
};

const extractMetadataFacetValues = (
  value: unknown,
  path: readonly string[],
  result: Map<string, Map<string, ExtractedFacetValue>>,
  depth = 0,
) => {
  if (depth > 6 || path.length === 0) return;
  const primitive = asFacetValue(value);
  if (primitive) {
    const fieldKey = path.join(".");
    const values = result.get(fieldKey) ?? new Map<string, ExtractedFacetValue>();
    values.set(primitive.key, primitive);
    result.set(fieldKey, values);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      extractMetadataFacetValues(null, path, result, depth + 1);
      return;
    }
    value.forEach((item) => extractMetadataFacetValues(item, path, result, depth + 1));
    return;
  }
  if (typeof value === "object" && value) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      extractMetadataFacetValues(null, path, result, depth + 1);
      return;
    }
    entries.forEach(([key, item]) =>
      extractMetadataFacetValues(item, [...path, key], result, depth + 1));
  }
};

const getDocumentFacetValues = (metadata: Record<string, unknown>) => {
  const values = new Map<string, Map<string, ExtractedFacetValue>>();
  Object.entries(metadata).forEach(([key, value]) =>
    extractMetadataFacetValues(value, [key], values));
  return values;
};

const reviewGroupByIssueCode: Record<
  WorkspaceKnowledgeHealthIssueCode,
  WorkspaceKnowledgeReviewKind
> = {
  stale: "freshness",
  deprecated_referenced: "freshness",
  unverified_generated: "trust",
  verification_outdated: "trust",
  provenance_missing: "trust",
  relationship_broken: "links",
  relationship_ambiguous: "links",
  canonical_resource_shared: "sources",
  source_id_duplicate: "sources",
  source_resource_duplicate: "sources",
  source_reference_missing: "sources",
  source_unused: "sources",
  optional_metadata_invalid: "metadata",
  orphan_concept: "structure",
};

const reviewKindOrder: readonly WorkspaceKnowledgeReviewKind[] = [
  "freshness",
  "trust",
  "links",
  "sources",
  "metadata",
  "structure",
];

const buildReviewDocuments = (
  index?: WorkspaceKnowledgeIndex,
): WorkspaceKnowledgeReviewDocument[] => {
  if (!index) return [];
  const documents = new Map<
    string,
    {
      issueCount: number;
      attentionCount: number;
      kinds: Set<WorkspaceKnowledgeReviewKind>;
      primaryAttention: boolean;
      primaryKind: WorkspaceKnowledgeReviewKind;
    }
  >();

  for (const issue of getWorkspaceKnowledgeHealth(index).issues) {
    const kind = reviewGroupByIssueCode[issue.code];
    const current = documents.get(issue.documentId) ?? {
      issueCount: 0,
      attentionCount: 0,
      kinds: new Set<WorkspaceKnowledgeReviewKind>(),
      primaryAttention: issue.severity === "attention",
      primaryKind: kind,
    };
    current.issueCount += 1;
    if (issue.severity === "attention") current.attentionCount += 1;
    const attention = issue.severity === "attention";
    if (
      (attention && !current.primaryAttention) ||
      (attention === current.primaryAttention &&
        reviewKindOrder.indexOf(kind) < reviewKindOrder.indexOf(current.primaryKind))
    ) {
      current.primaryAttention = attention;
      current.primaryKind = kind;
    }
    current.kinds.add(kind);
    documents.set(issue.documentId, current);
  }

  return [...documents].map(([documentId, document]) => ({
    documentId,
    issueCount: document.issueCount,
    attentionCount: document.attentionCount,
    kinds: reviewKindOrder.filter((kind) => document.kinds.has(kind)),
    primaryKind: document.primaryKind,
  })).sort(
    (left, right) => right.attentionCount - left.attentionCount ||
      right.issueCount - left.issueCount ||
      left.documentId.localeCompare(right.documentId),
  );
};

export const buildWorkspaceKnowledgeBrowseModel = (
  entries: readonly WorkspaceSearchIndexEntry[],
  index?: WorkspaceKnowledgeIndex,
): WorkspaceKnowledgeBrowseModel => {
  const concepts = entries.filter(
    (entry) => entry.iconKind === "markdown" &&
      Object.keys(entry.metadata).length > 0 &&
      !entry.displayPath.split("/").some((segment) => segment.startsWith(".")),
  );
  const extractedByDocument = new Map(
    concepts.map((entry) => [entry.fileId, getDocumentFacetValues(entry.metadata)]),
  );
  const fieldKeys = [...new Set(
    [...extractedByDocument.values()].flatMap((fields) => [...fields.keys()]),
  )].sort((left, right) => left.localeCompare(right));
  const rawFields = fieldKeys.map((fieldKey) => {
    const counts = new Map<string, { label: string; count: number }>();
    concepts.forEach((entry) => {
      const values = extractedByDocument.get(entry.fileId)?.get(fieldKey);
      if (!values || values.size === 0) {
        const empty = counts.get(EMPTY_KNOWLEDGE_FACET_VALUE);
        counts.set(EMPTY_KNOWLEDGE_FACET_VALUE, {
          label: "",
          count: (empty?.count ?? 0) + 1,
        });
        return;
      }
      values.forEach(({ key, label }) => {
        const current = counts.get(key);
        counts.set(key, { label, count: (current?.count ?? 0) + 1 });
      });
    });
    return {
      key: fieldKey,
      label: fieldKey,
      values: [...counts].map(([key, value]) => ({ key, ...value })).sort(
        (left, right) => left.key === EMPTY_KNOWLEDGE_FACET_VALUE ? 1
          : right.key === EMPTY_KNOWLEDGE_FACET_VALUE ? -1
            : right.count - left.count || left.label.localeCompare(right.label),
      ),
    };
  });
  const fields = rawFields.map((field): WorkspaceKnowledgeFacetField => {
    const observedDocumentCount = concepts.reduce((count, entry) =>
      count + (extractedByDocument.get(entry.fileId)?.get(field.key)?.size ? 1 : 0), 0);
    const hasMultiValueDocument = concepts.some((entry) =>
      (extractedByDocument.get(entry.fileId)?.get(field.key)?.size ?? 0) > 1);
    const role = classifyMetadataField(
      field.key,
      field.values,
      observedDocumentCount,
      hasMultiValueDocument,
    );
    return {
      ...field,
      kind: inferFilterKind(field.values, role, hasMultiValueDocument),
      role,
      suggested: role === "filter",
    };
  });
  const metadataFields = fields.map(({
    key,
    kind,
    label,
    role,
    suggested,
  }): WorkspaceKnowledgeMetadataField => ({ key, kind, label, role, suggested }));
  const fieldValuesByDocumentId = Object.fromEntries(concepts.map((entry) => [
    entry.fileId,
    Object.fromEntries(fields.map(({ key: fieldKey }) => {
      const values = extractedByDocument.get(entry.fileId)?.get(fieldKey);
      return [fieldKey, values?.size ? [...values.keys()] : [EMPTY_KNOWLEDGE_FACET_VALUE]];
    })),
  ]));
  const reviewDocuments = buildReviewDocuments(index);

  return {
    conceptDocumentIds: concepts.map((entry) => entry.fileId),
    fields,
    metadataFields,
    fieldValuesByDocumentId,
    reviewDocuments,
    reviewIssueCount: reviewDocuments.reduce((count, document) => count + document.issueCount, 0),
    reviewReady: Boolean(index),
  };
};

const includesQuery = (entry: WorkspaceSearchIndexEntry, query: string) => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  const metadataValues = getDocumentFacetValues(entry.metadata);
  return [
    entry.title,
    entry.description,
    entry.displayPath,
    entry.body,
    entry.preview,
    ...[...metadataValues].flatMap(([field, values]) => [
      field,
      ...[...values.values()].map(({ label }) => label),
    ]),
  ].some((value) => value?.toLocaleLowerCase().includes(normalized));
};

const getFieldValueLabels = (
  field: WorkspaceKnowledgeFacetField,
  valueKeys: readonly string[],
) => valueKeys.flatMap((valueKey) => {
  const value = field.values.find(({ key }) => key === valueKey);
  return value && value.key !== EMPTY_KNOWLEDGE_FACET_VALUE ? [value.label] : [];
});

const getQuerySnippet = (value: string | undefined, query: string) => {
  const compact = value?.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  const matchIndex = compact.toLocaleLowerCase().indexOf(query);
  if (matchIndex < 0) return undefined;
  const start = Math.max(0, matchIndex - 28);
  const end = Math.min(compact.length, matchIndex + query.length + 48);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
};

export const createWorkspaceKnowledgeFieldFilter = (
  field: WorkspaceKnowledgeFacetField,
): WorkspaceKnowledgeFieldFilter => {
  if (field.kind === "select") return { kind: "select", values: [] };
  if (field.kind === "text") return { kind: "text", operator: "equals", value: "" };
  if (field.kind === "date") return { kind: "date", operator: "on", value: "" };
  if (field.kind === "number") return { kind: "number", operator: "equals", value: "" };
  return { kind: "boolean", operator: "equals" };
};

export const isWorkspaceKnowledgeFieldFilterActive = (
  filter: WorkspaceKnowledgeFieldFilter | undefined,
) => {
  if (!filter) return false;
  if (filter.kind === "select") return filter.values.length > 0;
  if (filter.operator === "empty") return true;
  if (filter.kind === "boolean") return typeof filter.value === "boolean";
  return filter.value.trim().length > 0;
};

const matchesFieldFilter = (
  field: WorkspaceKnowledgeFacetField,
  filter: WorkspaceKnowledgeFieldFilter,
  documentValueKeys: readonly string[],
) => {
  const keys = documentValueKeys.length > 0
    ? documentValueKeys
    : [EMPTY_KNOWLEDGE_FACET_VALUE];
  if (filter.kind === "select") {
    const values = new Set(keys);
    return filter.values.some((value) => values.has(value));
  }
  if (filter.operator === "empty") return keys.includes(EMPTY_KNOWLEDGE_FACET_VALUE);

  const labels = getFieldValueLabels(field, keys);
  if (filter.kind === "text") {
    const expected = filter.value.trim().toLocaleLowerCase();
    return labels.some((label) => {
      const normalized = label.toLocaleLowerCase();
      return filter.operator === "equals"
        ? normalized === expected
        : normalized.includes(expected);
    });
  }
  if (filter.kind === "date") {
    const expectedDate = Date.parse(filter.value);
    if (!Number.isFinite(expectedDate)) return false;
    return labels.some((label) => {
      const actualDate = Date.parse(label);
      if (!Number.isFinite(actualDate)) return false;
      if (filter.operator === "on") {
        return new Date(actualDate).toISOString().slice(0, 10) === filter.value.slice(0, 10);
      }
      return filter.operator === "before" ? actualDate < expectedDate : actualDate > expectedDate;
    });
  }
  if (filter.kind === "number") {
    const expected = Number(filter.value);
    if (!Number.isFinite(expected)) return false;
    return labels.some((label) => {
      const actual = Number(label);
      if (!Number.isFinite(actual)) return false;
      if (filter.operator === "gte") return actual >= expected;
      if (filter.operator === "lte") return actual <= expected;
      return actual === expected;
    });
  }
  return labels.some((label) => label === String(filter.value));
};

export const sanitizeWorkspaceKnowledgeFilters = (
  filters: WorkspaceKnowledgeFilters,
  model: WorkspaceKnowledgeBrowseModel,
): WorkspaceKnowledgeFilters => {
  const fieldsByKey = new Map(model.fields.map((field) => [field.key, field]));
  const fields: Record<string, WorkspaceKnowledgeFieldFilter> = {};
  Object.entries(filters.fields).forEach(([fieldKey, filter]) => {
    const field = fieldsByKey.get(fieldKey);
    if (!field || field.kind !== filter.kind) return;
    if (filter.kind !== "select") {
      if (filter.kind === "text" && filter.operator !== "equals" && filter.operator !== "empty") return;
      if (filter.kind === "date" && filter.operator !== "on" && filter.operator !== "empty") return;
      if (filter.kind === "number" && filter.operator !== "equals" && filter.operator !== "empty") return;
      if (isWorkspaceKnowledgeFieldFilterActive(filter)) fields[fieldKey] = filter;
      return;
    }
    const allowedValues = new Set(field.values.map(({ key }) => key));
    const values = filter.values.filter((valueKey) => allowedValues.has(valueKey));
    if (values.length > 0) fields[fieldKey] = { ...filter, values };
  });
  return { fields };
};

export const getWorkspaceKnowledgeDocumentReason = (
  entry: WorkspaceSearchIndexEntry,
  model: WorkspaceKnowledgeBrowseModel,
  query: string,
  filters: WorkspaceKnowledgeFilters,
) => {
  const documentFields = model.fieldValuesByDocumentId[entry.fileId] ?? {};
  const filteredReasons = model.fields.flatMap((field) => {
    const filter = filters.fields[field.key];
    const documentValues = documentFields[field.key] ?? [EMPTY_KNOWLEDGE_FACET_VALUE];
    if (
      !filter ||
      !isWorkspaceKnowledgeFieldFilterActive(filter) ||
      !matchesFieldFilter(field, filter, documentValues)
    ) return [];
    const labels = getFieldValueLabels(field, documentValues);
    if (filter.kind === "text" && filter.operator !== "empty") {
      const matched = labels.find((label) =>
        label.toLocaleLowerCase().includes(filter.value.trim().toLocaleLowerCase()));
      return matched ? [getQuerySnippet(matched, filter.value.trim().toLocaleLowerCase()) ?? matched] : [];
    }
    if (filter.kind === "select") {
      const selectedLabels = getFieldValueLabels(
        field,
        documentValues.filter((valueKey) => filter.values.includes(valueKey)),
      );
      return selectedLabels.length > 0 ? [selectedLabels.slice(0, 2).join(", ")] : [];
    }
    const matchedLabels = getFieldValueLabels(
      field,
      documentValues.filter((valueKey) => matchesFieldFilter(field, filter, [valueKey])),
    );
    return matchedLabels.length > 0 ? [matchedLabels.slice(0, 2).join(", ")] : [];
  });
  if (filteredReasons.length > 0) return filteredReasons.slice(0, 2).join(" · ");

  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery) {
    const metadataValues = getDocumentFacetValues(entry.metadata);
    for (const field of model.metadataFields) {
      const values = metadataValues.get(field.key);
      const matchedValue = [...(values?.values() ?? [])].find(({ label }) =>
        label.toLocaleLowerCase().includes(normalizedQuery));
      if (matchedValue?.label) {
        return getQuerySnippet(matchedValue.label, normalizedQuery) ?? matchedValue.label;
      }
      if (field.label.toLocaleLowerCase().includes(normalizedQuery)) return field.label;
    }
    return getQuerySnippet(entry.body, normalizedQuery) ??
      getQuerySnippet(entry.description, normalizedQuery) ??
      entry.displayPath;
  }

  return undefined;
};

export const getWorkspaceKnowledgeConceptDocuments = (
  entries: readonly WorkspaceSearchIndexEntry[],
  model: WorkspaceKnowledgeBrowseModel,
  query: string,
  filters: WorkspaceKnowledgeFilters,
) => {
  const conceptIds = new Set(model.conceptDocumentIds);
  const activeFilters = Object.entries(filters.fields).filter(([, filter]) =>
    isWorkspaceKnowledgeFieldFilterActive(filter));

  return entries.filter((entry) => {
    if (!conceptIds.has(entry.fileId) || !includesQuery(entry, query)) return false;
    const documentFields = model.fieldValuesByDocumentId[entry.fileId] ?? {};
    return activeFilters.every(([fieldKey, filter]) => {
      const field = model.fields.find(({ key }) => key === fieldKey);
      if (!field) return false;
      return matchesFieldFilter(
        field,
        filter,
        documentFields[fieldKey] ?? [EMPTY_KNOWLEDGE_FACET_VALUE],
      );
    });
  }).sort((left, right) => (left.title ?? left.displayPath).localeCompare(
    right.title ?? right.displayPath,
  ));
};

export const getWorkspaceKnowledgeReviewDocuments = (
  entries: readonly WorkspaceSearchIndexEntry[],
  model: WorkspaceKnowledgeBrowseModel,
  query: string,
  filters: WorkspaceKnowledgeFilters,
) => {
  const reviewByDocumentId = new Map(
    model.reviewDocuments.map((document) => [document.documentId, document]),
  );
  return getWorkspaceKnowledgeConceptDocuments(entries, model, query, filters)
    .flatMap((entry) => {
      const review = reviewByDocumentId.get(entry.fileId);
      return review ? [{ entry, review }] : [];
    })
    .sort((left, right) =>
      right.review.attentionCount - left.review.attentionCount ||
      right.review.issueCount - left.review.issueCount ||
      left.entry.displayPath.localeCompare(right.entry.displayPath),
    );
};
