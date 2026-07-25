import type {
  DocumentAnalysis,
  WorkspaceKnowledgeIndex,
  WorkspaceKnowledgeLink,
  WorkspaceSourceDocument,
} from "@tabula-md/tabula";

type MapDelta<Value> = {
  removedKeys: readonly string[];
  upsertedEntries: readonly (readonly [string, Value])[];
};

export type WorkspaceKnowledgeIndexDelta = {
  analysesByDocumentId: MapDelta<DocumentAnalysis>;
  documentIdsByType: MapDelta<readonly string[]>;
  documentIdsByTag: MapDelta<readonly string[]>;
  documentIdsByResource: MapDelta<readonly string[]>;
  outgoingLinksByDocumentId: MapDelta<readonly WorkspaceKnowledgeLink[]>;
  backlinksByDocumentId: MapDelta<readonly WorkspaceKnowledgeLink[]>;
  brokenLinks?: readonly WorkspaceKnowledgeLink[];
  ambiguousLinks?: readonly WorkspaceKnowledgeLink[];
  externalLinks?: readonly WorkspaceKnowledgeLink[];
};

const arraysEqual = <Value>(
  left: readonly Value[],
  right: readonly Value[],
  itemEqual: (left: Value, right: Value) => boolean,
) =>
  left.length === right.length &&
  left.every((item, index) => itemEqual(item, right[index]));

const stringsEqual = (left: readonly string[], right: readonly string[]) =>
  arraysEqual(left, right, (leftItem, rightItem) => leftItem === rightItem);

const linksEqual = (
  left: WorkspaceKnowledgeLink,
  right: WorkspaceKnowledgeLink,
) =>
  left.syntax === right.syntax &&
  left.relation === right.relation &&
  left.label === right.label &&
  left.target === right.target &&
  left.referenceIdentifier === right.referenceIdentifier &&
  left.from === right.from &&
  left.to === right.to &&
  left.sourceDocumentId === right.sourceDocumentId &&
  left.sourcePath === right.sourcePath &&
  left.status === right.status &&
  left.targetDocumentId === right.targetDocumentId &&
  left.targetPath === right.targetPath &&
  left.fragment === right.fragment &&
  stringsEqual(
    left.candidateDocumentIds ?? [],
    right.candidateDocumentIds ?? [],
  );

const linkArraysEqual = (
  left: readonly WorkspaceKnowledgeLink[],
  right: readonly WorkspaceKnowledgeLink[],
) => arraysEqual(left, right, linksEqual);

const createMapDelta = <Value>(
  previous: ReadonlyMap<string, Value>,
  next: ReadonlyMap<string, Value>,
  valuesEqual: (left: Value, right: Value) => boolean,
): MapDelta<Value> => ({
  removedKeys: [...previous.keys()].filter((key) => !next.has(key)),
  upsertedEntries: [...next].filter(([key, value]) => {
    const previousValue = previous.get(key);
    return typeof previousValue === "undefined" ||
      !valuesEqual(previousValue, value);
  }),
});

export const createWorkspaceKnowledgeIndexDelta = (
  previous: WorkspaceKnowledgeIndex,
  next: WorkspaceKnowledgeIndex,
): WorkspaceKnowledgeIndexDelta => ({
  analysesByDocumentId: createMapDelta(
    previous.analysesByDocumentId,
    next.analysesByDocumentId,
    (left, right) => left === right,
  ),
  documentIdsByType: createMapDelta(
    previous.documentIdsByType,
    next.documentIdsByType,
    stringsEqual,
  ),
  documentIdsByTag: createMapDelta(
    previous.documentIdsByTag,
    next.documentIdsByTag,
    stringsEqual,
  ),
  documentIdsByResource: createMapDelta(
    previous.documentIdsByResource,
    next.documentIdsByResource,
    stringsEqual,
  ),
  outgoingLinksByDocumentId: createMapDelta(
    previous.outgoingLinksByDocumentId,
    next.outgoingLinksByDocumentId,
    linkArraysEqual,
  ),
  backlinksByDocumentId: createMapDelta(
    previous.backlinksByDocumentId,
    next.backlinksByDocumentId,
    linkArraysEqual,
  ),
  ...(!linkArraysEqual(previous.brokenLinks, next.brokenLinks)
    ? { brokenLinks: next.brokenLinks }
    : {}),
  ...(!linkArraysEqual(previous.ambiguousLinks, next.ambiguousLinks)
    ? { ambiguousLinks: next.ambiguousLinks }
    : {}),
  ...(!linkArraysEqual(previous.externalLinks, next.externalLinks)
    ? { externalLinks: next.externalLinks }
    : {}),
});

const applyMapDelta = <Value>(
  previous: ReadonlyMap<string, Value>,
  delta: MapDelta<Value>,
) => {
  const next = new Map(previous);
  for (const key of delta.removedKeys) next.delete(key);
  for (const [key, value] of delta.upsertedEntries) next.set(key, value);
  return next;
};

export const applyWorkspaceKnowledgeIndexDelta = (
  previous: WorkspaceKnowledgeIndex,
  delta: WorkspaceKnowledgeIndexDelta,
  documentsById: ReadonlyMap<string, WorkspaceSourceDocument>,
): WorkspaceKnowledgeIndex => ({
  documentsById,
  documentIdsByPath: new Map(
    [...documentsById.values()].map((document) => [document.path, document.id]),
  ),
  analysesByDocumentId: applyMapDelta(
    previous.analysesByDocumentId,
    delta.analysesByDocumentId,
  ),
  documentIdsByType: applyMapDelta(
    previous.documentIdsByType,
    delta.documentIdsByType,
  ),
  documentIdsByTag: applyMapDelta(
    previous.documentIdsByTag,
    delta.documentIdsByTag,
  ),
  documentIdsByResource: applyMapDelta(
    previous.documentIdsByResource,
    delta.documentIdsByResource,
  ),
  outgoingLinksByDocumentId: applyMapDelta(
    previous.outgoingLinksByDocumentId,
    delta.outgoingLinksByDocumentId,
  ),
  backlinksByDocumentId: applyMapDelta(
    previous.backlinksByDocumentId,
    delta.backlinksByDocumentId,
  ),
  brokenLinks: delta.brokenLinks ?? previous.brokenLinks,
  ambiguousLinks: delta.ambiguousLinks ?? previous.ambiguousLinks,
  externalLinks: delta.externalLinks ?? previous.externalLinks,
});
