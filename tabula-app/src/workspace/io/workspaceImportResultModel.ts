import { getWorkspaceKnowledgeDocuments } from "../workspaceKnowledgeModel";
import type { WorkspaceFolderImportDraft } from "./workspaceFolderImport";

export type WorkspaceImportResult = {
  standardVersion: string;
  conceptCount: number;
  directoryIndexCount: number;
  hasActivityLog: boolean;
  preservedSupportPaths: readonly string[];
  requiredChangeCount: number;
  attentionCount: number;
  rootIndexDocumentId?: string;
  suggestsV02Transition: boolean;
};

const getEvidenceCount = (
  draft: WorkspaceFolderImportDraft,
  code: "typed-concepts" | "directory-indexes",
) => draft.profile.evidence.find((evidence) => evidence.code === code)?.count ?? 0;

export const getWorkspaceImportResult = async (
  draft: WorkspaceFolderImportDraft,
): Promise<WorkspaceImportResult | undefined> => {
  if (draft.profile.format !== "okf" || !draft.profile.okfVersion) {
    return undefined;
  }
  const { getWorkspaceExportReview } = await import(
    "./workspaceExportReviewModel"
  );
  const review = getWorkspaceExportReview(
    draft.workspace.files,
    draft.workspace.folders,
  );
  const rootIndexDocumentId = getWorkspaceKnowledgeDocuments(
    draft.workspace.files,
    draft.workspace.folders,
  ).find((document) => document.path.toLocaleLowerCase() === "index.md")?.id;

  return {
    standardVersion: draft.profile.okfVersion,
    conceptCount: getEvidenceCount(draft, "typed-concepts"),
    directoryIndexCount: getEvidenceCount(draft, "directory-indexes"),
    hasActivityLog: draft.profile.evidence.some((evidence) =>
      evidence.code === "activity-log"
    ),
    preservedSupportPaths: draft.profile.preservedSupportPaths,
    requiredChangeCount: review?.requiredChangeCount ?? 0,
    attentionCount: review?.attentionCount ?? 0,
    ...(rootIndexDocumentId ? { rootIndexDocumentId } : {}),
    suggestsV02Transition: /^0\.1(?:\.|$)/.test(draft.profile.okfVersion),
  };
};
