import type { WorkspaceFile } from "./workspaceStorage";

export const getLiveWorkspaceFileIds = ({
  activeFile,
  excludedFileIds,
  files,
  isLive,
}: {
  activeFile?: Pick<WorkspaceFile, "id" | "roomId">;
  excludedFileIds: readonly string[];
  files: readonly Pick<WorkspaceFile, "id" | "roomId">[];
  isLive: boolean;
}) => {
  if (!isLive || !activeFile?.roomId) {
    return [];
  }

  const excludedFileIdSet = new Set(excludedFileIds);
  return files
    .filter((file) => !excludedFileIdSet.has(file.id))
    .map((file) => file.id);
};
