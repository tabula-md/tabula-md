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
import {
  createWorkspaceKnowledgeIndexDelta,
} from "./workspaceKnowledgeWorkerDelta";
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
      if (!knowledgeIndex) {
        throw new Error("Knowledge index is not ready.");
      }
      workerScope.postMessage({
        kind: "maintenance",
        requestId: request.requestId,
        plan: getKnowledgeIndexMaintenancePlan(knowledgeIndex, request.pathChanges),
        elapsedMs: performance.now() - startedAt,
      });
      return;
    }

    const previousIndex = knowledgeIndex;
    knowledgeIndex = request.reset || !previousIndex
      ? createKnowledgeIndex(request.upsertedDocuments)
      : updateKnowledgeIndex(
          previousIndex,
          request.removedDocumentIds,
          request.upsertedDocuments,
        );
    const responseBase = {
      requestId: request.requestId,
      revision: request.revision,
      compatibilityReport: getKnowledgeCompatibility(
        knowledgeIndex,
        request.availablePaths,
      ),
    };
    if (request.reset || !previousIndex) {
      const index = createTransferIndex(knowledgeIndex);
      workerScope.postMessage({
        kind: "snapshot",
        ...responseBase,
        index,
        elapsedMs: performance.now() - startedAt,
      });
    } else {
      const delta = createWorkspaceKnowledgeIndexDelta(
        previousIndex,
        knowledgeIndex,
      );
      workerScope.postMessage({
        kind: "delta",
        ...responseBase,
        delta,
        elapsedMs: performance.now() - startedAt,
      });
    }
  } catch (error) {
    workerScope.postMessage({
      kind: "error",
      requestId: request.requestId,
      operation: request.kind,
      message: error instanceof Error ? error.message : "Knowledge analysis failed.",
    });
  }
};
