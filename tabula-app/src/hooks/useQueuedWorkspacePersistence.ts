import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  createWorkspacePersistenceQueue,
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
  const [persistedRevision, setPersistedRevision] = useState(0);
  const mountedRef = useRef(true);
  const onErrorRef = useRef(onError);
  const queueRef = useRef<ReturnType<typeof createWorkspacePersistenceQueue> | null>(null);

  if (!queueRef.current) {
    queueRef.current = createWorkspacePersistenceQueue({
      onError: (error) => onErrorRef.current?.(error),
      onPersisted: () => {
        if (mountedRef.current) setPersistedRevision((revision) => revision + 1);
      },
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const workspaceSnapshot = getWorkspacePersistenceFlushSnapshot({
      getWorkspaceSnapshot: getWorkspaceSnapshotRef.current,
      latestWorkspace: latestWorkspaceRef.current,
      onBeforePersist: onBeforePersistRef.current,
    });
    queueRef.current?.persistNow(workspaceSnapshot);
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
      queueRef.current?.persistNow(workspaceSnapshot);
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

  return { persistedRevision };
};
