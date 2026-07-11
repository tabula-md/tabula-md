import { describe, expect, it } from "vitest";
import type { WorkspaceRoomSnapshot } from "@tabula-md/tabula";
import { reconcileWorkspaceRoomSnapshot } from "./workspaceRoomStateMerge";
import { createWorkspaceRootFolder, type WorkspaceFile } from "../workspaceStorage";

const file = (overrides: Partial<WorkspaceFile> & Pick<WorkspaceFile, "id" | "title">): WorkspaceFile => ({
  text: "",
  viewMode: "edit",
  readingWidth: "wide",
  lineWrapping: true,
  lineNumbers: true,
  ...overrides,
});

const createFile = (index: number, overrides: Partial<WorkspaceFile> = {}): WorkspaceFile => file({
  id: overrides.id ?? `created-${index}`,
  title: overrides.title ?? `Created ${index}.md`,
  ...overrides,
});

const snapshot = (nodes: WorkspaceRoomSnapshot["nodes"], documents: Record<string, string>): WorkspaceRoomSnapshot => ({
  roomId: "room-1",
  schemaVersion: 2,
  rootId: "workspace-root",
  nodes: [
    { id: "workspace-root", type: "folder", parentId: null, title: "Workspace", order: 0, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
    ...nodes,
  ],
  documents,
  commentsByFileId: {},
});

const documentNode = (id: string, title: string, order: number, parentId = "workspace-root") => ({
  id,
  type: "document" as const,
  parentId,
  title,
  order,
  createdAt: "2026-07-01",
  updatedAt: "2026-07-01",
});

describe("reconcileWorkspaceRoomSnapshot", () => {
  it("replaces room-owned documents while preserving excluded local files and local active selection", () => {
    const activeFile = file({ id: "readme", title: "README.md", roomId: "room-1", shareUrl: "https://tabula.test/#room=room-1,key", connectionStatus: "connected" });
    const next = reconcileWorkspaceRoomSnapshot({
      activeFile,
      createFile,
      snapshot: snapshot([documentNode("readme", "README renamed.md", 0)], { readme: "# Remote" }),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [activeFile, file({ id: "local", title: "Local.md" }), file({ id: "removed", title: "Removed.md", roomId: "room-1" })],
        openFileIds: ["readme", "local", "removed"],
        activeFileId: "local",
      },
    });

    expect(next?.files.map((candidate) => candidate.id)).toEqual(["local", "readme"]);
    expect(next?.files.find((candidate) => candidate.id === "readme")).toMatchObject({
      title: "README renamed.md",
      text: "# Remote",
      roomId: "room-1",
    });
    expect(next?.activeFileId).toBe("local");
  });

  it("uses the first remaining room document when the local active document is deleted", () => {
    const next = reconcileWorkspaceRoomSnapshot({
      activeFile: file({ id: "removed", title: "Removed.md", roomId: "room-1" }),
      createFile,
      snapshot: snapshot([documentNode("readme", "README.md", 0)], { readme: "# README" }),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [file({ id: "removed", title: "Removed.md", roomId: "room-1" })],
        openFileIds: ["removed"],
        activeFileId: "removed",
      },
    });
    expect(next?.activeFileId).toBe("readme");
    expect(next?.openFileIds).toEqual(["readme"]);
  });

  it("adds remote documents to the workspace without opening tabs for them", () => {
    const existing = file({ id: "readme", title: "README.md", roomId: "room-1" });
    const next = reconcileWorkspaceRoomSnapshot({
      activeFile: existing,
      createFile,
      snapshot: snapshot([
        documentNode("readme", "README.md", 0),
        documentNode("remote", "Remote.md", 1),
      ], { readme: "# README", remote: "# Remote" }),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [existing],
        openFileIds: ["readme"],
        activeFileId: "readme",
      },
    });

    expect(next?.files.map((candidate) => candidate.id)).toEqual(["readme", "remote"]);
    expect(next?.openFileIds).toEqual(["readme"]);
    expect(next?.activeFileId).toBe("readme");
  });

  it("keeps canonical duplicate titles unchanged instead of publishing suffixes back into the room", () => {
    const next = reconcileWorkspaceRoomSnapshot({
      createFile,
      snapshot: snapshot([
        documentNode("first", "Plan.md", 0),
        documentNode("second", "Plan.md", 1),
      ], { first: "A", second: "B" }),
      workspaceSnapshot: { folders: [createWorkspaceRootFolder()], files: [], openFileIds: [], activeFileId: "" },
    });
    expect(next?.files.map((candidate) => candidate.title)).toEqual(["Plan.md", "Plan.md"]);
  });

  it("accepts an empty room snapshot and removes only room-owned documents", () => {
    const next = reconcileWorkspaceRoomSnapshot({
      activeFile: file({ id: "shared", title: "Shared.md", roomId: "room-1" }),
      createFile,
      snapshot: snapshot([], {}),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [
          file({ id: "shared", title: "Shared.md", roomId: "room-1" }),
          file({ id: "private", title: "Private.md" }),
        ],
        openFileIds: ["shared", "private"],
        activeFileId: "shared",
      },
    });

    expect(next.files.map((candidate) => candidate.id)).toEqual(["private"]);
    expect(next.openFileIds).toEqual(["private"]);
    expect(next.activeFileId).toBe("private");
  });
});
