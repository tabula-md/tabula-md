import type { WorkspaceSourceDocument } from "@tabula-md/tabula";
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
