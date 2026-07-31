import type { WorkspaceState } from "../workspaceStorage";
import { writeIndexedDbWorkspace } from "./workspaceIndexedDb";

export const DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS = 400;

type TimerHandle = ReturnType<typeof setTimeout>;
type QueuedWorkspaceWrite = {
  revision: number;
  workspace: WorkspaceState;
};
type PersistenceWaiter = {
  resolve: (persisted: boolean) => void;
  revision: number;
};

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
  let pendingWrite: QueuedWorkspaceWrite | null = null;
  let pendingTimer: TimerHandle | null = null;
  let queuedWrite: QueuedWorkspaceWrite | null = null;
  let writeInFlight = false;
  let nextRevision = 0;
  let waiters: PersistenceWaiter[] = [];

  const clearPendingTimer = () => {
    if (!pendingTimer) return;
    timers.clearTimeout(pendingTimer);
    pendingTimer = null;
  };

  const settleWaiters = (revision: number, persisted: boolean) => {
    const settled = waiters.filter((waiter) => waiter.revision <= revision);
    waiters = waiters.filter((waiter) => waiter.revision > revision);
    settled.forEach((waiter) => waiter.resolve(persisted));
  };

  const finishWrite = () => {
    writeInFlight = false;
    const nextWrite = queuedWrite;
    queuedWrite = null;
    if (nextWrite) persist(nextWrite);
  };

  const persist = (write: QueuedWorkspaceWrite) => {
    if (writeInFlight) {
      queuedWrite = write;
      return;
    }
    writeInFlight = true;
    try {
      void Promise.resolve(writeWorkspace(write.workspace))
        .then(() => {
          onPersisted?.(write.workspace);
          settleWaiters(write.revision, true);
        })
        .catch((error) => {
          onError?.(error);
          settleWaiters(write.revision, false);
        })
        .finally(finishWrite);
    } catch (error) {
      onError?.(error);
      settleWaiters(write.revision, false);
      finishWrite();
    }
  };

  const flush = () => {
    if (!pendingWrite) {
      clearPendingTimer();
      return;
    }
    const write = pendingWrite;
    pendingWrite = null;
    clearPendingTimer();
    persist(write);
  };

  return {
    cancel: () => {
      pendingWrite = null;
      clearPendingTimer();
    },
    flush,
    hasPending: () => Boolean(pendingWrite || queuedWrite),
    persistNow: (workspace: WorkspaceState) => {
      const write = { revision: ++nextRevision, workspace };
      const completion = new Promise<boolean>((resolve) => {
        waiters.push({ resolve, revision: write.revision });
      });
      pendingWrite = null;
      clearPendingTimer();
      persist(write);
      return completion;
    },
    schedule: (workspace: WorkspaceState) => {
      pendingWrite = { revision: ++nextRevision, workspace };
      clearPendingTimer();
      pendingTimer = timers.setTimeout(flush, delayMs);
    },
  };
};

export const writeWorkspaceToPrimaryStore = (workspace: WorkspaceState) =>
  writeIndexedDbWorkspace(workspace);
