import type { WorkspaceFile } from "./workspaceStorage";

export const getLiveWorkspaceFileIds = ({
  roomId,
  files,
  isLive,
}: {
  roomId?: string;
  files: readonly Pick<WorkspaceFile, "id" | "roomId">[];
  isLive: boolean;
}) => {
  if (!isLive || !roomId) {
    return [];
  }

  return files
    .filter((file) => file.roomId === roomId)
    .map((file) => file.id);
};
