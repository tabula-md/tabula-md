import { useIndexedDbWorkspaceHydration } from "./useIndexedDbWorkspaceHydration";
import { useQueuedWorkspacePersistence } from "./useQueuedWorkspacePersistence";
import type { FileComment, WorkspaceState } from "../workspaceStorage";

type UseWorkspacePersistenceRuntimeOptions = {
  enabled: boolean;
  initialWorkspace: WorkspaceState;
  replaceCommentsByFileId: (
    commentsByFileId: Record<string, FileComment[]>,
  ) => void;
  replaceWorkspace: (
    workspace: Pick<WorkspaceState, "activeFileId" | "files" | "openFileIds">,
  ) => void;
  workspace: WorkspaceState;
};

export function useWorkspacePersistenceRuntime({
  enabled,
  initialWorkspace,
  replaceCommentsByFileId,
  replaceWorkspace,
  workspace,
}: UseWorkspacePersistenceRuntimeOptions) {
  const indexedDbHydration = useIndexedDbWorkspaceHydration({
    enabled,
    initialWorkspace,
    workspace,
    replaceCommentsByFileId,
    replaceWorkspace,
  });

  useQueuedWorkspacePersistence(workspace, {
    enabled: !indexedDbHydration.deferPersistence,
  });

  return indexedDbHydration;
}
