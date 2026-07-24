import {
  createWorkspaceKnowledgeIndex,
  EMPTY_WORKSPACE_KNOWLEDGE_MAINTENANCE_PLAN,
  planWorkspaceKnowledgeMaintenance,
  removeWorkspaceDocumentFromKnowledgeIndex,
  updateWorkspaceKnowledgeIndex,
  type WorkspaceKnowledgeIndex,
  type WorkspaceKnowledgeMaintenancePlan,
  type WorkspaceSourceDocument,
} from "@tabula-md/tabula";
import { getWorkspaceFilePaths } from "./workspaceDisplayTitles";
import type { WorkspaceFile, WorkspaceFolder } from "./workspaceStorage";

export const getWorkspaceKnowledgeDocuments = (
  files: readonly WorkspaceFile[],
  folders: readonly WorkspaceFolder[],
): WorkspaceSourceDocument[] => {
  const paths = getWorkspaceFilePaths(files, folders);
  return files.map((file) => ({
    id: file.id,
    path: paths.get(file.id) ?? file.title,
    markdown: file.text,
  }));
};

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

type WorkspaceKnowledgePathState = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
};

export const maintainWorkspaceKnowledgePaths = <TState extends WorkspaceKnowledgePathState>(
  previous: TState,
  next: TState,
): { state: TState; plan: WorkspaceKnowledgeMaintenancePlan } => {
  let plan: WorkspaceKnowledgeMaintenancePlan;
  try {
    plan = planWorkspaceKnowledgeMaintenance(
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
