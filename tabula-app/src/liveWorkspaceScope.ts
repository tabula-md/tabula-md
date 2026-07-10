import type { WorkspaceFile } from "./workspaceStorage";

export const getLiveWorkspaceFileIds = ({
  activeFile,
  files,
  isLive,
}: {
  activeFile?: Pick<WorkspaceFile, "id" | "roomId">;
  files: readonly Pick<WorkspaceFile, "id" | "roomId">[];
  isLive: boolean;
}) => {
  if (!isLive || !activeFile?.roomId) {
    return [];
  }

  return files
    .filter((file) => file.roomId === activeFile.roomId)
    .map((file) => file.id);
};
