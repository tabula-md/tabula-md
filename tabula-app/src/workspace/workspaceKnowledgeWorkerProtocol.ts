import type {
  OkfCompatibilityReport,
  WorkspaceKnowledgeIndex,
  WorkspaceKnowledgeMaintenancePlan,
  WorkspaceSourceDocument,
} from "@tabula-md/tabula";

export type WorkspaceKnowledgeSyncRequest = {
  kind: "sync";
  requestId: number;
  revision: number;
  reset: boolean;
  removedDocumentIds: readonly string[];
  upsertedDocuments: readonly WorkspaceSourceDocument[];
};

export type WorkspaceKnowledgeMaintenanceRequest = {
  kind: "maintenance";
  requestId: number;
  previousDocuments: readonly WorkspaceSourceDocument[];
  nextDocuments: readonly WorkspaceSourceDocument[];
};

export type WorkspaceKnowledgeWorkerRequest =
  | WorkspaceKnowledgeSyncRequest
  | WorkspaceKnowledgeMaintenanceRequest;

export type WorkspaceKnowledgeSnapshotResponse = {
  kind: "snapshot";
  requestId: number;
  revision: number;
  index: WorkspaceKnowledgeIndex;
  compatibilityReport: OkfCompatibilityReport;
  elapsedMs: number;
};

export type WorkspaceKnowledgeMaintenanceResponse = {
  kind: "maintenance";
  requestId: number;
  plan: WorkspaceKnowledgeMaintenancePlan;
  elapsedMs: number;
};

export type WorkspaceKnowledgeErrorResponse = {
  kind: "error";
  requestId: number;
  operation: WorkspaceKnowledgeWorkerRequest["kind"];
  message: string;
};

export type WorkspaceKnowledgeWorkerResponse =
  | WorkspaceKnowledgeSnapshotResponse
  | WorkspaceKnowledgeMaintenanceResponse
  | WorkspaceKnowledgeErrorResponse;
