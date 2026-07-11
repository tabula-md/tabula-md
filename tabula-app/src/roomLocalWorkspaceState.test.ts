import { describe, expect, it } from "vitest";
import {
  applyRoomLocalViewState,
  createRoomLocalWorkspaceState,
  mergeRoomLocalWorkspaceState,
} from "./roomLocalWorkspaceState";
import {
  createWorkspaceFile,
  createWorkspaceRootFolder,
  type WorkspaceState,
} from "./workspaceStorage";

const workspace = (): WorkspaceState => ({
  folders: [createWorkspaceRootFolder()],
  files: [
    createWorkspaceFile(1, { id: "shared", text: "shared", roomId: "room-1", shareUrl: "#secret" }),
    createWorkspaceFile(2, { id: "private", text: "private" }),
  ],
  openFileIds: ["shared", "private"],
  activeFileId: "private",
  commentsByFileId: {
    shared: [{ id: "shared-comment", body: "shared", createdAt: "2026-07-11" }],
    private: [{ id: "private-comment", body: "private", createdAt: "2026-07-11" }],
  },
});

describe("room-local workspace state", () => {
  it("persists only private content while retaining personal tab preferences", () => {
    const state = createRoomLocalWorkspaceState("room-1", workspace());
    expect(state.files.map((file) => file.id)).toEqual(["private"]);
    expect(state.commentsByFileId).toHaveProperty("private");
    expect(state.commentsByFileId).not.toHaveProperty("shared");
    expect(state.openFileIds).toEqual(["shared", "private"]);
    expect(state.activeFileId).toBe("private");
  });

  it("restores private files alongside the current shared room projection", () => {
    const state = createRoomLocalWorkspaceState("room-1", workspace());
    const current = {
      folders: [createWorkspaceRootFolder()],
      files: [createWorkspaceFile(1, { id: "shared", text: "new shared", roomId: "room-1" })],
      openFileIds: ["shared"],
      activeFileId: "shared",
    };
    const merged = mergeRoomLocalWorkspaceState(current, state);
    expect(merged.files.map((file) => file.id)).toEqual(["private", "shared"]);
    expect(merged.files.find((file) => file.id === "shared")?.text).toBe("new shared");
    expect(merged.activeFileId).toBe("private");
  });

  it("applies saved tabs only after their room documents exist", () => {
    const state = createRoomLocalWorkspaceState("room-1", workspace());
    const beforeSync = applyRoomLocalViewState({
      folders: [createWorkspaceRootFolder()], files: [], openFileIds: [], activeFileId: "",
    }, { openFileIds: ["shared"], activeFileId: "shared" });
    expect(beforeSync.activeFileId).toBe("");
    const afterSync = applyRoomLocalViewState({
      folders: [createWorkspaceRootFolder()],
      files: [state.files[0], createWorkspaceFile(1, { id: "shared", roomId: "room-1" })],
      openFileIds: [],
      activeFileId: "",
    }, { openFileIds: ["shared"], activeFileId: "shared" });
    expect(afterSync.openFileIds).toEqual(["shared"]);
    expect(afterSync.activeFileId).toBe("shared");
  });
});
