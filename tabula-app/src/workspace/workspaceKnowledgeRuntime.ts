import {
  createWorkspaceKnowledgeIndex,
  planWorkspaceKnowledgeIndexMaintenance,
  planWorkspaceKnowledgeMaintenance,
  removeWorkspaceDocumentFromKnowledgeIndex,
  updateWorkspaceKnowledgeIndex,
  getWorkspaceOkfCompatibility,
  type OkfCompatibilityReport,
  type WorkspaceKnowledgeIndex,
  type WorkspaceKnowledgeMaintenancePlan,
  type WorkspaceKnowledgePathChange,
  type WorkspaceSourceDocument,
} from "@tabula-md/tabula";
import { getWorkspaceKnowledgeDocuments } from "./workspaceKnowledgeModel";
import type { WorkspaceFile, WorkspaceFolder } from "./workspaceStorage";

const EMPTY_WORKSPACE_KNOWLEDGE_MAINTENANCE_PLAN: WorkspaceKnowledgeMaintenancePlan =
  Object.freeze({
    updates: Object.freeze([]),
    updatedDocumentCount: 0,
    updatedLinkCount: 0,
    skippedLinkCount: 0,
  });

export const reconcileWorkspaceKnowledgeIndex = (
  current: WorkspaceKnowledgeIndex | undefined,
  documents: readonly WorkspaceSourceDocument[],
): WorkspaceKnowledgeIndex => {
  if (!current) {
    return createWorkspaceKnowledgeIndex(documents);
  }

  const nextDocumentsById = new Map<string, WorkspaceSourceDocument>();
  for (const document of documents) {
    if (nextDocumentsById.has(document.id)) {
      return createWorkspaceKnowledgeIndex(documents);
    }
    nextDocumentsById.set(document.id, document);
  }

  let next = current;
  for (const previousDocument of current.documentsById.values()) {
    const nextDocument = nextDocumentsById.get(previousDocument.id);
    if (!nextDocument || nextDocument.path !== previousDocument.path) {
      next = removeWorkspaceDocumentFromKnowledgeIndex(next, previousDocument.id);
    }
  }

  for (const document of documents) {
    const previousDocument = current.documentsById.get(document.id);
    if (
      !previousDocument ||
      previousDocument.path !== document.path ||
      previousDocument.markdown !== document.markdown
    ) {
      next = updateWorkspaceKnowledgeIndex(next, document);
    }
  }

  return next;
};

export const createKnowledgeIndex = (
  documents: readonly WorkspaceSourceDocument[],
): WorkspaceKnowledgeIndex => createWorkspaceKnowledgeIndex(documents);

export const updateKnowledgeIndex = (
  current: WorkspaceKnowledgeIndex,
  removedDocumentIds: readonly string[],
  upsertedDocuments: readonly WorkspaceSourceDocument[],
): WorkspaceKnowledgeIndex => {
  let next = current;
  for (const documentId of removedDocumentIds) {
    next = removeWorkspaceDocumentFromKnowledgeIndex(next, documentId);
  }
  for (const document of upsertedDocuments) {
    next = updateWorkspaceKnowledgeIndex(next, document);
  }
  return next;
};

export const getKnowledgeCompatibility = (
  index: WorkspaceKnowledgeIndex,
  availablePaths?: readonly string[],
): OkfCompatibilityReport => getWorkspaceOkfCompatibility(index, { availablePaths });

export const getKnowledgeMaintenancePlan = (
  previousDocuments: readonly WorkspaceSourceDocument[],
  nextDocuments: readonly WorkspaceSourceDocument[],
): WorkspaceKnowledgeMaintenancePlan =>
  planWorkspaceKnowledgeMaintenance(previousDocuments, nextDocuments);

export const getKnowledgeIndexMaintenancePlan = (
  index: WorkspaceKnowledgeIndex,
  pathChanges: readonly WorkspaceKnowledgePathChange[],
): WorkspaceKnowledgeMaintenancePlan =>
  planWorkspaceKnowledgeIndexMaintenance(index, pathChanges);

export const getWorkspaceKnowledgeMaintenancePlan = (
  previousDocuments: readonly WorkspaceSourceDocument[],
  nextDocuments: readonly WorkspaceSourceDocument[],
): WorkspaceKnowledgeMaintenancePlan =>
  planWorkspaceKnowledgeMaintenance(previousDocuments, nextDocuments);

type WorkspaceKnowledgePathState = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
};

export const maintainWorkspaceKnowledgePaths = <
  TState extends WorkspaceKnowledgePathState,
>(
  previous: TState,
  next: TState,
): { state: TState; plan: WorkspaceKnowledgeMaintenancePlan } => {
  let plan: WorkspaceKnowledgeMaintenancePlan;
  try {
    plan = getWorkspaceKnowledgeMaintenancePlan(
      getWorkspaceKnowledgeDocuments(previous.files, previous.folders),
      getWorkspaceKnowledgeDocuments(next.files, next.folders),
    );
  } catch {
    return {
      state: next,
      plan: EMPTY_WORKSPACE_KNOWLEDGE_MAINTENANCE_PLAN,
    };
  }
  if (plan.updates.length === 0) {
    return { state: next, plan };
  }
  const markdownByDocumentId = new Map(
    plan.updates.map((update) => [update.documentId, update.markdown]),
  );
  return {
    state: {
      ...next,
      files: next.files.map((file) => {
        const markdown = markdownByDocumentId.get(file.id);
        return typeof markdown === "string" ? { ...file, text: markdown } : file;
      }),
    },
    plan,
  };
};
