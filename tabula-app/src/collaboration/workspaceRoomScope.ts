import {
  WORKSPACE_ROOT_FOLDER_ID,
  type WorkspaceFolder,
} from "../workspaceStorage";

type WorkspaceRoomScopedDocument = {
  parentId?: string | null;
};

export const getWorkspaceRoomFolders = (
  documents: readonly WorkspaceRoomScopedDocument[],
  folders: readonly WorkspaceFolder[],
  roomId?: string,
) => {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const includedFolderIds = new Set<string>([WORKSPACE_ROOT_FOLDER_ID]);

  if (roomId) {
    for (const folder of folders) {
      if (folder.roomId === roomId) includedFolderIds.add(folder.id);
    }
  }

  for (const document of documents) {
    let folderId = document.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    const visited = new Set<string>();
    while (folderId && !visited.has(folderId)) {
      visited.add(folderId);
      includedFolderIds.add(folderId);
      const folder = foldersById.get(folderId);
      folderId = folder?.parentId ?? "";
    }
  }

  return folders.filter((folder) => includedFolderIds.has(folder.id));
};
