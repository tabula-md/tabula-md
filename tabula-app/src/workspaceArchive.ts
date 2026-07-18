import { strToU8, zip } from "fflate";
import {
  WORKSPACE_ROOT_FOLDER_ID,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "./workspaceStorage";

export type ZipEntrySource = {
  path: string;
  content: string;
};

const normalizeArchivePathSegment = (title: string, fallback: string) => {
  const cleanedTitle = title
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .replace(/^-+/, "")
    .slice(0, 120);
  return cleanedTitle || fallback;
};

const normalizeArchiveFileName = (title: string) => {
  const baseName = normalizeArchivePathSegment(title, "Untitled");

  return /\.(?:md|markdown)$/i.test(baseName) ? baseName : `${baseName}.md`;
};

const getFolderPath = (folderId: string | null | undefined, foldersById: Map<string, WorkspaceFolder>) => {
  const parts: string[] = [];
  const visited = new Set<string>();
  let currentId = folderId;
  while (currentId && currentId !== WORKSPACE_ROOT_FOLDER_ID && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = foldersById.get(currentId);
    if (!folder) break;
    parts.unshift(normalizeArchivePathSegment(folder.title, "Folder"));
    currentId = folder.parentId;
  }
  return parts;
};

export const getWorkspaceArchiveEntries = (files: WorkspaceFile[], folders: WorkspaceFolder[] = []): ZipEntrySource[] => {
  const pathCounts = new Map<string, number>();
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

  const fileEntries = files.map((file) => {
    const archivePath = [...getFolderPath(file.parentId, foldersById), normalizeArchiveFileName(file.title)].join("/");
    const normalizedKey = archivePath.toLowerCase();
    const count = pathCounts.get(normalizedKey) ?? 0;
    pathCounts.set(normalizedKey, count + 1);

    const dedupedPath =
      count === 0
        ? archivePath
        : archivePath.replace(/(\.(?:md|markdown))$/i, ` ${count + 1}$1`);

    return {
      path: dedupedPath,
      content: file.text,
    };
  });
  return [...emptyFolderEntries, ...fileEntries];
};

export const createZipArchive = (entries: ZipEntrySource[]) =>
  new Promise<Blob>((resolve, reject) => {
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
