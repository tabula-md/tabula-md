import {
  createWorkspaceKnowledgeIndex,
  removeWorkspaceDocumentFromKnowledgeIndex,
  updateWorkspaceKnowledgeIndex,
  type WorkspaceKnowledgeIndex,
  type WorkspaceSourceDocument,
} from "@tabula-md/tabula";

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
