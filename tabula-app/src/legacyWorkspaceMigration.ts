import {
  getBrowserStorage,
  readBrowserStorage,
  removeBrowserStorage,
  type BrowserStorage,
} from "./browserStorage";
import { readIndexedDbWorkspace, writeIndexedDbWorkspace } from "./workspaceIndexedDb";
import { parseWorkspacePayload, type WorkspaceState } from "./workspaceStorage";

export const LEGACY_WORKSPACE_STORAGE_KEYS = [
  "tabula.project.v6",
  "tabula.project.v5",
] as const;

type LegacyWorkspaceStorage = Pick<BrowserStorage, "getItem" | "removeItem">;

type LegacyWorkspaceCandidate = {
  key: typeof LEGACY_WORKSPACE_STORAGE_KEYS[number];
  workspace: WorkspaceState;
};

const getWorkspaceSignature = (workspace: WorkspaceState) => JSON.stringify({
  activeFileId: workspace.activeFileId,
  commentsByFileId: workspace.commentsByFileId,
  files: workspace.files,
  folders: workspace.folders,
  openFileIds: workspace.openFileIds,
});

const isEmptyWorkspace = (workspace: WorkspaceState) =>
  workspace.files.length === 0 &&
  Object.values(workspace.commentsByFileId).every((comments) => comments.length === 0);

const parseStoredWorkspace = (value: string | null) => {
  if (!value) return null;
  try {
    return parseWorkspacePayload(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
};

export const readLegacyWorkspaceCandidate = (
  storage: Pick<LegacyWorkspaceStorage, "getItem"> | null = getBrowserStorage("localStorage"),
): LegacyWorkspaceCandidate | null => {
  for (const key of LEGACY_WORKSPACE_STORAGE_KEYS) {
    const workspace = parseStoredWorkspace(readBrowserStorage(storage, key));
    if (workspace) return { key, workspace };
  }
  return null;
};

const removeMatchingLegacyWorkspaces = (
  workspace: WorkspaceState,
  storage: LegacyWorkspaceStorage,
) => {
  const signature = getWorkspaceSignature(workspace);
  for (const key of LEGACY_WORKSPACE_STORAGE_KEYS) {
    const legacyWorkspace = parseStoredWorkspace(readBrowserStorage(storage, key));
    if (legacyWorkspace && getWorkspaceSignature(legacyWorkspace) === signature) {
      removeBrowserStorage(storage, key);
    }
  }
};

export const readWorkspaceWithLegacyMigration = async ({
  readWorkspace = readIndexedDbWorkspace,
  storage = getBrowserStorage("localStorage"),
  writeWorkspace = writeIndexedDbWorkspace,
}: {
  readWorkspace?: () => Promise<WorkspaceState | null>;
  storage?: LegacyWorkspaceStorage | null;
  writeWorkspace?: (workspace: WorkspaceState) => Promise<void>;
} = {}): Promise<WorkspaceState | null> => {
  const currentWorkspace = await readWorkspace();
  if ((currentWorkspace && !isEmptyWorkspace(currentWorkspace)) || !storage) {
    return currentWorkspace;
  }

  const candidate = readLegacyWorkspaceCandidate(storage);
  if (!candidate) return currentWorkspace;

  try {
    await writeWorkspace(candidate.workspace);
    const verifiedWorkspace = await readWorkspace();
    if (
      verifiedWorkspace &&
      getWorkspaceSignature(verifiedWorkspace) === getWorkspaceSignature(candidate.workspace)
    ) {
      removeMatchingLegacyWorkspaces(verifiedWorkspace, storage);
      return verifiedWorkspace;
    }
  } catch {
    // Keep the legacy copy and open it in memory when durable migration is unavailable.
  }

  return candidate.workspace;
};
