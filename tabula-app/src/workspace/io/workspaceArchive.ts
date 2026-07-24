import { strToU8, zip } from "fflate";
import { getWorkspacePathSegmentIssue } from "@tabula-md/tabula";
import {
  WORKSPACE_ROOT_FOLDER_ID,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "../workspaceStorage";

export type ZipEntrySource = {
  path: string;
  content: string;
};

const requireArchivePathSegment = (title: string) => {
  const issue = getWorkspacePathSegmentIssue(title);
  if (issue) throw new Error(`Workspace export failed: invalid path segment (${issue}).`);
  return title;
};

const getFolderPath = (folderId: string | null | undefined, foldersById: Map<string, WorkspaceFolder>) => {
  const parts: string[] = [];
  const visited = new Set<string>();
  let currentId = folderId;
  while (currentId && currentId !== WORKSPACE_ROOT_FOLDER_ID && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = foldersById.get(currentId);
    if (!folder) throw new Error("Workspace export failed: missing parent folder.");
    parts.unshift(requireArchivePathSegment(folder.title));
    currentId = folder.parentId;
  }
  if (currentId && currentId !== WORKSPACE_ROOT_FOLDER_ID) {
    throw new Error("Workspace export failed: cyclic folder path.");
  }
  return parts;
};

export const getWorkspaceArchiveEntries = (files: WorkspaceFile[], folders: WorkspaceFolder[] = []): ZipEntrySource[] => {
  const archivePaths = new Set<string>();
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const foldersWithDocuments = new Set<string>();
  for (const file of files) {
    let folderId = file.parentId;
    const visited = new Set<string>();
    while (folderId && folderId !== WORKSPACE_ROOT_FOLDER_ID && !visited.has(folderId)) {
      visited.add(folderId);
      foldersWithDocuments.add(folderId);
      folderId = foldersById.get(folderId)?.parentId;
    }
  }
  const emptyFolderEntries = folders
    .filter((folder) => folder.id !== WORKSPACE_ROOT_FOLDER_ID && !foldersWithDocuments.has(folder.id))
    .map((folder) => ({
      path: `${getFolderPath(folder.id, foldersById).join("/")}/`,
      content: "",
    }))
    .filter((entry) => entry.path !== "/");

  const entries = [...emptyFolderEntries, ...files.map((file) => {
    const archivePath = [...getFolderPath(file.parentId, foldersById), requireArchivePathSegment(file.title)].join("/");
    return {
      path: archivePath,
      content: file.text,
    };
  })];
  for (const entry of entries) {
    if (archivePaths.has(entry.path)) {
      throw new Error(`Workspace export failed: duplicate path ${entry.path}.`);
    }
    archivePaths.add(entry.path);
  }
  return entries;
};

export const createZipArchive = (entries: ZipEntrySource[]) =>
  new Promise<Blob>((resolve, reject) => {
    if (new Set(entries.map((entry) => entry.path)).size !== entries.length) {
      reject(new Error("Workspace export failed: duplicate archive path."));
      return;
    }
    const source = Object.fromEntries(entries.map((entry) => [entry.path, strToU8(entry.content)]));

    zip(source, { level: 6 }, (error, bytes) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(new Blob([Uint8Array.from(bytes).buffer], { type: "application/zip" }));
    });
  });

export const createWorkspaceArchive = (files: WorkspaceFile[], folders: WorkspaceFolder[] = []) =>
  createZipArchive(getWorkspaceArchiveEntries(files, folders));
