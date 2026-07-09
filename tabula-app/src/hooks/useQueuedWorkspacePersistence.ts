import { useEffect, useLayoutEffect, useRef } from "react";
import { createWorkspacePersistenceQueue } from "../workspacePersistence";
import { writeStoredWorkspace, type WorkspaceState } from "../workspaceStorage";

type UseQueuedWorkspacePersistenceOptions = {
  enabled?: boolean;
};

export const useQueuedWorkspacePersistence = (
  workspace: WorkspaceState,
  { enabled = true }: UseQueuedWorkspacePersistenceOptions = {},
) => {
  const queueRef = useRef<ReturnType<typeof createWorkspacePersistenceQueue> | null>(null);

  if (!queueRef.current) {
    queueRef.current = createWorkspacePersistenceQueue();
  }
  const enabledRef = useRef(enabled);
  const latestWorkspaceRef = useRef(workspace);

  useLayoutEffect(() => {
    enabledRef.current = enabled;
    latestWorkspaceRef.current = workspace;

    if (!enabled) {
      queueRef.current?.cancel();
      return;
    }

    queueRef.current?.schedule(workspace);
  }, [enabled, workspace]);

  useEffect(() => {
    const flushPendingWorkspace = () => {
      if (!enabledRef.current) {
        return;
      }

      queueRef.current?.flush();
      writeStoredWorkspace(latestWorkspaceRef.current);
    };

    window.addEventListener("pagehide", flushPendingWorkspace);
    return () => {
      window.removeEventListener("pagehide", flushPendingWorkspace);
      flushPendingWorkspace();
    };
  }, []);
};
