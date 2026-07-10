import { describe, expect, it } from "vitest";
import { getWorkspaceRoomFolders } from "./workspaceRoomScope";
import { createWorkspaceRootFolder, type WorkspaceFolder } from "../workspaceStorage";

const folder = (id: string, parentId: string | null): WorkspaceFolder => ({
  id,
  title: `${id}.folder`,
  parentId,
});

describe("workspace room scope", () => {
  it("includes only folders needed by shared documents", () => {
    const folders = [
      createWorkspaceRootFolder(),
      folder("shared-parent", "workspace-root"),
      folder("shared-child", "shared-parent"),
      folder("private-only", "workspace-root"),
    ];

    expect(
      getWorkspaceRoomFolders([{ parentId: "shared-child" }], folders).map((candidate) => candidate.id),
    ).toEqual(["workspace-root", "shared-parent", "shared-child"]);
  });

  it("includes explicitly shared empty folders", () => {
    const folders = [
      createWorkspaceRootFolder(),
      { ...folder("empty-shared", "workspace-root"), roomId: "room-1" },
      folder("empty-private", "workspace-root"),
    ];

    expect(getWorkspaceRoomFolders([], folders, "room-1").map(({ id }) => id)).toEqual([
      "workspace-root",
      "empty-shared",
    ]);
  });
});
