import {
  WORKSPACE_ROOT_FOLDER_ID,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "./workspaceStorage";

const getAvailableTitle = (usedTitles: Set<string>, title: string) => {
  if (!usedTitles.has(title.toLowerCase())) return title;
  const extensionMatch = title.match(/(\.[A-Za-z0-9]+)$/);
  const extension = extensionMatch?.[1] ?? "";
  const stem = extension ? title.slice(0, -extension.length) : title;
  let index = 2;
  let candidate = `${stem} ${index}${extension}`;
  while (usedTitles.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${stem} ${index}${extension}`;
  }
  return candidate;
};

export const getWorkspaceFileDisplayTitles = (files: readonly WorkspaceFile[]) => {
  const filesByFolder = new Map<string, WorkspaceFile[]>();
  for (const file of files) {
    const parentId = file.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    const siblings = filesByFolder.get(parentId) ?? [];
    siblings.push(file);
    filesByFolder.set(parentId, siblings);
  }

  const displayTitles = new Map<string, string>();
  for (const siblings of filesByFolder.values()) {
    const groups = new Map<string, WorkspaceFile[]>();
    for (const file of siblings) {
      const key = file.title.toLowerCase();
      const group = groups.get(key) ?? [];
      group.push(file);
      groups.set(key, group);
    }
    const usedTitles = new Set(groups.keys());
    for (const group of groups.values()) {
      group.sort((first, second) => first.id.localeCompare(second.id));
      displayTitles.set(group[0]!.id, group[0]!.title);
      for (const file of group.slice(1)) {
        const displayTitle = getAvailableTitle(usedTitles, file.title);
        usedTitles.add(displayTitle.toLowerCase());
        displayTitles.set(file.id, displayTitle);
      }
    }
  }
  return displayTitles;
};

export const getWorkspaceFolderDisplayTitles = (folders: readonly WorkspaceFolder[]) => {
  const foldersByParent = new Map<string, WorkspaceFolder[]>();
  for (const folder of folders) {
    if (folder.id === WORKSPACE_ROOT_FOLDER_ID) continue;
    const parentId = folder.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    const siblings = foldersByParent.get(parentId) ?? [];
    siblings.push(folder);
    foldersByParent.set(parentId, siblings);
  }

  const displayTitles = new Map<string, string>();
  for (const siblings of foldersByParent.values()) {
    const groups = new Map<string, WorkspaceFolder[]>();
    for (const folder of siblings) {
      const key = folder.title.toLowerCase();
      const group = groups.get(key) ?? [];
      group.push(folder);
      groups.set(key, group);
    }
    const usedTitles = new Set(groups.keys());
    for (const group of groups.values()) {
      group.sort((first, second) => first.id.localeCompare(second.id));
      displayTitles.set(group[0]!.id, group[0]!.title);
      for (const folder of group.slice(1)) {
        const displayTitle = getAvailableTitle(usedTitles, folder.title);
        usedTitles.add(displayTitle.toLowerCase());
        displayTitles.set(folder.id, displayTitle);
      }
    }
  }
  return displayTitles;
};
