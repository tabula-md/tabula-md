import {
  createWorkspaceKnowledgeIndex,
  getWorkspaceKnowledgeChangeSet,
  getWorkspaceKnowledgeHealth,
  getWorkspaceOkfCompatibility,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceKnowledgeHealthIssueCode,
  type WorkspaceKnowledgeHealthReport,
  type WorkspaceKnowledgeIndex,
  type OkfCompatibilityReport,
} from "@tabula-md/tabula";
import { getWorkspaceKnowledgeDocuments } from "../workspaceKnowledgeModel";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";

export const WORKSPACE_REVIEW_VERIFICATION_ISSUE_CODES =
  new Set<WorkspaceKnowledgeHealthIssueCode>([
    "unverified_generated",
    "verification_outdated",
  ]);

export type WorkspaceReview = {
  standardVersion: string;
  declaredVersion?: string;
  conceptCount: number;
  requiredChangeCount: number;
  portabilityWarningCount: number;
  verificationCount: number;
  maintenanceAttentionCount: number;
  maintenanceNoticeCount: number;
  reviewAttentionCount: number;
  attentionCount: number;
  noticeCount: number;
  changeCount?: number;
};

export type WorkspaceExportReview = WorkspaceReview;

const isReservedKnowledgePath = (path: string) => {
  const basename = path.split("/").at(-1)?.toLocaleLowerCase();
  return basename === "index.md" || basename === "log.md";
};

const hasWorkspaceKnowledgeSignal = (
  index: WorkspaceKnowledgeIndex,
  compatibility: OkfCompatibilityReport,
) => Boolean(compatibility.declaredVersion) ||
  compatibility.documents.some((document) => Boolean(document.conceptType)) ||
  [...index.analysesByDocumentId.values()].some((analysis) =>
    isReservedKnowledgePath(analysis.path)
  ) ||
  [...index.outgoingLinksByDocumentId.values()].some((links) =>
    links.some((link) => link.status !== "external")
  );

export const getWorkspaceReview = (
  index: WorkspaceKnowledgeIndex,
  {
    baseline,
    compatibility = getWorkspaceOkfCompatibility(index),
    health = getWorkspaceKnowledgeHealth(index),
  }: {
    baseline?: WorkspaceKnowledgeBaseline;
    compatibility?: OkfCompatibilityReport;
    health?: WorkspaceKnowledgeHealthReport;
  } = {},
): WorkspaceReview | undefined => {
  if (!hasWorkspaceKnowledgeSignal(index, compatibility)) return undefined;
  const verificationDocumentIds = new Set(
    health.issues
      .filter((issue) =>
        WORKSPACE_REVIEW_VERIFICATION_ISSUE_CODES.has(issue.code)
      )
      .map((issue) => issue.documentId),
  );
  const maintenanceIssues = health.issues.filter((issue) =>
    !WORKSPACE_REVIEW_VERIFICATION_ISSUE_CODES.has(issue.code)
  );
  const maintenanceAttentionCount = maintenanceIssues.filter(
    (issue) => issue.severity === "attention",
  ).length;
  const maintenanceNoticeCount = maintenanceIssues.length -
    maintenanceAttentionCount;
  const changeCount = baseline
    ? getWorkspaceKnowledgeChangeSet(
        baseline,
        [...index.documentsById.values()],
      ).changes.length
    : undefined;

  return {
    standardVersion: compatibility.declaredVersion ??
      compatibility.targetVersion,
    ...(compatibility.declaredVersion
      ? { declaredVersion: compatibility.declaredVersion }
      : {}),
    conceptCount: compatibility.conceptCount,
    requiredChangeCount: compatibility.errorCount,
    portabilityWarningCount: compatibility.warningCount,
    verificationCount: verificationDocumentIds.size,
    maintenanceAttentionCount,
    maintenanceNoticeCount,
    reviewAttentionCount:
      compatibility.errorCount +
      verificationDocumentIds.size +
      maintenanceAttentionCount,
    attentionCount: health.attentionCount,
    noticeCount: health.noticeCount,
    ...(typeof changeCount === "number" ? { changeCount } : {}),
  };
};

export const getWorkspaceExportReview = (
  files: readonly WorkspaceFile[],
  folders: readonly WorkspaceFolder[],
  baseline?: WorkspaceKnowledgeBaseline,
): WorkspaceExportReview | undefined => {
  const documents = getWorkspaceKnowledgeDocuments(files, folders);
  if (documents.length === 0) return undefined;
  const index = createWorkspaceKnowledgeIndex(documents);
  return getWorkspaceReview(index, { baseline });
};
