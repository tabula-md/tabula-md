import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspacePersistenceQueue,
  DEFAULT_WORKSPACE_PERSISTENCE_DELAY_MS,
  writeWorkspaceToPrimaryStores,
} from "./workspacePersistence";
import { getWorkspacePersistenceFlushSnapshot } from "./hooks/useQueuedWorkspacePersistence";
import {
  clearStoredWorkspaceIfCurrent,
  createWorkspaceFile,
  createStoredWorkspace,
  readStoredWorkspace,
  PROJECT_STORAGE_KEY,
  PROJECT_STORAGE_MANIFEST_KEY,
  writeStoredWorkspace,
  type WorkspaceState,
  type WorkspaceStorageAdapter,
} from "./workspaceStorage";
import { writeIndexedDbWorkspace } from "./workspaceIndexedDb";

vi.mock("./workspaceIndexedDb", () => ({
  writeIndexedDbWorkspace: vi.fn(() => Promise.resolve()),
}));

const createWorkspace = (text: string): WorkspaceState => ({
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

  it("does not clear a newer local fallback after a stale IndexedDB write succeeds", () => {
    const storage: Record<string, string> = {};
    const adapter: WorkspaceStorageAdapter = {
      getItem: (key) => storage[key] ?? null,
      removeItem: (key) => {
        delete storage[key];
      },
      setItem: (key, value) => {
        storage[key] = value;
      },
    };

    writeStoredWorkspace(createWorkspace("# Latest fallback"), adapter);
    clearStoredWorkspaceIfCurrent(createWorkspace("# Stale IndexedDB"), adapter);

    expect(readStoredWorkspace(adapter)?.files[0]?.text).toBe("# Latest fallback");

    clearStoredWorkspaceIfCurrent(createWorkspace("# Latest fallback"), adapter);

    expect(readStoredWorkspace(adapter)).toBeNull();
  });
});

describe("workspace primary store writes", () => {
  afterEach(() => {
    vi.mocked(writeIndexedDbWorkspace).mockClear();
  });

  it("keeps localStorage writes small while persisting the full workspace to IndexedDB", async () => {
    const storage: Record<string, string> = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage[key] ?? null,
        removeItem: (key: string) => {
          delete storage[key];
        },
        setItem: (key: string, value: string) => {
          storage[key] = value;
        },
      },
    });

    writeWorkspaceToPrimaryStores(createWorkspace("# Mirrored"));

    expect(JSON.parse(storage[PROJECT_STORAGE_MANIFEST_KEY] ?? "{}")).toMatchObject({
      schema: "tabula.project.manifest",
      activeFileId: "local",
      fileCount: 1,
    });
    expect(storage[PROJECT_STORAGE_KEY]).toBeUndefined();
    expect(writeIndexedDbWorkspace).toHaveBeenCalledWith(createWorkspace("# Mirrored"));
    await Promise.resolve();

    vi.unstubAllGlobals();
  });
});
