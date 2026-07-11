import { useEffect, useLayoutEffect, useRef } from "react";
import {
  createWorkspacePersistenceQueue,
  writeWorkspaceToPrimaryStore,
} from "../workspacePersistence";
import type { WorkspaceState } from "../workspaceStorage";

type UseQueuedWorkspacePersistenceOptions = {
  enabled?: boolean;
  getWorkspaceSnapshot?: () => WorkspaceState;
  onError?: (error: unknown) => void;
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
    onError,
    onBeforePersist,
  }: UseQueuedWorkspacePersistenceOptions = {},
) => {
  const onErrorRef = useRef(onError);
  const queueRef = useRef<ReturnType<typeof createWorkspacePersistenceQueue> | null>(null);

  if (!queueRef.current) {
    queueRef.current = createWorkspacePersistenceQueue({
      onError: (error) => onErrorRef.current?.(error),
    });
  }
  const enabledRef = useRef(enabled);
  const getWorkspaceSnapshotRef = useRef(getWorkspaceSnapshot);
  const latestWorkspaceRef = useRef(workspace);
  const onBeforePersistRef = useRef(onBeforePersist);

  useLayoutEffect(() => {
    enabledRef.current = enabled;
    getWorkspaceSnapshotRef.current = getWorkspaceSnapshot;
    latestWorkspaceRef.current = workspace;
    onErrorRef.current = onError;
    onBeforePersistRef.current = onBeforePersist;

    if (!enabled) {
      queueRef.current?.cancel();
      return;
    }

    queueRef.current?.schedule(workspace);
  }, [enabled, getWorkspaceSnapshot, onBeforePersist, onError, workspace]);

  useEffect(() => {
    if (!enabled) return;
    const workspaceSnapshot = getWorkspacePersistenceFlushSnapshot({
      getWorkspaceSnapshot: getWorkspaceSnapshotRef.current,
      latestWorkspace: latestWorkspaceRef.current,
      onBeforePersist: onBeforePersistRef.current,
    });
    void writeWorkspaceToPrimaryStore(workspaceSnapshot).catch((error: unknown) => {
      onErrorRef.current?.(error);
    });
  }, [enabled, workspace.activeFileId, workspace.openFileIds]);

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
      void writeWorkspaceToPrimaryStore(workspaceSnapshot).catch((error: unknown) => {
        onErrorRef.current?.(error);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPendingWorkspace();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPendingWorkspace);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPendingWorkspace);
      flushPendingWorkspace();
    };
  }, []);
};
