import { useEffect, useLayoutEffect, useRef } from "react";
import {
  createWorkspacePersistenceQueue,
  writeWorkspaceToPrimaryStores,
} from "../workspacePersistence";
import { writeStoredWorkspace, type WorkspaceState } from "../workspaceStorage";

type UseQueuedWorkspacePersistenceOptions = {
  enabled?: boolean;
  getWorkspaceSnapshot?: () => WorkspaceState;
  onBeforePersist?: () => void;
};

export const getWorkspacePersistenceFlushSnapshot = ({
  getWorkspaceSnapshot,
  latestWorkspace,
  onBeforePersist,
}: {
  getWorkspaceSnapshot?: () => WorkspaceState;
  latestWorkspace: WorkspaceState;
  onBeforePersist?: () => void;
}) => {
  onBeforePersist?.();
  return getWorkspaceSnapshot?.() ?? latestWorkspace;
};

export const useQueuedWorkspacePersistence = (
  workspace: WorkspaceState,
  {
    enabled = true,
    getWorkspaceSnapshot,
    onBeforePersist,
  }: UseQueuedWorkspacePersistenceOptions = {},
) => {
  const queueRef = useRef<ReturnType<typeof createWorkspacePersistenceQueue> | null>(null);

  if (!queueRef.current) {
    queueRef.current = createWorkspacePersistenceQueue();
  }
  const enabledRef = useRef(enabled);
  const getWorkspaceSnapshotRef = useRef(getWorkspaceSnapshot);
  const latestWorkspaceRef = useRef(workspace);
  const onBeforePersistRef = useRef(onBeforePersist);

  useLayoutEffect(() => {
    enabledRef.current = enabled;
    getWorkspaceSnapshotRef.current = getWorkspaceSnapshot;
    latestWorkspaceRef.current = workspace;
    onBeforePersistRef.current = onBeforePersist;

    if (!enabled) {
      queueRef.current?.cancel();
      return;
    }

    queueRef.current?.schedule(workspace);
  }, [enabled, getWorkspaceSnapshot, onBeforePersist, workspace]);

  useEffect(() => {
    const flushPendingWorkspace = () => {
      if (!enabledRef.current) {
        return;
      }

      const workspaceSnapshot = getWorkspacePersistenceFlushSnapshot({
        getWorkspaceSnapshot: getWorkspaceSnapshotRef.current,
        latestWorkspace: latestWorkspaceRef.current,
        onBeforePersist: onBeforePersistRef.current,
      });
      queueRef.current?.cancel();
      writeWorkspaceToPrimaryStores(workspaceSnapshot);
      writeStoredWorkspace(workspaceSnapshot);
    };

    window.addEventListener("pagehide", flushPendingWorkspace);
    return () => {
      window.removeEventListener("pagehide", flushPendingWorkspace);
      flushPendingWorkspace();
    };
  }, []);
};
