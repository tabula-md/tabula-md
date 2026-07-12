import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspacePersistenceQueue,
  DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS,
  writeWorkspaceToPrimaryStore,
} from "./workspacePersistence";
import { getWorkspacePersistenceFlushSnapshot } from "./hooks/useQueuedWorkspacePersistence";
import { createWorkspaceFile, createWorkspaceRootFolder, type WorkspaceState } from "./workspaceStorage";
import { writeIndexedDbWorkspace } from "./workspaceIndexedDb";

vi.mock("./workspaceIndexedDb", () => ({
  writeIndexedDbWorkspace: vi.fn(() => Promise.resolve()),
}));

const createWorkspace = (text: string): WorkspaceState => ({
  folders: [createWorkspaceRootFolder()],
  files: [createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text })],
  openFileIds: ["local"],
  activeFileId: "local",
  commentsByFileId: {},
});

describe("workspace persistence queue", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces workspace writes", () => {
    vi.useFakeTimers();
    const writeWorkspace = vi.fn();
    const queue = createWorkspacePersistenceQueue({ writeWorkspace });

    queue.schedule(createWorkspace("# Draft"));
    vi.advanceTimersByTime(DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS - 1);

    expect(writeWorkspace).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(writeWorkspace).toHaveBeenCalledTimes(1);
    expect(writeWorkspace).toHaveBeenCalledWith(createWorkspace("# Draft"));
  });

  it("flushes only the latest queued workspace", () => {
    vi.useFakeTimers();
    const writeWorkspace = vi.fn();
    const queue = createWorkspacePersistenceQueue({ writeWorkspace });

    queue.schedule(createWorkspace("# First"));
    vi.advanceTimersByTime(100);
    queue.schedule(createWorkspace("# Latest"));
    vi.advanceTimersByTime(DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS);

    expect(writeWorkspace).toHaveBeenCalledTimes(1);
    expect(writeWorkspace).toHaveBeenCalledWith(createWorkspace("# Latest"));
  });

  it("flushes pending writes immediately without double writing later", () => {
    vi.useFakeTimers();
    const writeWorkspace = vi.fn();
    const queue = createWorkspacePersistenceQueue({ writeWorkspace });

    queue.schedule(createWorkspace("# Pending"));
    queue.flush();
    vi.runOnlyPendingTimers();

    expect(writeWorkspace).toHaveBeenCalledTimes(1);
    expect(writeWorkspace).toHaveBeenCalledWith(createWorkspace("# Pending"));
    expect(queue.hasPending()).toBe(false);
  });

  it("cancels pending writes", () => {
    vi.useFakeTimers();
    const writeWorkspace = vi.fn();
    const queue = createWorkspacePersistenceQueue({ writeWorkspace });

    queue.schedule(createWorkspace("# Cancel"));
    queue.cancel();
    vi.runOnlyPendingTimers();

    expect(writeWorkspace).not.toHaveBeenCalled();
    expect(queue.hasPending()).toBe(false);
  });

  it("reports a workspace only after its write succeeds", async () => {
    const persistedWorkspace = createWorkspace("# Saved");
    const onPersisted = vi.fn();
    const queue = createWorkspacePersistenceQueue({
      onPersisted,
      writeWorkspace: vi.fn().mockResolvedValue(undefined),
    });

    queue.persistNow(persistedWorkspace);

    await vi.waitFor(() => expect(onPersisted).toHaveBeenCalledWith(persistedWorkspace));
  });

  it("serializes writes and keeps only the latest state while a write is in flight", async () => {
    let finishFirstWrite: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => {
      finishFirstWrite = resolve;
    });
    const writeWorkspace = vi.fn()
      .mockReturnValueOnce(firstWrite)
      .mockResolvedValue(undefined);
    const queue = createWorkspacePersistenceQueue({ writeWorkspace });

    queue.persistNow(createWorkspace("# First"));
    queue.persistNow(createWorkspace("# Superseded"));
    queue.persistNow(createWorkspace("# Latest"));

    expect(writeWorkspace).toHaveBeenCalledTimes(1);
    finishFirstWrite?.();
    await firstWrite;
    await vi.waitFor(() => expect(writeWorkspace).toHaveBeenCalledTimes(2));
    expect(writeWorkspace).toHaveBeenLastCalledWith(createWorkspace("# Latest"));
  });

  it("does not discard an accepted write when a later debounce is cancelled", async () => {
    let finishFirstWrite: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => {
      finishFirstWrite = resolve;
    });
    const writeWorkspace = vi.fn()
      .mockReturnValueOnce(firstWrite)
      .mockResolvedValue(undefined);
    const queue = createWorkspacePersistenceQueue({ writeWorkspace });

    queue.persistNow(createWorkspace("# First"));
    queue.persistNow(createWorkspace("# Accepted latest"));
    queue.schedule(createWorkspace("# Debounced only"));
    queue.cancel();
    finishFirstWrite?.();
    await firstWrite;
    await vi.waitFor(() => expect(writeWorkspace).toHaveBeenCalledTimes(2));

    expect(writeWorkspace).toHaveBeenLastCalledWith(createWorkspace("# Accepted latest"));
  });

  it("resolves pagehide flush snapshots after the editor runtime flushes", () => {
    let pendingText = "# Pending";
    const latestWorkspace = createWorkspace("# Stale");
    const onBeforePersist = vi.fn(() => {
      pendingText = "# Flushed";
    });

    const snapshot = getWorkspacePersistenceFlushSnapshot({
      latestWorkspace,
      onBeforePersist,
      getWorkspaceSnapshot: () => createWorkspace(pendingText),
    });

    expect(onBeforePersist).toHaveBeenCalledTimes(1);
    expect(snapshot.files[0]?.text).toBe("# Flushed");
  });
});

describe("workspace primary store writes", () => {
  afterEach(() => {
    vi.mocked(writeIndexedDbWorkspace).mockClear();
  });

  it("persists only through the IndexedDB adapter", async () => {
    await writeWorkspaceToPrimaryStore(createWorkspace("# IndexedDB only"));

    expect(writeIndexedDbWorkspace).toHaveBeenCalledWith(createWorkspace("# IndexedDB only"));
  });
});
