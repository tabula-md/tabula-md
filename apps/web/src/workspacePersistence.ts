import type { WorkspaceState } from "./workspaceStorage";
import { writeStoredWorkspace } from "./workspaceStorage";
import { writeIndexedDbWorkspace } from "./workspaceIndexedDb";

export const DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS = 400;

type TimerHandle = ReturnType<typeof setTimeout>;

type WorkspacePersistenceTimers = {
  clearTimeout: (timer: TimerHandle) => void;
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
};

type WorkspacePersistenceQueueOptions = {
  delayMs?: number;
  timers?: WorkspacePersistenceTimers;
  writeWorkspace?: (workspace: WorkspaceState) => void;
};

const defaultTimers: WorkspacePersistenceTimers = {
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
};

export const createWorkspacePersistenceQueue = ({
  delayMs = DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS,
  timers = defaultTimers,
  writeWorkspace = writeWorkspaceToPrimaryStores,
}: WorkspacePersistenceQueueOptions = {}) => {
  let pendingWorkspace: WorkspaceState | null = null;
  let pendingTimer: TimerHandle | null = null;

  const clearPendingTimer = () => {
    if (!pendingTimer) {
      return;
    }

    timers.clearTimeout(pendingTimer);
    pendingTimer = null;
  };

  const flush = () => {
    if (!pendingWorkspace) {
      clearPendingTimer();
      return;
    }

    const workspace = pendingWorkspace;
    pendingWorkspace = null;
    clearPendingTimer();
    writeWorkspace(workspace);
  };

  return {
    cancel: () => {
      pendingWorkspace = null;
      clearPendingTimer();
    },
    flush,
    hasPending: () => Boolean(pendingWorkspace),
    schedule: (workspace: WorkspaceState) => {
      pendingWorkspace = workspace;
      clearPendingTimer();
      pendingTimer = timers.setTimeout(flush, delayMs);
    },
  };
};

export const writeWorkspaceToPrimaryStores = (workspace: WorkspaceState) => {
  writeStoredWorkspace(workspace);
  void writeIndexedDbWorkspace(workspace).catch(() => {
    // localStorage remains the synchronous recovery path until IndexedDB hydrate is wired.
  });
};
