import {
  WORKSPACE_ROOM_MAX_TREE_DEPTH,
  createWorkspaceArtifact,
  getExternalArtifactChanges,
  getWorkspaceArtifactBytes,
  type ArtifactChange,
  type WorkspaceArtifact,
  type WorkspaceSnapshot,
  type WorkspaceSourceAdapter,
  type WorkspaceSourceCapabilities,
  type WriteResult,
} from "@tabula-md/tabula";
import { getWorkspaceFilePaths } from "../workspaceDisplayTitles";
import type {
  WorkspaceFile,
  WorkspaceFolder,
  WorkspaceState,
} from "../workspaceStorage";
import { decodeBinaryWorkspaceSupportFile } from "./workspaceSupportFile";
import {
  parseWorkspaceFolderImport,
  type WorkspaceFolderImportDefaults,
  type WorkspaceFolderImportDraft,
  type WorkspaceFolderImportLimits,
} from "./workspaceFolderImport";

type PermissionStateValue = "denied" | "granted" | "prompt";

export type LiveFolderFile = {
  arrayBuffer(): Promise<ArrayBuffer>;
  size?: number;
};

export type LiveFolderWritable = {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
};

export type LiveFolderFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<LiveFolderFile>;
  createWritable(): Promise<LiveFolderWritable>;
};

export type LiveFolderDirectoryHandle = {
  kind: "directory";
  name: string;
  entries(): AsyncIterableIterator<
    [string, LiveFolderDirectoryHandle | LiveFolderFileHandle]
  >;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<LiveFolderDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<LiveFolderFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  queryPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionStateValue>;
  requestPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionStateValue>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: string;
  }) => Promise<LiveFolderDirectoryHandle>;
};

const textDecoder = new TextDecoder("utf-8", { fatal: true });

const getArtifactContent = (bytes: Uint8Array) => {
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

const assertSafeRelativePath = (path: string) => {
  const segments = path.split("/");
  if (
    !path ||
    path.startsWith("/") ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\"),
    )
  ) {
    throw new Error(`Invalid live folder path: ${path}`);
  }
  return segments;
};

const readFileArtifact = async (
  handle: LiveFolderFileHandle,
  path: string,
): Promise<WorkspaceArtifact> => {
  const file = await handle.getFile();
  const bytes = new Uint8Array(await file.arrayBuffer());
  return createWorkspaceArtifact({
    id: path,
    path,
    content: getArtifactContent(bytes),
  });
};

const ignoredDirectoryNames = new Set([
  ".cache",
  ".git",
  ".hg",
  ".next",
  ".nuxt",
  ".pnpm-store",
  ".svn",
  ".turbo",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "venv",
]);

const liveFolderImportLimits: WorkspaceFolderImportLimits = {
  maxContentBytes: 100 * 1024 * 1024,
  maxFiles: 5_000,
  maxFolders: 2_000,
  maxTreeDepth: WORKSPACE_ROOM_MAX_TREE_DEPTH,
};

const isIgnoredLiveFolderDirectory = (
  name: string,
  path: string,
) =>
  ignoredDirectoryNames.has(name) ||
  path === ".yarn/cache" ||
  path === ".yarn/unplugged";

type LiveFolderReadResult = {
  artifacts: WorkspaceArtifact[];
  excludedPaths: string[];
};

const readDirectoryArtifacts = async (
  directory: LiveFolderDirectoryHandle,
  parentPath = "",
): Promise<LiveFolderReadResult> => {
  const artifacts: WorkspaceArtifact[] = [];
  const excludedPaths: string[] = [];
  for await (const [name, handle] of directory.entries()) {
    const path = parentPath ? `${parentPath}/${name}` : name;
    if (handle.kind === "directory") {
      if (isIgnoredLiveFolderDirectory(name, path)) {
        excludedPaths.push(`${path}/`);
        continue;
      }
      const nested = await readDirectoryArtifacts(handle, path);
      artifacts.push(...nested.artifacts);
      excludedPaths.push(...nested.excludedPaths);
    } else {
      try {
        artifacts.push(await readFileArtifact(handle, path));
      } catch {
        excludedPaths.push(path);
      }
    }
  }
  return {
    artifacts: artifacts.sort((first, second) =>
      first.path.localeCompare(second.path)),
    excludedPaths: excludedPaths.sort((first, second) =>
      first.localeCompare(second)),
  };
};

export const readLiveFolderSnapshot = async (
  directory: LiveFolderDirectoryHandle,
): Promise<WorkspaceSnapshot> => {
  const { artifacts, excludedPaths } = await readDirectoryArtifacts(directory);
  return {
    artifacts,
    capturedAt: new Date().toISOString(),
    excludedPaths,
  };
};

const getParentDirectory = async (
  root: LiveFolderDirectoryHandle,
  path: string,
  create: boolean,
) => {
  const segments = assertSafeRelativePath(path);
  const name = segments.pop()!;
  let directory = root;
  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, { create });
  }
  return { directory, name };
};

