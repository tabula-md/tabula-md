import { describe, expect, it, vi } from "vitest";
import {
  LEGACY_WORKSPACE_STORAGE_KEYS,
  readLegacyWorkspaceCandidate,
  readWorkspaceWithLegacyMigration,
} from "./legacyWorkspaceMigration";
import {
  createStarterWorkspaceState,
  createStoredWorkspace,
  createWorkspaceFile,
  type WorkspaceState,
} from "./workspaceStorage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const createLegacyV6Payload = () => ({
  ...createStoredWorkspace({
    files: [createWorkspaceFile(1, { id: "legacy", title: "Legacy.md", text: "# Legacy" })],
    activeFileId: "legacy",
    commentsByFileId: {},
  }),
  version: 6,
});

describe("legacy workspace migration", () => {
  it("migrates a legacy workspace and removes it only after IndexedDB verification", async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_WORKSPACE_STORAGE_KEYS[0], JSON.stringify(createLegacyV6Payload()));
    let indexedWorkspace: WorkspaceState | null = null;

    const workspace = await readWorkspaceWithLegacyMigration({
      storage,
      readWorkspace: async () => indexedWorkspace,
      writeWorkspace: async (nextWorkspace) => { indexedWorkspace = structuredClone(nextWorkspace); },
    });

    expect(workspace?.files[0]).toMatchObject({ id: "legacy", text: "# Legacy" });
    expect(storage.getItem(LEGACY_WORKSPACE_STORAGE_KEYS[0])).toBeNull();
  });

  it("keeps the legacy copy and opens it in memory when durable migration fails", async () => {
    const storage = new MemoryStorage();
    const rawWorkspace = JSON.stringify(createLegacyV6Payload());
    storage.setItem(LEGACY_WORKSPACE_STORAGE_KEYS[0], rawWorkspace);

    const workspace = await readWorkspaceWithLegacyMigration({
      storage,
      readWorkspace: async () => null,
      writeWorkspace: async () => { throw new Error("indexeddb unavailable"); },
    });

    expect(workspace?.files[0]?.text).toBe("# Legacy");
    expect(storage.getItem(LEGACY_WORKSPACE_STORAGE_KEYS[0])).toBe(rawWorkspace);
  });

  it("does not overwrite an existing IndexedDB workspace", async () => {
    const storage = new MemoryStorage();
    const rawWorkspace = JSON.stringify(createLegacyV6Payload());
    storage.setItem(LEGACY_WORKSPACE_STORAGE_KEYS[0], rawWorkspace);
    const currentWorkspace = {
      ...createStarterWorkspaceState(),
      files: [createWorkspaceFile(1, { id: "current", title: "Current.md", text: "# Current" })],
      openFileIds: ["current"],
      activeFileId: "current",
    };
    const writeWorkspace = vi.fn();

    expect(await readWorkspaceWithLegacyMigration({
      storage,
      readWorkspace: async () => currentWorkspace,
      writeWorkspace,
    })).toBe(currentWorkspace);
    expect(writeWorkspace).not.toHaveBeenCalled();
    expect(storage.getItem(LEGACY_WORKSPACE_STORAGE_KEYS[0])).toBe(rawWorkspace);
  });

  it("replaces an auto-saved empty IndexedDB workspace with the recoverable legacy workspace", async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_WORKSPACE_STORAGE_KEYS[0], JSON.stringify(createLegacyV6Payload()));
    let indexedWorkspace: WorkspaceState | null = createStarterWorkspaceState();

    const workspace = await readWorkspaceWithLegacyMigration({
      storage,
      readWorkspace: async () => indexedWorkspace,
      writeWorkspace: async (nextWorkspace) => { indexedWorkspace = structuredClone(nextWorkspace); },
    });

    expect(workspace?.files[0]?.id).toBe("legacy");
    expect(storage.getItem(LEGACY_WORKSPACE_STORAGE_KEYS[0])).toBeNull();
  });

  it("ignores malformed legacy storage without deleting it", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_WORKSPACE_STORAGE_KEYS[0], "not json");

    expect(readLegacyWorkspaceCandidate(storage)).toBeNull();
    expect(storage.getItem(LEGACY_WORKSPACE_STORAGE_KEYS[0])).toBe("not json");
  });
});
