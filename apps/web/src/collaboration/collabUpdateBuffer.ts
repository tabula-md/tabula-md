type TimeoutHandle = unknown;

type CollabUpdateBufferOptions = {
  delayMs: number;
  onFlush: (update: Uint8Array) => void;
  mergeUpdates: (updates: readonly Uint8Array[]) => Uint8Array;
  setTimeoutFn?: (callback: () => void, delayMs: number) => TimeoutHandle;
  clearTimeoutFn?: (handle: TimeoutHandle) => void;
};

const defaultSetTimeout = (callback: () => void, delayMs: number): TimeoutHandle => setTimeout(callback, delayMs);
const defaultClearTimeout = (handle: TimeoutHandle) => clearTimeout(handle as ReturnType<typeof setTimeout>);

export type CollabUpdateBuffer = {
  push(update: Uint8Array): void;
  flush(): void;
  clear(): void;
  getPendingCount(): number;
};

export const createCollabUpdateBuffer = ({
  delayMs,
  onFlush,
  mergeUpdates,
  setTimeoutFn = defaultSetTimeout,
  clearTimeoutFn = defaultClearTimeout,
}: CollabUpdateBufferOptions): CollabUpdateBuffer => {
  let timer: TimeoutHandle | undefined;
  let pendingUpdates: Uint8Array[] = [];

  const clearTimer = () => {
    if (timer) {
      clearTimeoutFn(timer);
      timer = undefined;
    }
  };

  const flush = () => {
    clearTimer();
    if (pendingUpdates.length === 0) {
      return;
    }

    const update = pendingUpdates.length === 1 ? pendingUpdates[0] : mergeUpdates(pendingUpdates);
    pendingUpdates = [];
    onFlush(update);
  };

  return {
    push(update) {
      pendingUpdates.push(update);
      if (!timer) {
        timer = setTimeoutFn(flush, delayMs);
      }
    },
    flush,
    clear() {
      clearTimer();
      pendingUpdates = [];
    },
    getPendingCount() {
      return pendingUpdates.length;
    },
  };
};
