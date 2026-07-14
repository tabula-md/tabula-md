import { strToU8, unzip, zip } from "fflate";
import {
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_MAX_DOCUMENTS,
  WORKSPACE_ROOM_MAX_FOLDERS,
  WORKSPACE_ROOM_MAX_TREE_DEPTH,
} from "@tabula-md/tabula";
import {
  WORKSPACE_ROOT_FOLDER_ID,
  createWorkspaceFile,
  createWorkspaceRootFolder,
  finalizeWorkspaceState,
  randomId,
  type FileViewMode,
  type ReadingWidth,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "./workspaceStorage";

export type ZipEntrySource = {
  path: string;
  content: string;
};

export type ProjectArchiveImportDefaults = {
  viewMode: FileViewMode;
  readingWidth: ReadingWidth;
  lineWrapping: boolean;
  lineNumbers: boolean;
};

const MAX_COMPRESSED_ARCHIVE_BYTES = 16 * 1024 * 1024;
const markdownPathPattern = /\.(?:md|markdown)$/i;
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const unzipArchive = (bytes: Uint8Array) =>
  new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, (error, entries) => {
      if (error) reject(error);
      else resolve(entries);
    });
  });

const parseArchivePath = (rawPath: string) => {
  const normalizedPath = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const directory = normalizedPath.endsWith("/");
  const segments = normalizedPath.split("/").filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === ".." || segment.includes("\0")) ||
    segments.length - (directory ? 0 : 1) > WORKSPACE_ROOM_MAX_TREE_DEPTH
  ) {
    throw new Error("This workspace archive contains an invalid path.");
  }
  return { directory, segments };
};

export const parseProjectArchive = async (
  bytes: Uint8Array,
  defaults: ProjectArchiveImportDefaults,
): Promise<WorkspaceState> => {
  if (bytes.byteLength > MAX_COMPRESSED_ARCHIVE_BYTES) {
    throw new Error("This workspace archive is too large.");
  }

  const entries = await unzipArchive(bytes);
  const folders: WorkspaceFolder[] = [createWorkspaceRootFolder()];
  const files: WorkspaceFile[] = [];
  const folderIdsByPath = new Map<string, string>([["", WORKSPACE_ROOT_FOLDER_ID]]);
  let contentBytes = 0;

  const ensureFolder = (segments: readonly string[]) => {
    let parentId = WORKSPACE_ROOT_FOLDER_ID;
    let path = "";
    for (const segment of segments) {
      path = path ? `${path}/${segment}` : segment;
      const existingId = folderIdsByPath.get(path);
      if (existingId) {
        parentId = existingId;
        continue;
      }
      if (folders.length - 1 >= WORKSPACE_ROOM_MAX_FOLDERS) {
        throw new Error(`A workspace can contain up to ${WORKSPACE_ROOM_MAX_FOLDERS} folders.`);
      }
      const folder = { id: randomId(), title: segment, parentId } satisfies WorkspaceFolder;
      folders.push(folder);
      folderIdsByPath.set(path, folder.id);
      parentId = folder.id;
    }
    return parentId;
  };

  for (const [rawPath, content] of Object.entries(entries).sort(([first], [second]) => first.localeCompare(second))) {
    if (rawPath.startsWith("__MACOSX/") || rawPath.endsWith("/.DS_Store") || rawPath === ".DS_Store") continue;
    const { directory, segments } = parseArchivePath(rawPath);
    if (directory) {
      ensureFolder(segments);
      continue;
    }
    const title = segments.at(-1) ?? "";
    if (!markdownPathPattern.test(title)) continue;
    if (files.length >= WORKSPACE_ROOM_MAX_DOCUMENTS) {
      throw new Error(`A workspace can contain up to ${WORKSPACE_ROOM_MAX_DOCUMENTS} documents.`);
    }
    contentBytes += content.byteLength;
    if (contentBytes > WORKSPACE_ROOM_MAX_CONTENT_BYTES) {
      throw new Error("The Markdown content in this workspace archive is too large.");
    }
    const text = textDecoder.decode(content);
    files.push(createWorkspaceFile(files.length + 1, {
      id: randomId(),
      title,
      text,
      parentId: ensureFolder(segments.slice(0, -1)),
      viewMode: defaults.viewMode,
      readingWidth: defaults.readingWidth,
      lineWrapping: defaults.lineWrapping,
      lineNumbers: defaults.lineNumbers,
    }));
  }

  if (files.length === 0) {
    throw new Error("This workspace archive does not contain any Markdown files.");
  }

  return finalizeWorkspaceState(files, files[0]?.id, {}, {
    folders,
    openFileIds: files.map((file) => file.id),
  });
};

export const parseProjectArchiveFile = async (
  file: File,
  defaults: ProjectArchiveImportDefaults,
) => parseProjectArchive(new Uint8Array(await file.arrayBuffer()), defaults);

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

export const getProjectArchiveEntries = (files: WorkspaceFile[], folders: WorkspaceFolder[] = []): ZipEntrySource[] => {
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

export const createProjectArchive = (files: WorkspaceFile[], folders: WorkspaceFolder[] = []) =>
  createZipArchive(getProjectArchiveEntries(files, folders));
