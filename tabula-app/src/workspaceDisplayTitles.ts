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

export type WorkspaceFileTabLabel = {
  displayTitle: string;
  fullPath: string;
};

const getFolderPath = (
  folderId: string | null | undefined,
  foldersById: ReadonlyMap<string, WorkspaceFolder>,
) => {
  const path: string[] = [];
  const visited = new Set<string>();
  let currentId = folderId ?? WORKSPACE_ROOT_FOLDER_ID;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = foldersById.get(currentId);
    if (!folder) break;
    path.unshift(folder.title);
    currentId = folder.parentId ?? "";
  }

  return path.length > 0 ? path : ["Workspace"];
};

const getShortestUniqueLocation = (locations: readonly string[][], targetIndex: number) => {
  const target = locations[targetIndex] ?? ["Workspace"];
  for (let depth = 1; depth <= target.length; depth += 1) {
    const candidate = target.slice(-depth).join("/");
    const isUnique = locations.every(
      (location, index) => index === targetIndex || location.slice(-depth).join("/") !== candidate,
    );
    if (isUnique) return candidate;
  }
  return target.join("/");
};

export const getWorkspaceFileTabLabels = (
  files: readonly WorkspaceFile[],
  folders: readonly WorkspaceFolder[],
) => {
  const displayTitles = getWorkspaceFileDisplayTitles(files);
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const groups = new Map<string, WorkspaceFile[]>();

  for (const file of files) {
    const displayTitle = displayTitles.get(file.id) ?? file.title;
    const group = groups.get(displayTitle.toLowerCase()) ?? [];
    group.push(file);
    groups.set(displayTitle.toLowerCase(), group);
  }

  const labels = new Map<string, WorkspaceFileTabLabel>();
  for (const group of groups.values()) {
    const locations = group.map((file) => getFolderPath(file.parentId, foldersById));
    group.forEach((file, index) => {
      const displayTitle = displayTitles.get(file.id) ?? file.title;
      const location = locations[index] ?? ["Workspace"];
      labels.set(file.id, {
        displayTitle:
          group.length > 1
            ? `${getShortestUniqueLocation(locations, index)}/${displayTitle}`
            : displayTitle,
        fullPath: [...location, displayTitle].join("/"),
      });
    });
  }

  return labels;
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
