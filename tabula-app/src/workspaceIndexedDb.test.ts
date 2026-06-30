import { describe, expect, it, vi } from "vitest";
import {
  deleteIndexedDbWorkspace,
  readIndexedDbWorkspace,
  writeIndexedDbWorkspace,
  type StoredWorkspaceRecord,
  type WorkspaceRecordStore,
} from "./workspaceIndexedDb";
import { createWorkspaceFile, PROJECT_STORAGE_KEY, type WorkspaceState } from "./workspaceStorage";

const createWorkspace = (text: string): WorkspaceState => ({
  files: [createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text })],
  openFileIds: ["local"],
  activeFileId: "local",
  commentsByFileId: {},
});

const createMemoryStore = (): WorkspaceRecordStore & { records: Map<string, StoredWorkspaceRecord> } => {
  const records = new Map<string, StoredWorkspaceRecord>();
  return {
    records,
    get: vi.fn(async (key: string) => records.get(key)),
    put: vi.fn(async (record: StoredWorkspaceRecord) => {
      records.set(record.key, record);
    }),
    delete: vi.fn(async (key: string) => {
      records.delete(key);
    }),
  };
};

describe("workspace IndexedDB adapter", () => {
  it("writes workspace snapshots by storage key", async () => {
    const store = createMemoryStore();

    await writeIndexedDbWorkspace(createWorkspace("# IndexedDB"), store);

    const record = store.records.get(PROJECT_STORAGE_KEY);
    expect(record?.key).toBe(PROJECT_STORAGE_KEY);
    expect(record?.payload.files.local?.text).toBe("# IndexedDB");
    expect(store.put).toHaveBeenCalledTimes(1);
  });

  it("reads workspace snapshots through the existing migration path", async () => {
    const store = createMemoryStore();
    await writeIndexedDbWorkspace(createWorkspace("# Restored"), store);

    const restored = await readIndexedDbWorkspace(store);

    expect(restored?.files[0]?.text).toBe("# Restored");
  });

  it("returns null when IndexedDB reads fail", async () => {
    const store: WorkspaceRecordStore = {
      get: vi.fn(async () => {
        throw new Error("indexeddb unavailable");
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };

    await expect(readIndexedDbWorkspace(store)).resolves.toBeNull();
  });

  it("deletes the stored workspace snapshot", async () => {
    const store = createMemoryStore();
    await writeIndexedDbWorkspace(createWorkspace("# Delete"), store);

    await deleteIndexedDbWorkspace(store);

    expect(store.records.has(PROJECT_STORAGE_KEY)).toBe(false);
    expect(store.delete).toHaveBeenCalledWith(PROJECT_STORAGE_KEY);
  });
});
