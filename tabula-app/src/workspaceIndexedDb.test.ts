import { describe, expect, it, vi } from "vitest";
import {
  deleteIndexedDbWorkspace,
  readIndexedDbWorkspace,
  writeIndexedDbWorkspace,
  type WorkspaceDatabaseAdapter,
  type WorkspaceWritePlan,
} from "./workspaceIndexedDb";
import { createWorkspaceFile, createWorkspaceRootFolder, type WorkspaceState } from "./workspaceStorage";

const createWorkspace = (text: string): WorkspaceState => ({
  folders: [createWorkspaceRootFolder()],
  files: [createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text })],
  openFileIds: ["local"],
  activeFileId: "local",
  commentsByFileId: {},
});

const createMemoryAdapter = () => {
  let workspace: WorkspaceState | null = null;
  const workspacePlans: WorkspaceWritePlan[] = [];
  const adapter: WorkspaceDatabaseAdapter = {
    readWorkspace: vi.fn(async () => workspace),
    writeWorkspace: vi.fn(async (plan) => {
      workspacePlans.push(plan);
    }),
    deleteWorkspace: vi.fn(async () => {
      workspace = null;
    }),
  };
  return {
    adapter,
    setWorkspace: (nextWorkspace: WorkspaceState | null) => {
      workspace = nextWorkspace;
    },
    workspacePlans,
  };
};

describe("workspace IndexedDB adapter", () => {
  it("writes normalized file, folder, and manifest records", async () => {
    const memory = createMemoryAdapter();

    await writeIndexedDbWorkspace(createWorkspace("# IndexedDB"), memory.adapter);

    const plan = memory.workspacePlans[0];
    expect(plan?.manifest).toMatchObject({ activeFileId: "local", fileOrder: ["local"] });
    expect(plan?.filePuts).toHaveLength(1);
    expect(plan?.filePuts[0]?.payload.text).toBe("# IndexedDB");
    expect(plan?.folderPuts).toHaveLength(1);
  });

  it("writes only records whose source objects changed", async () => {
    const memory = createMemoryAdapter();
    const workspace = createWorkspace("# First");
    workspace.files.push(createWorkspaceFile(2, { id: "stable", title: "Stable.md", text: "# Stable" }));

    await writeIndexedDbWorkspace(workspace, memory.adapter);
    workspace.files = workspace.files.map((file) => file.id === "local" ? { ...file, text: "# Changed" } : file);
    await writeIndexedDbWorkspace(workspace, memory.adapter);

    expect(memory.workspacePlans[1]?.filePuts.map((record) => record.id)).toEqual(["local"]);
    expect(memory.workspacePlans[1]?.fileDeletes).toEqual([]);
  });

  it("reads the current normalized workspace without a legacy fallback", async () => {
    const memory = createMemoryAdapter();
    memory.setWorkspace(createWorkspace("# Restored"));

    const restored = await readIndexedDbWorkspace(memory.adapter);

    expect(restored?.files[0]?.text).toBe("# Restored");
  });

  it("propagates IndexedDB read failures", async () => {
    const memory = createMemoryAdapter();
    vi.mocked(memory.adapter.readWorkspace).mockRejectedValueOnce(new Error("indexeddb unavailable"));

    await expect(readIndexedDbWorkspace(memory.adapter)).rejects.toThrow("indexeddb unavailable");
  });

  it("deletes the current workspace database records", async () => {
    const memory = createMemoryAdapter();
    memory.setWorkspace(createWorkspace("# Delete"));

    await deleteIndexedDbWorkspace(memory.adapter);

    expect(memory.adapter.deleteWorkspace).toHaveBeenCalledTimes(1);
  });
});
