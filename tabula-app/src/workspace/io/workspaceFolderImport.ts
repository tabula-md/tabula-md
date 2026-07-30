import {
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_MAX_DOCUMENTS,
  WORKSPACE_ROOM_MAX_FOLDERS,
  WORKSPACE_ROOM_MAX_TREE_DEPTH,
  createWorkspaceArtifact,
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
import {
  encodeBinaryWorkspaceSupportFile,
  isMdxWorkspacePath,
  isMarkdownWorkspacePath,
} from "./workspaceSupportFile";
import { getWorkspaceKnowledgeDocuments } from "../workspaceKnowledgeModel";
import type { WorkspaceImportProfile } from "./workspaceImportProfile";

export type WorkspaceFolderImportDefaults = {
  viewMode: FileViewMode;
  readingWidth: ReadingWidth;
  lineWrapping: boolean;
  lineNumbers: boolean;
};

export type WorkspaceFolderImportLimits = {
  maxContentBytes: number;
  maxFiles: number;
  maxFolders: number;
  maxTreeDepth: number;
};

export type WorkspaceFolderImportOptions = {
  limits?: WorkspaceFolderImportLimits;
  requireMarkdown?: boolean;
  rootLabel?: string;
};

const workspaceRoomImportLimits: WorkspaceFolderImportLimits = {
  maxContentBytes: WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  maxFiles: WORKSPACE_ROOM_MAX_DOCUMENTS,
  maxFolders: WORKSPACE_ROOM_MAX_FOLDERS,
  maxTreeDepth: WORKSPACE_ROOM_MAX_TREE_DEPTH,
};

type FolderImportEntry = {
  file: File;
  segments: string[];
};

export type WorkspaceFolderImportDraft = {
  excludedPaths: readonly string[];
  sourceKind: "browser-copy" | "live-folder";
  workspace: WorkspaceState;
  profile: WorkspaceImportProfile;
};

export type WorkspaceFolderImportErrorCode =
  | "content-too-large"
  | "folder-tree-too-deep"
  | "no-markdown"
  | "too-many-files"
  | "too-many-folders";

export class WorkspaceFolderImportError extends Error {
  constructor(
    readonly code: WorkspaceFolderImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceFolderImportError";
  }
}

const textDecoder = new TextDecoder("utf-8", { fatal: true });

const decodeImportedFile = (bytes: Uint8Array) => {
  try {
    return textDecoder.decode(bytes);
  } catch {
    return encodeBinaryWorkspaceSupportFile(bytes);
  }
};

const getImportedArtifactContent = (bytes: Uint8Array) => {
  try {
    return {
      kind: "text" as const,
      text: textDecoder.decode(bytes),
      encoding: "utf-8" as const,
    };
  } catch {
    return { kind: "binary" as const, bytes };
  }
};

const parseRelativePath = (file: File) => {
  const rawPath = file.webkitRelativePath || file.name;
  const segments = rawPath.split("/");
  if (segments.length === 0 || segments.some((segment) => getWorkspacePathSegmentIssue(segment))) {
    throw new Error("This workspace folder contains an invalid path.");
  }
  return segments;
};

const extractSelectedRoot = (entries: FolderImportEntry[]) => {
  const selectedRoot = entries[0]?.segments[0];
  const hasSharedRoot = Boolean(
    selectedRoot &&
      entries.every((entry) => entry.file.webkitRelativePath && entry.segments.length > 1 && entry.segments[0] === selectedRoot),
  );
  return {
    entries: entries.map((entry) => ({
      ...entry,
      segments: hasSharedRoot ? entry.segments.slice(1) : entry.segments,
    })),
    selectedRoot: hasSharedRoot ? selectedRoot : undefined,
  };
};

export const parseWorkspaceFolderImport = async (
  selectedFiles: readonly File[],
  defaults: WorkspaceFolderImportDefaults,
  options: WorkspaceFolderImportOptions = {},
): Promise<WorkspaceFolderImportDraft> => {
  const limits = options.limits ?? workspaceRoomImportLimits;
  const parsedEntries = selectedFiles
    .map((file) => ({ file, segments: parseRelativePath(file) }))
    .sort((first, second) =>
      first.segments.join("/").localeCompare(second.segments.join("/")));
  const {
    entries: normalizedEntries,
    selectedRoot: inferredRoot,
  } = extractSelectedRoot(parsedEntries);
  const entries = normalizedEntries;
  const selectedRoot = options.rootLabel ?? inferredRoot;
  if (
    options.requireMarkdown !== false &&
    !entries.some(({ segments }) =>
      isMarkdownWorkspacePath(segments.at(-1) ?? ""))
  ) {
    throw new WorkspaceFolderImportError(
      "no-markdown",
      "This workspace folder does not contain any Markdown files.",
    );
  }

  if (entries.length > limits.maxFiles) {
    throw new WorkspaceFolderImportError(
      "too-many-files",
      `A workspace can contain up to ${limits.maxFiles} files.`,
    );
  }

  const folders: WorkspaceFolder[] = [createWorkspaceRootFolder(selectedRoot)];
  const files: WorkspaceFile[] = [];
  const folderIdsByPath = new Map<string, string>([["", WORKSPACE_ROOT_FOLDER_ID]]);
  let contentBytes = 0;

  const ensureFolder = (segments: readonly string[]) => {
    if (segments.length > limits.maxTreeDepth) {
      throw new WorkspaceFolderImportError(
        "folder-tree-too-deep",
        `A workspace folder can be up to ${limits.maxTreeDepth} levels deep.`,
      );
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
      if (folders.length - 1 >= limits.maxFolders) {
        throw new WorkspaceFolderImportError(
          "too-many-folders",
          `A workspace can contain up to ${limits.maxFolders} folders.`,
        );
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
    if (contentBytes > limits.maxContentBytes) {
      throw new WorkspaceFolderImportError(
        "content-too-large",
        "The file content in this workspace folder is too large.",
      );
    }
    const id = randomId();
    const path = segments.join("/");
    const artifact = await createWorkspaceArtifact({
      id,
      path,
      content: getImportedArtifactContent(bytes),
    });
    const isMdx = isMdxWorkspacePath(path);
    files.push(createWorkspaceFile(files.length + 1, {
      id,
      title: segments.at(-1) ?? file.name,
      text: decodeImportedFile(bytes),
      parentId: ensureFolder(segments.slice(0, -1)),
      viewMode: isMdx ? "edit" : defaults.viewMode,
      editingMode: isMdx ? "source" : undefined,
      readingWidth: defaults.readingWidth,
      lineWrapping: defaults.lineWrapping,
      lineNumbers: defaults.lineNumbers,
      artifact: {
        kind: artifact.kind,
        mediaType: artifact.mediaType,
        contentKind: artifact.content.kind,
        sourceHash: artifact.sourceHash,
        editable: artifact.editable,
      },
    }));
  }

  const workspace = finalizeWorkspaceState(files, undefined, {}, {
    folders,
    openFileIds: [],
  });
  const importedPaths = entries.map(({ segments }) => segments.join("/"));
  const supportFiles = entries.flatMap(({ segments }, index) => {
    const path = segments.join("/");
    const file = files[index];
    return file && !isMarkdownWorkspacePath(path)
      ? [{ path, text: file.text }]
      : [];
  });
  const { detectWorkspaceImportProfile } = await import(
    "./workspaceImportProfile"
  );
  return {
    excludedPaths: [],
    sourceKind: "browser-copy",
    workspace,
    profile: detectWorkspaceImportProfile({
      documents: getWorkspaceKnowledgeDocuments(
        workspace.files,
        workspace.folders,
      ),
      supportFiles,
      sourcePaths: normalizedEntries.map(({ segments }) => segments.join("/")),
      importedPaths,
    }),
  };
};

export const parseWorkspaceFolderFiles = async (
  selectedFiles: readonly File[],
  defaults: WorkspaceFolderImportDefaults,
): Promise<WorkspaceState> => (
  await parseWorkspaceFolderImport(selectedFiles, defaults)
).workspace;
