import { useEffect, useRef } from "react";
import { createWorkspacePersistenceQueue } from "../workspacePersistence";
import type { WorkspaceState } from "../workspaceStorage";

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

  useEffect(() => {
    if (!enabled) {
      queueRef.current?.cancel();
      return;
    }

    queueRef.current?.schedule(workspace);
  }, [enabled, workspace]);

  useEffect(() => {
    const flushPendingWorkspace = () => {
      queueRef.current?.flush();
    };

    window.addEventListener("pagehide", flushPendingWorkspace);
    return () => {
      window.removeEventListener("pagehide", flushPendingWorkspace);
      flushPendingWorkspace();
    };
  }, []);
};
