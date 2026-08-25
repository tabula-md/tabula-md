import { useIndexedDbWorkspaceHydration } from "./useIndexedDbWorkspaceHydration";
import { useQueuedWorkspacePersistence } from "./useQueuedWorkspacePersistence";
import type { WorkspaceKnowledgeBaseline } from "@tabula-md/tabula";
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
  replaceKnowledgeBaseline: (baseline?: WorkspaceKnowledgeBaseline) => void;
  replaceWorkspace: (
    workspace: Pick<WorkspaceState, "activeFileId" | "files" | "folders" | "openFileIds">,
  ) => void;
  workspace: WorkspaceState;
};

export const isQueuedWorkspacePersistenceEnabled = ({
  enabled,
  deferPersistence,
}: {
  enabled: boolean;
  deferPersistence: boolean;
}) => enabled && !deferPersistence;

export function useWorkspacePersistenceRuntime({
  enabled,
  getWorkspaceSnapshot,
  initialWorkspace,
  onBeforePersist,
  onError,
  replaceCommentsByFileId,
  replaceKnowledgeBaseline,
  replaceWorkspace,
  workspace,
}: UseWorkspacePersistenceRuntimeOptions) {
  const indexedDbHydration = useIndexedDbWorkspaceHydration({
    enabled,
    initialWorkspace,
    onError,
    workspace,
    replaceCommentsByFileId,
    replaceKnowledgeBaseline,
    replaceWorkspace,
  });

  const persistence = useQueuedWorkspacePersistence(workspace, {
    enabled: isQueuedWorkspacePersistenceEnabled({
      enabled,
      deferPersistence: indexedDbHydration.deferPersistence,
    }),
    getWorkspaceSnapshot,
    onError,
    onBeforePersist,
  });

  return { ...indexedDbHydration, ...persistence };
}
