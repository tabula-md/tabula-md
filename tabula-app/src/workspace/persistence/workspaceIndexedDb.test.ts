import { describe, expect, it, vi } from "vitest";
import { captureWorkspaceKnowledgeBaseline } from "@tabula-md/tabula";
import {
  deleteIndexedDbWorkspace,
  parseIndexedDbWorkspaceSnapshot,
  readIndexedDbWorkspace,
  writeIndexedDbWorkspace,
  type WorkspaceDatabaseAdapter,
  type WorkspaceWritePlan,
} from "./workspaceIndexedDb";
import { createWorkspaceFile, createWorkspaceRootFolder, DEFAULT_WORKSPACE_PRESENTATION, type WorkspaceState } from "../workspaceStorage";
import projectV6 from "../__fixtures__/storage/project-v6.json";

const createWorkspace = (text: string): WorkspaceState => ({
  folders: [createWorkspaceRootFolder()],
  files: [createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text })],
  openFileIds: ["local"],
  activeFileId: "local",
  commentsByFileId: {},
  presentation: DEFAULT_WORKSPACE_PRESENTATION,
});

const withKnowledgeBaseline = (workspace: WorkspaceState): WorkspaceState => ({
  ...workspace,
  knowledgeBaseline: captureWorkspaceKnowledgeBaseline([{
    id: "local",
    path: "LOCAL.md",
    markdown: workspace.files[0]?.text ?? "",
  }], "2026-07-25T00:00:00.000Z"),
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
  it("hydrates a v6 IndexedDB snapshot before upgrading its manifest", () => {
    const snapshot = {
      version: projectV6.version,
      savedAt: projectV6.savedAt,
      activeFileId: projectV6.activeFileId,
      openFileIds: projectV6.openFileIds,
      fileOrder: projectV6.fileOrder,
      folderOrder: projectV6.folderOrder,
      files: projectV6.files,
      folders: projectV6.folders,
      commentsByFileId: projectV6.commentsByFileId,
    };
    const original = structuredClone(snapshot);

    const result = parseIndexedDbWorkspaceSnapshot(snapshot);

    expect(result.event.status).toBe("migrated");
    expect(result.workspace?.files[0]).toMatchObject({
      id: "guide",
      editingMode: "source",
    });
    expect(snapshot).toEqual(original);
  });

  it("rejects a malformed IndexedDB snapshot before any upgrade write", () => {
    const result = parseIndexedDbWorkspaceSnapshot({
      version: 6,
      savedAt: "2025-06-01T00:00:00.000Z",
      activeFileId: "missing",
      openFileIds: ["missing"],
      fileOrder: ["missing"],
      folderOrder: ["workspace-root"],
      files: {},
      folders: projectV6.folders,
      commentsByFileId: {},
    });

    expect(result.event.status).toBe("rejected");
    expect(result.workspace).toBeNull();
  });

  it("writes normalized file, folder, and manifest records", async () => {
    const memory = createMemoryAdapter();

    await writeIndexedDbWorkspace(createWorkspace("# IndexedDB"), memory.adapter);

    const plan = memory.workspacePlans[0];
    expect(plan?.manifest).toMatchObject({ activeFileId: "local", fileOrder: ["local"] });
    expect(plan?.manifest.presentation).toEqual(DEFAULT_WORKSPACE_PRESENTATION);
    expect(plan?.filePuts).toHaveLength(1);
    expect(plan?.filePuts[0]?.payload.text).toBe("# IndexedDB");
    expect(plan?.filePuts[0]?.payload).not.toHaveProperty("viewMode");
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

  it("updates presentation without rewriting unchanged document records", async () => {
    const memory = createMemoryAdapter();
    const workspace = createWorkspace("# First");

    await writeIndexedDbWorkspace(workspace, memory.adapter);
    const nextWorkspace = {
      ...workspace,
      presentation: { ...workspace.presentation, viewMode: "preview" as const },
      files: workspace.files.map((file) => ({ ...file, viewMode: "preview" as const })),
    };
    await writeIndexedDbWorkspace(nextWorkspace, memory.adapter);

    expect(memory.workspacePlans[1]?.manifest.presentation.viewMode).toBe("preview");
    expect(memory.workspacePlans[1]?.filePuts).toEqual([]);
  });

  it("persists the knowledge baseline separately and skips unchanged writes", async () => {
    const memory = createMemoryAdapter();
    const workspace = withKnowledgeBaseline(createWorkspace("# First"));

    await writeIndexedDbWorkspace(workspace, memory.adapter);
    await writeIndexedDbWorkspace(workspace, memory.adapter);

    expect(memory.workspacePlans[0]?.knowledgeBaselinePut?.payload).toEqual(
      workspace.knowledgeBaseline,
    );
    expect(memory.workspacePlans[0]?.deleteKnowledgeBaseline).toBe(false);
    expect(memory.workspacePlans[1]?.knowledgeBaselinePut).toBeUndefined();
    expect(memory.workspacePlans[1]?.deleteKnowledgeBaseline).toBe(false);
  });

  it("deletes a previously persisted knowledge baseline when tracking is cleared", async () => {
    const memory = createMemoryAdapter();
    const trackedWorkspace = withKnowledgeBaseline(createWorkspace("# First"));

    await writeIndexedDbWorkspace(trackedWorkspace, memory.adapter);
    await writeIndexedDbWorkspace(
      { ...trackedWorkspace, knowledgeBaseline: undefined },
      memory.adapter,
    );

    expect(memory.workspacePlans[1]?.deleteKnowledgeBaseline).toBe(true);
  });

  it("does not read or serialize unchanged file content while planning a later write", async () => {
    const memory = createMemoryAdapter();
    const workspace = createWorkspace("# First");
    const stableFile = createWorkspaceFile(2, { id: "stable", title: "Stable.md", text: "# Stable" });
    let stableTextReads = 0;
    Object.defineProperty(stableFile, "text", {
      configurable: true,
      enumerable: true,
      get: () => {
        stableTextReads += 1;
        return "# Stable";
      },
    });
    workspace.files.push(stableFile);

    await writeIndexedDbWorkspace(workspace, memory.adapter);
    stableTextReads = 0;
    workspace.files = workspace.files.map((file) =>
      file.id === "local" ? { ...file, text: "# Changed" } : file,
    );
    await writeIndexedDbWorkspace(workspace, memory.adapter);

    expect(stableTextReads).toBe(0);
    expect(memory.workspacePlans[1]?.filePuts.map((record) => record.id)).toEqual(["local"]);
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
