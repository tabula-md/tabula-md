import {
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_MAX_DOCUMENTS,
  WORKSPACE_ROOM_MAX_FOLDERS,
  WORKSPACE_ROOM_MAX_TREE_DEPTH,
  getWorkspacePathSegmentIssue,
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
} from "../workspaceStorage";

export type WorkspaceFolderImportDefaults = {
  viewMode: FileViewMode;
  readingWidth: ReadingWidth;
  lineWrapping: boolean;
  lineNumbers: boolean;
};

type FolderImportEntry = {
  file: File;
  segments: string[];
};

const markdownFilePattern = /\.md$/i;
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const parseRelativePath = (file: File) => {
  const rawPath = file.webkitRelativePath || file.name;
  const segments = rawPath.split("/");
  if (segments.length === 0 || segments.some((segment) => getWorkspacePathSegmentIssue(segment))) {
    throw new Error("This workspace folder contains an invalid path.");
  }
  return segments;
};

const stripSelectedRoot = (entries: FolderImportEntry[]) => {
  const selectedRoot = entries[0]?.segments[0];
  const hasSharedRoot = Boolean(
    selectedRoot &&
      entries.every((entry) => entry.file.webkitRelativePath && entry.segments.length > 1 && entry.segments[0] === selectedRoot),
  );
  return entries.map((entry) => ({
    ...entry,
    segments: hasSharedRoot ? entry.segments.slice(1) : entry.segments,
  }));
};

export const parseWorkspaceFolderFiles = async (
  selectedFiles: readonly File[],
  defaults: WorkspaceFolderImportDefaults,
): Promise<WorkspaceState> => {
  const entries = stripSelectedRoot(
    selectedFiles
      .map((file) => ({ file, segments: parseRelativePath(file) }))
      .filter(({ segments }) => markdownFilePattern.test(segments.at(-1) ?? ""))
      .sort((first, second) => first.segments.join("/").localeCompare(second.segments.join("/"))),
  );

  if (entries.length === 0) {
    throw new Error("This workspace folder does not contain any Markdown files.");
  }
  if (entries.length > WORKSPACE_ROOM_MAX_DOCUMENTS) {
    throw new Error(`A workspace can contain up to ${WORKSPACE_ROOM_MAX_DOCUMENTS} documents.`);
  }

  const folders: WorkspaceFolder[] = [createWorkspaceRootFolder()];
  const files: WorkspaceFile[] = [];
  const folderIdsByPath = new Map<string, string>([["", WORKSPACE_ROOT_FOLDER_ID]]);
  let contentBytes = 0;

  const ensureFolder = (segments: readonly string[]) => {
    if (segments.length > WORKSPACE_ROOM_MAX_TREE_DEPTH) {
      throw new Error(`A workspace folder can be up to ${WORKSPACE_ROOM_MAX_TREE_DEPTH} levels deep.`);
    }
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

  for (const { file, segments } of entries) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    contentBytes += bytes.byteLength;
    if (contentBytes > WORKSPACE_ROOM_MAX_CONTENT_BYTES) {
      throw new Error("The Markdown content in this workspace folder is too large.");
    }
    files.push(createWorkspaceFile(files.length + 1, {
      id: randomId(),
      title: segments.at(-1) ?? file.name,
      text: textDecoder.decode(bytes),
      parentId: ensureFolder(segments.slice(0, -1)),
      viewMode: defaults.viewMode,
      readingWidth: defaults.readingWidth,
      lineWrapping: defaults.lineWrapping,
      lineNumbers: defaults.lineNumbers,
    }));
  }

  return finalizeWorkspaceState(files, undefined, {}, {
    folders,
    openFileIds: [],
  });
};
