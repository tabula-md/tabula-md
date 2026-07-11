import { describe, expect, it } from "vitest";
import { createRoomLocalWorkspaceState } from "./roomLocalWorkspaceState";
import {
  readRoomLocalWorkspaceFallback,
  selectLatestRoomLocalWorkspaceState,
  writeRoomLocalWorkspaceFallback,
} from "./roomLocalWorkspaceStorage";
import { createWorkspaceFile, createWorkspaceRootFolder } from "./workspaceStorage";

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

const state = (roomId: string, text: string) => createRoomLocalWorkspaceState(roomId, {
  folders: [createWorkspaceRootFolder()],
  files: [createWorkspaceFile(1, { id: "private", text })],
  openFileIds: ["private"],
  activeFileId: "private",
  commentsByFileId: {},
});

describe("room-local fallback storage", () => {
  it("round-trips private room state synchronously", () => {
    const storage = createMemoryStorage();
    expect(writeRoomLocalWorkspaceFallback(state("room-1", "private"), storage)).toBe(true);
    expect(readRoomLocalWorkspaceFallback("room-1", "browser", storage)?.files[0]?.text).toBe("private");
  });

  it("selects the newest valid snapshot", () => {
    const older = { ...state("room-1", "old"), savedAt: "2026-07-10T00:00:00.000Z" };
    const newer = { ...state("room-1", "new"), savedAt: "2026-07-11T00:00:00.000Z" };
    expect(selectLatestRoomLocalWorkspaceState(older, newer)?.files[0]?.text).toBe("new");
  });
});
