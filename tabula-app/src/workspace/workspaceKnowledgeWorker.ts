import type {
  WorkspaceKnowledgeIndex,
  WorkspaceSourceDocument,
} from "@tabula-md/tabula";
import {
  createKnowledgeIndex,
  getKnowledgeCompatibility,
  getKnowledgeIndexMaintenancePlan,
  updateKnowledgeIndex,
} from "./workspaceKnowledgeRuntime";
import type {
  WorkspaceKnowledgeWorkerRequest,
  WorkspaceKnowledgeWorkerResponse,
} from "./workspaceKnowledgeWorkerProtocol";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkspaceKnowledgeWorkerRequest>) => void) | null;
  postMessage(message: WorkspaceKnowledgeWorkerResponse): void;
};

let knowledgeIndex: WorkspaceKnowledgeIndex | undefined;

const createTransferIndex = (
  index: WorkspaceKnowledgeIndex,
): WorkspaceKnowledgeIndex => ({
  ...index,
  documentsById: new Map(
    [...index.documentsById].map(([documentId, document]) => [
      documentId,
      { ...document, markdown: "" } satisfies WorkspaceSourceDocument,
    ]),
  ),
});

workerScope.onmessage = (event) => {
  const request = event.data;
  const startedAt = performance.now();
  try {
    if (request.kind === "maintenance") {
      knowledgeIndex = request.reset || !knowledgeIndex
        ? createKnowledgeIndex(request.upsertedDocuments)
        : updateKnowledgeIndex(
            knowledgeIndex,
            request.removedDocumentIds,
            request.upsertedDocuments,
          );
      workerScope.postMessage({
        kind: "maintenance",
        requestId: request.requestId,
        plan: getKnowledgeIndexMaintenancePlan(knowledgeIndex, request.pathChanges),
        elapsedMs: performance.now() - startedAt,
      });
      return;
    }

    knowledgeIndex = request.reset || !knowledgeIndex
      ? createKnowledgeIndex(request.upsertedDocuments)
      : updateKnowledgeIndex(
          knowledgeIndex,
          request.removedDocumentIds,
          request.upsertedDocuments,
        );
    workerScope.postMessage({
      kind: "snapshot",
      requestId: request.requestId,
      revision: request.revision,
      index: createTransferIndex(knowledgeIndex),
      compatibilityReport: getKnowledgeCompatibility(knowledgeIndex),
      elapsedMs: performance.now() - startedAt,
    });
  } catch (error) {
    workerScope.postMessage({
      kind: "error",
      requestId: request.requestId,
      operation: request.kind,
      message: error instanceof Error ? error.message : "Knowledge analysis failed.",
    });
  }
};
