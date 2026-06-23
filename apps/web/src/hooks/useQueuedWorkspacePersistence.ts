import { useEffect, useRef } from "react";
import { createWorkspacePersistenceQueue } from "../workspacePersistence";
import type { WorkspaceState } from "../workspaceStorage";

export const useQueuedWorkspacePersistence = (workspace: WorkspaceState) => {
  const queueRef = useRef<ReturnType<typeof createWorkspacePersistenceQueue> | null>(null);

  if (!queueRef.current) {
    queueRef.current = createWorkspacePersistenceQueue();
  }

  useEffect(() => {
    queueRef.current?.schedule(workspace);
  }, [workspace]);

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