const readArtifactAtPath = async (
  root: LiveFolderDirectoryHandle,
  path: string,
) => {
  try {
    const { directory, name } = await getParentDirectory(root, path, false);
    const handle = await directory.getFileHandle(name);
    return await readFileArtifact(handle, path);
  } catch {
    return undefined;
  }
};

const writeArtifact = async (
  root: LiveFolderDirectoryHandle,
  artifact: WorkspaceArtifact,
) => {
  const { directory, name } = await getParentDirectory(
    root,
    artifact.path,
    true,
  );
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(Uint8Array.from(
      getWorkspaceArtifactBytes(artifact.content),
    ).buffer);
  } finally {
    await writable.close();
  }
};

const hasWritePermission = async (
  directory: LiveFolderDirectoryHandle,
  request: boolean,
) => {
  const descriptor = { mode: "readwrite" as const };
  const current = await directory.queryPermission?.(descriptor);
  if (current === "granted" || current === undefined) return true;
  if (!request || !directory.requestPermission) return false;
  return await directory.requestPermission(descriptor) === "granted";
};

const capabilities = (
  canWrite: boolean,
): WorkspaceSourceCapabilities => ({
  canRead: true,
  canWrite,
  canCreate: canWrite,
  canMove: canWrite,
  canDelete: canWrite,
  canCheckExternalChanges: true,
});

export const createLiveFolderSourceAdapter = (
  directory: LiveFolderDirectoryHandle,
): WorkspaceSourceAdapter => {
  const readSnapshot = () => readLiveFolderSnapshot(directory);
  const writeChanges = async (
    changes: readonly ArtifactChange[],
  ): Promise<WriteResult> => {
    if (!await hasWritePermission(directory, true)) {
      return { ok: false, reason: "permission" };
    }
    try {
      for (const change of changes) {
        if (change.type === "create") {
          if (await readArtifactAtPath(directory, change.artifact.path)) {
            return { ok: false, reason: "conflict" };
          }
          await writeArtifact(directory, change.artifact);
          continue;
        }
        if (change.type === "update") {
          const current = await readArtifactAtPath(
            directory,
            change.artifact.path,
          );
          if (
            !current ||
            (
              change.expectedSourceHash &&
              current.sourceHash !== change.expectedSourceHash
            )
          ) {
            return { ok: false, reason: "conflict" };
          }
          await writeArtifact(directory, change.artifact);
          continue;
        }
        if (change.type === "move") {
          const current = await readArtifactAtPath(directory, change.fromPath);
          if (
            !current ||
            await readArtifactAtPath(directory, change.toPath)
          ) {
            return { ok: false, reason: "conflict" };
          }
          await writeArtifact(directory, {
            ...current,
            id: change.artifactId,
            path: change.toPath,
          });
          const { directory: parent, name } = await getParentDirectory(
            directory,
            change.fromPath,
            false,
          );
          await parent.removeEntry(name);
          continue;
        }
        const current = await readArtifactAtPath(directory, change.path);
        if (
          !current ||
          (
            change.expectedSourceHash &&
            current.sourceHash !== change.expectedSourceHash
          )
        ) {
          return { ok: false, reason: "conflict" };
        }
        const { directory: parent, name } = await getParentDirectory(
          directory,
          change.path,
          false,
        );
        await parent.removeEntry(name);
      }
      return { ok: true, snapshot: await readSnapshot() };
    } catch (error) {
      return { ok: false, reason: "unknown", error };
    }
  };

  return {
    source: {
      id: `live-folder:${directory.name}`,
      kind: "live-folder",
      label: directory.name,
    },
    readSnapshot,
    getCapabilities: () => capabilities(true),
    writeChanges,
    checkExternalChanges: async (baseline) => {
      const snapshot = await readSnapshot();
      return {
        snapshot,
        changes: getExternalArtifactChanges(baseline, snapshot),
      };
    },
  };
};

export const isLiveFolderSupported = () =>
  typeof window !== "undefined" &&
  typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";

export const pickLiveFolderSourceAdapter = async () => {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return null;
  const directory = await picker({
    id: "tabula-live-workspace",
    mode: "readwrite",
  });
  if (!await hasWritePermission(directory, true)) {
    throw new DOMException(
      "Write permission was not granted.",
      "NotAllowedError",
    );
  }
  return createLiveFolderSourceAdapter(directory);
};

export const createArtifactSnapshotFromWorkspace = async (
  files: readonly WorkspaceFile[],
  folders: readonly WorkspaceFolder[],
): Promise<WorkspaceSnapshot> => {
  const paths = getWorkspaceFilePaths(files, folders);
  const artifacts = await Promise.all(files.map(async (file) => {
    const path = paths.get(file.id) ?? file.title;
    const binary = decodeBinaryWorkspaceSupportFile(path, file.text);
    return createWorkspaceArtifact({
      id: file.id,
      path,
      kind: file.artifact?.kind,
      mediaType: file.artifact?.mediaType,
      editable: file.artifact?.editable,
      content: binary
        ? { kind: "binary", bytes: binary }
        : { kind: "text", text: file.text, encoding: "utf-8" },
    });
  }));
  return {
    artifacts,
    capturedAt: new Date().toISOString(),
  };
};

