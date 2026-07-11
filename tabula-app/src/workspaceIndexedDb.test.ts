import { describe, expect, it, vi } from "vitest";
import {
  deleteIndexedDbWorkspace,
  readIndexedDbRoomLocalWorkspace,
  readIndexedDbWorkspace,
  writeIndexedDbRoomLocalWorkspace,
  writeIndexedDbWorkspace,
  type RoomLocalWritePlan,
  type WorkspaceDatabaseAdapter,
  type WorkspaceWritePlan,
} from "./workspaceIndexedDb";
import { createRoomLocalWorkspaceState, type RoomLocalWorkspaceState } from "./roomLocalWorkspaceState";
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
  const roomWorkspaces = new Map<string, RoomLocalWorkspaceState>();
  const workspacePlans: WorkspaceWritePlan[] = [];
  const roomPlans: RoomLocalWritePlan[] = [];
  const adapter: WorkspaceDatabaseAdapter = {
    readWorkspace: vi.fn(async () => workspace),
    writeWorkspace: vi.fn(async (plan) => {
      workspacePlans.push(plan);
    }),
    deleteWorkspace: vi.fn(async () => {
      workspace = null;
    }),
    readRoomLocalWorkspace: vi.fn(async (roomId, ownerId) => roomWorkspaces.get(`${roomId}:${ownerId}`) ?? null),
    writeRoomLocalWorkspace: vi.fn(async (plan) => {
      roomPlans.push(plan);
    }),
    deleteRoomLocalWorkspace: vi.fn(async (roomId, ownerId) => {
      roomWorkspaces.delete(`${roomId}:${ownerId}`);
    }),
  };
  return {
    adapter,
    roomPlans,
    roomWorkspaces,
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

  it("stores private room documents separately without room secrets", async () => {
    const memory = createMemoryAdapter();
    const workspace = createWorkspace("# Private");
    workspace.files.push(createWorkspaceFile(2, {
      id: "shared",
      title: "Shared.md",
      text: "# Shared",
      roomId: "room-1",
      shareUrl: "https://tabula.test/#room=room-1,secret",
    }));
    const state = createRoomLocalWorkspaceState("room-1", workspace);

    await writeIndexedDbRoomLocalWorkspace(state, memory.adapter);
    const plan = memory.roomPlans[0];

    expect(plan?.manifest.fileOrder).toEqual(["local"]);
    expect(plan?.filePuts.map((record) => record.id)).toEqual(["local"]);
    expect(JSON.stringify(plan)).not.toContain("secret");
    expect(JSON.stringify(plan)).not.toContain("# Shared");
  });

  it("hydrates private room state from the same normalized adapter", async () => {
    const memory = createMemoryAdapter();
    const state = createRoomLocalWorkspaceState("room-1", createWorkspace("# Private"));
    memory.roomWorkspaces.set("room-1:browser", state);

    const restored = await readIndexedDbRoomLocalWorkspace("room-1", "browser", memory.adapter);

    expect(restored?.files[0]?.text).toBe("# Private");
  });
});
