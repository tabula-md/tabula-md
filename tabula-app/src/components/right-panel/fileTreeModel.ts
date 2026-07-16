import { WORKSPACE_ROOT_FOLDER_ID, type WorkspaceFile, type WorkspaceFolder } from "../../workspaceStorage";
import { getWorkspaceFileDisplayTitles, getWorkspaceFolderDisplayTitles } from "../../workspaceDisplayTitles";

type FileTreeFolderNode = {
  type: "folder";
  id: string;
  name: string;
  folder: WorkspaceFolder;
  children: FileTreeNode[];
};

type FileTreeFileNode = {
  type: "file";
  id: string;
  name: string;
  file: WorkspaceFile;
};

export type FileTreeNode = FileTreeFolderNode | FileTreeFileNode;

export type VisibleFileTreeRow = {
  node: FileTreeNode;
  depth: number;
};

const compareFileTreeNodes = (firstNode: FileTreeNode, secondNode: FileTreeNode) => {
  if (firstNode.type !== secondNode.type) {
    return firstNode.type === "folder" ? -1 : 1;
  }

  return firstNode.name.localeCompare(secondNode.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const sortFileTree = (folderNode: FileTreeFolderNode) => {
  folderNode.children.sort(compareFileTreeNodes);
  for (const childNode of folderNode.children) {
    if (childNode.type === "folder") {
      sortFileTree(childNode);
    }
  }
  return folderNode;
};

export const buildFileTree = (
  files: WorkspaceFile[],
  folders: WorkspaceFolder[],
  displayTitles = getWorkspaceFileDisplayTitles(files),
  folderDisplayTitles = getWorkspaceFolderDisplayTitles(folders),
): FileTreeFolderNode => {
  const rootFolder = folders.find((folder) => folder.id === WORKSPACE_ROOT_FOLDER_ID) ?? {
    id: WORKSPACE_ROOT_FOLDER_ID,
    title: "Project",
    parentId: null,
  };
  const rootNode: FileTreeFolderNode = {
    type: "folder",
    id: rootFolder.id,
    name: rootFolder.title,
    folder: rootFolder,
    children: [],
  };

  const nodesById = new Map<string, FileTreeFolderNode>([[rootNode.id, rootNode]]);
  const pendingFolders = folders.filter((folder) => folder.id !== rootNode.id);
  let attempts = 0;
  while (pendingFolders.length > 0 && attempts <= folders.length) {
    attempts += 1;
    for (let index = pendingFolders.length - 1; index >= 0; index -= 1) {
      const folder = pendingFolders[index];
      const parent = nodesById.get(folder.parentId ?? rootNode.id);
      if (!parent) continue;
      const node: FileTreeFolderNode = {
        type: "folder",
        id: folder.id,
        name: folderDisplayTitles.get(folder.id) ?? folder.title,
        folder,
        children: [],
      };
      parent.children.push(node);
      nodesById.set(folder.id, node);
      pendingFolders.splice(index, 1);
    }
  }
  for (const folder of pendingFolders) {
    const node: FileTreeFolderNode = {
      type: "folder",
      id: folder.id,
      name: folderDisplayTitles.get(folder.id) ?? folder.title,
      folder,
      children: [],
    };
    rootNode.children.push(node);
    nodesById.set(folder.id, node);
  }

  for (const file of files) {
    const parent = nodesById.get(file.parentId ?? rootNode.id) ?? rootNode;
    parent.children.push({
      type: "file",
      id: file.id,
      name: displayTitles.get(file.id) ?? file.title,
      file,
    });
  }

  return sortFileTree(rootNode);
};

export const flattenVisibleFileTree = (
  root: FileTreeFolderNode,
  collapsedFolderIds: Set<string>,
  rows: VisibleFileTreeRow[] = [],
  depth = 0,
) => {
  const isVirtualRoot = root.id === WORKSPACE_ROOT_FOLDER_ID;
  if (!isVirtualRoot) rows.push({ node: root, depth });
  if (!collapsedFolderIds.has(root.id)) {
    const childDepth = isVirtualRoot ? depth : depth + 1;
    for (const childNode of root.children) {
      if (childNode.type === "folder") {
        flattenVisibleFileTree(childNode, collapsedFolderIds, rows, childDepth);
      } else {
        rows.push({ node: childNode, depth: childDepth });
      }
    }
  }

  return rows;
};

export type DraggedTreeItem = {
  type: "file" | "folder";
  id: string;
  title: string;
  parentId: string | null;
};

export const getValidDropFolderIds = (
  folders: WorkspaceFolder[],
  draggedItem: DraggedTreeItem,
) => {
  const invalidFolderIds = new Set<string>();
  if (draggedItem.type === "folder") {
    invalidFolderIds.add(draggedItem.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of folders) {
        if (folder.parentId && invalidFolderIds.has(folder.parentId) && !invalidFolderIds.has(folder.id)) {
          invalidFolderIds.add(folder.id);
          changed = true;
        }
      }
    }
  }

  const currentFolderId = draggedItem.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
  return new Set([
    WORKSPACE_ROOT_FOLDER_ID,
    ...folders
      .filter((folder) => folder.id !== WORKSPACE_ROOT_FOLDER_ID)
      .map((folder) => folder.id),
  ].filter((folderId) => folderId !== currentFolderId && !invalidFolderIds.has(folderId)));
};