export type LiveFolderWorkspaceWritePlan = {
  changes: ArtifactChange[];
  deletes: Extract<ArtifactChange, { type: "delete" }>[];
};

export const getLiveFolderWorkspaceWritePlan = (
  baseline: WorkspaceSnapshot,
  local: WorkspaceSnapshot,
): LiveFolderWorkspaceWritePlan => {
  const baselineById = new Map(
    baseline.artifacts.map((artifact) => [artifact.id, artifact]),
  );
  const localById = new Map(
    local.artifacts.map((artifact) => [artifact.id, artifact]),
  );
  const changes: ArtifactChange[] = [];
  const deletes: Extract<ArtifactChange, { type: "delete" }>[] = [];

  for (const artifact of local.artifacts) {
    const previous = baselineById.get(artifact.id);
    if (!previous) {
      changes.push({ type: "create", artifact });
      continue;
    }
    if (previous.path !== artifact.path) {
      changes.push({
        type: "move",
        artifactId: artifact.id,
        fromPath: previous.path,
        toPath: artifact.path,
      });
    }
    if (previous.sourceHash !== artifact.sourceHash) {
      changes.push({
        type: "update",
        artifact,
        expectedSourceHash: previous.sourceHash,
      });
    }
  }
  for (const artifact of baseline.artifacts) {
    if (localById.has(artifact.id)) continue;
    deletes.push({
      type: "delete",
      artifactId: artifact.id,
      path: artifact.path,
      expectedSourceHash: artifact.sourceHash,
    });
  }
  return { changes, deletes };
};

const snapshotArtifactFiles = (
  snapshot: WorkspaceSnapshot,
  rootLabel: string,
) => snapshot.artifacts.map((artifact) => {
  const bytes = Uint8Array.from(getWorkspaceArtifactBytes(artifact.content));
  const name = artifact.path.split("/").at(-1) ?? artifact.path;
  const file = new File([bytes], name, { type: artifact.mediaType });
  Object.defineProperty(file, "webkitRelativePath", {
    configurable: true,
    value: `${rootLabel}/${artifact.path}`,
  });
  return file;
});

export const createWorkspaceDraftFromArtifactSnapshot = async (
  snapshot: WorkspaceSnapshot,
  rootLabel: string,
  defaults: WorkspaceFolderImportDefaults,
  previous?: Pick<
    WorkspaceState,
    "activeFileId" | "files" | "folders" | "openFileIds"
  >,
): Promise<WorkspaceFolderImportDraft> => {
  const draft = await parseWorkspaceFolderImport(
    snapshotArtifactFiles(snapshot, rootLabel),
    defaults,
    {
      limits: liveFolderImportLimits,
      requireMarkdown: false,
      rootLabel,
    },
  );
  const draftWithExclusions = {
    ...draft,
    excludedPaths: snapshot.excludedPaths ?? [],
    sourceKind: "live-folder" as const,
    profile: {
      ...draft.profile,
      ignoredFileCount:
        draft.profile.ignoredFileCount + (snapshot.excludedPaths?.length ?? 0),
    },
  };
  if (!previous) return draftWithExclusions;

  const previousPaths = getWorkspaceFilePaths(
    previous.files,
    previous.folders,
  );
  const previousByPath = new Map(
    previous.files.map((file) => [previousPaths.get(file.id) ?? file.title, file]),
  );
  const unmatchedPrevious = new Set(previous.files);
  const draftPaths = getWorkspaceFilePaths(
    draft.workspace.files,
    draft.workspace.folders,
  );
  const remappedFiles = draft.workspace.files.map((file) => {
    const path = draftPaths.get(file.id) ?? file.title;
    const samePath = previousByPath.get(path);
    const sameHash = !samePath && file.artifact?.sourceHash
      ? [...unmatchedPrevious].find(
          (candidate) =>
            candidate.artifact?.sourceHash === file.artifact?.sourceHash,
        )
      : undefined;
    const previousFile = samePath ?? sameHash;
    if (!previousFile) return file;
    unmatchedPrevious.delete(previousFile);
    return {
      ...previousFile,
      title: file.title,
      text: file.text,
      parentId: file.parentId,
      artifact: file.artifact,
    };
  });
  const fileIds = new Set(remappedFiles.map((file) => file.id));
  return {
    ...draftWithExclusions,
    workspace: {
      ...draftWithExclusions.workspace,
      files: remappedFiles,
      activeFileId: fileIds.has(previous.activeFileId)
        ? previous.activeFileId
        : (remappedFiles[0]?.id ?? ""),
      openFileIds: previous.openFileIds.filter((id) => fileIds.has(id)),
    },
  };
};
