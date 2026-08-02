import { useState } from "react";

const toggleSetValue = (currentIds: Set<string>, id: string) => {
  const nextIds = new Set(currentIds);
  if (nextIds.has(id)) nextIds.delete(id);
  else nextIds.add(id);
  return nextIds;
};

export function useWorkspaceFileTreeState() {
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );

  return {
    collapsedFolderIds,
    toggleFolderCollapsed: (folderId: string) =>
      setCollapsedFolderIds((currentIds) => toggleSetValue(currentIds, folderId)),
    collapseAllFolders: (folderIds: Iterable<string>) =>
      setCollapsedFolderIds(new Set(folderIds)),
    expandAllFolders: () => setCollapsedFolderIds(new Set()),
  };
}
