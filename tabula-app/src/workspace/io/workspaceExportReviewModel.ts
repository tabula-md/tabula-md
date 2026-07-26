import {
  createWorkspaceKnowledgeIndex,
  getWorkspaceKnowledgeChangeSet,
  getWorkspaceKnowledgeHealth,
  getWorkspaceOkfCompatibility,
  type WorkspaceKnowledgeBaseline,
} from "@tabula-md/tabula";
import { getWorkspaceKnowledgeDocuments } from "../workspaceKnowledgeModel";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";

export type WorkspaceExportReview = {
  standardVersion: string;
  requiredChangeCount: number;
  portabilityWarningCount: number;
  attentionCount: number;
  noticeCount: number;
  changeCount?: number;
};

const isReservedKnowledgePath = (path: string) => {
  const basename = path.split("/").at(-1)?.toLocaleLowerCase();
  return basename === "index.md" || basename === "log.md";
};

export const getWorkspaceExportReview = (
  files: readonly WorkspaceFile[],
  folders: readonly WorkspaceFolder[],
  baseline?: WorkspaceKnowledgeBaseline,
): WorkspaceExportReview | undefined => {
  const documents = getWorkspaceKnowledgeDocuments(files, folders);
  if (documents.length === 0) return undefined;
  const index = createWorkspaceKnowledgeIndex(documents);
  const compatibility = getWorkspaceOkfCompatibility(index);
  const hasKnowledgeSignal = Boolean(compatibility.declaredVersion) ||
    [...index.analysesByDocumentId.values()].some((analysis) =>
      Boolean(analysis.knowledgeMetadata.type) ||
      isReservedKnowledgePath(analysis.path)
    ) ||
    [...index.outgoingLinksByDocumentId.values()].some((links) =>
      links.some((link) => link.status !== "external")
    );
  if (!hasKnowledgeSignal) return undefined;
  const health = getWorkspaceKnowledgeHealth(index);
  const changeCount = baseline
    ? getWorkspaceKnowledgeChangeSet(baseline, documents).changes.length
    : undefined;

  return {
    standardVersion: compatibility.declaredVersion ?? compatibility.targetVersion,
    requiredChangeCount: compatibility.errorCount,
    portabilityWarningCount: compatibility.warningCount,
    attentionCount: health.attentionCount,
    noticeCount: health.noticeCount,
    ...(typeof changeCount === "number" ? { changeCount } : {}),
  };
};
