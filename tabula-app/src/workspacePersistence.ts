import type { WorkspaceState } from "./workspaceStorage";
import { writeIndexedDbWorkspace } from "./workspaceIndexedDb";

export const DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS = 400;

type TimerHandle = ReturnType<typeof setTimeout>;

type WorkspacePersistenceTimers = {
  clearTimeout: (timer: TimerHandle) => void;
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
};

type WorkspacePersistenceQueueOptions = {
  delayMs?: number;
  onError?: (error: unknown) => void;
  onPersisted?: (workspace: WorkspaceState) => void;
  timers?: WorkspacePersistenceTimers;
  writeWorkspace?: (workspace: WorkspaceState) => Promise<void> | void;
};

const defaultTimers: WorkspacePersistenceTimers = {
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
};

export const createWorkspacePersistenceQueue = ({
  delayMs = DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS,
  onError,
  onPersisted,
  timers = defaultTimers,
  writeWorkspace = writeWorkspaceToPrimaryStore,
}: WorkspacePersistenceQueueOptions = {}) => {
  let pendingWorkspace: WorkspaceState | null = null;
  let pendingTimer: TimerHandle | null = null;
  let queuedWrite: WorkspaceState | null = null;
  let writeInFlight = false;

  const clearPendingTimer = () => {
    if (!pendingTimer) return;
    timers.clearTimeout(pendingTimer);
    pendingTimer = null;
  };

  const finishWrite = () => {
    writeInFlight = false;
    const nextWorkspace = queuedWrite;
    queuedWrite = null;
    if (nextWorkspace) persist(nextWorkspace);
  };

  const persist = (workspace: WorkspaceState) => {
    if (writeInFlight) {
      queuedWrite = workspace;
      return;
    }
    writeInFlight = true;
    try {
      void Promise.resolve(writeWorkspace(workspace))
        .then(() => onPersisted?.(workspace))
        .catch(onError)
        .finally(finishWrite);
    } catch (error) {
      onError?.(error);
      finishWrite();
    }
  };

  const flush = () => {
    if (!pendingWorkspace) {
      clearPendingTimer();
      return;
    }
    const workspace = pendingWorkspace;
    pendingWorkspace = null;
    clearPendingTimer();
    persist(workspace);
  };

  return {
    cancel: () => {
      pendingWorkspace = null;
      clearPendingTimer();
    },
    flush,
    hasPending: () => Boolean(pendingWorkspace || queuedWrite),
    persistNow: (workspace: WorkspaceState) => {
      pendingWorkspace = null;
      clearPendingTimer();
      persist(workspace);
    },
    schedule: (workspace: WorkspaceState) => {
      pendingWorkspace = workspace;
      clearPendingTimer();
      pendingTimer = timers.setTimeout(flush, delayMs);
    },
  };
};

export const writeWorkspaceToPrimaryStore = (workspace: WorkspaceState) =>
  writeIndexedDbWorkspace(workspace);
