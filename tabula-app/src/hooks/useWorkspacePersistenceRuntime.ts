import { useIndexedDbWorkspaceHydration } from "./useIndexedDbWorkspaceHydration";
import { useQueuedWorkspacePersistence } from "./useQueuedWorkspacePersistence";
import type { FileComment, WorkspaceState } from "../workspaceStorage";

type UseWorkspacePersistenceRuntimeOptions = {
  enabled: boolean;
  getWorkspaceSnapshot?: () => WorkspaceState;
  initialWorkspace: WorkspaceState;
  onBeforePersist?: () => void;
  onError?: (error: unknown) => void;
  replaceCommentsByFileId: (
    commentsByFileId: Record<string, FileComment[]>,
  ) => void;
  replaceWorkspace: (
    workspace: Pick<WorkspaceState, "activeFileId" | "files" | "folders" | "openFileIds">,
  ) => void;
  workspace: WorkspaceState;
};

export function useWorkspacePersistenceRuntime({
  enabled,
  getWorkspaceSnapshot,
  initialWorkspace,
  onBeforePersist,
  onError,
  replaceCommentsByFileId,
  replaceWorkspace,
  workspace,
}: UseWorkspacePersistenceRuntimeOptions) {
  const indexedDbHydration = useIndexedDbWorkspaceHydration({
    enabled,
    initialWorkspace,
    onError,
    workspace,
    replaceCommentsByFileId,
    replaceWorkspace,
  });

  useQueuedWorkspacePersistence(workspace, {
    enabled: !indexedDbHydration.deferPersistence,
    getWorkspaceSnapshot,
    onError,
    onBeforePersist,
  });

  return indexedDbHydration;
}
