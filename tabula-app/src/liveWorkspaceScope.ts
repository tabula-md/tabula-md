import type { WorkspaceFile } from "./workspaceStorage";

export type LiveFolderScope = "local" | "private" | "shared" | "mixed";

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

export const getLiveFolderScope = ({
  folderRoomId,
  descendantFileIds,
  liveFileIds,
  isLive,
}: {
  folderRoomId?: string;
  descendantFileIds: readonly string[];
  liveFileIds: ReadonlySet<string>;
  isLive: boolean;
}): LiveFolderScope => {
  if (!isLive) return "local";

  const hasSharedContent = Boolean(folderRoomId) || descendantFileIds.some((fileId) => liveFileIds.has(fileId));
  const hasPrivateContent = descendantFileIds.some((fileId) => !liveFileIds.has(fileId));

  if (hasSharedContent && hasPrivateContent) return "mixed";
  return hasSharedContent ? "shared" : "private";
};
