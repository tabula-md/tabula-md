import type { WorkspaceSourceDocument } from "./workspaceKnowledgeIndex";

export type WorkspaceKnowledgeBaseline = {
  capturedAt: string;
  documents: readonly WorkspaceSourceDocument[];
};

export const captureWorkspaceKnowledgeBaseline = (
  documents: readonly WorkspaceSourceDocument[],
  capturedAt = new Date().toISOString(),
): WorkspaceKnowledgeBaseline => ({
  capturedAt,
  documents: documents.map((document) => ({ ...document })),
});
