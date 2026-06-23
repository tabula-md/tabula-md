import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkspacePersistenceQueue, DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS } from "./workspacePersistence";
import {
  createMarkdownFile,
  createStoredWorkspace,
  readStoredWorkspace,
  type WorkspaceState,
  type WorkspaceStorageAdapter,
} from "./workspaceStorage";

const createWorkspace = (text: string): WorkspaceState => ({
  files: [createMarkdownFile(1, { id: "local", title: "LOCAL.md", text })],
  openFileIds: ["local"],
  activeFileId: "local",
  commentsByFileId: {},
});

describe("workspace persistence queue", () => {
  afterEach(() => {
    vi.useRealTimers();
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
});

describe("workspace storage adapter", () => {
  it("loads persisted project payloads through the storage adapter", () => {
    const stored = createStoredWorkspace(createWorkspace("# Restored"));
    const storage: WorkspaceStorageAdapter = {
      getItem: () => JSON.stringify(stored),
      setItem: vi.fn(),
    };

    expect(readStoredWorkspace(storage)?.files[0]?.text).toBe("# Restored");
  });

  it("falls back to an empty read when storage throws", () => {
    const storage: WorkspaceStorageAdapter = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: vi.fn(),
    };

    expect(readStoredWorkspace(storage)).toBeNull();
  });
});
