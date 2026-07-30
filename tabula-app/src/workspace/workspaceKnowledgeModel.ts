import type { WorkspaceKnowledgeMaintenancePlan, WorkspaceSourceDocument } from "@tabula-md/tabula";
import { getWorkspaceFilePaths } from "./workspaceDisplayTitles";
import type { WorkspaceFile, WorkspaceFolder } from "./workspaceStorage";

const EMPTY_WORKSPACE_KNOWLEDGE_MAINTENANCE_PLAN: WorkspaceKnowledgeMaintenancePlan =
  Object.freeze({
    updates: Object.freeze([]),
    updatedDocumentCount: 0,
    updatedLinkCount: 0,
    skippedLinkCount: 0,
  });

export const getWorkspaceKnowledgeDocuments = (
  files: readonly WorkspaceFile[],
  folders: readonly WorkspaceFolder[],
): WorkspaceSourceDocument[] => {
  const paths = getWorkspaceFilePaths(files, folders);
  return files.flatMap((file) => {
    const path = paths.get(file.id) ?? file.title;
    return /\.(?:md|markdown)$/i.test(path)
      ? [{
          id: file.id,
          path,
          markdown: file.text,
        }]
      : [];
  });
};
type WorkspaceKnowledgePathState = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
};

export const maintainWorkspaceKnowledgePaths = async <
  TState extends WorkspaceKnowledgePathState,
>(
  previous: TState,
  next: TState,
): Promise<{ state: TState; plan: WorkspaceKnowledgeMaintenancePlan }> => {
  let plan: WorkspaceKnowledgeMaintenancePlan;
  try {
    const { workspaceKnowledgeWorkerClient } = await import(
      "./workspaceKnowledgeWorkerClient"
    );
    plan = await workspaceKnowledgeWorkerClient.planMaintenance(
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
