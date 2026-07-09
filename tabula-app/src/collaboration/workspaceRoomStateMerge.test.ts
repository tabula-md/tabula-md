import { describe, expect, it } from "vitest";
import type { WorkspaceRoomState } from "@tabula-md/tabula";
import { reconcileWorkspaceRoomState } from "./workspaceRoomStateMerge";
import type { WorkspaceFile } from "../workspaceStorage";

const file = (overrides: Partial<WorkspaceFile> & Pick<WorkspaceFile, "id" | "title">): WorkspaceFile => ({
  text: "",
  viewMode: "edit",
  readingWidth: "wide",
  lineWrapping: true,
  lineNumbers: true,
  ...overrides,
});

const createFile = (index: number, overrides: Partial<WorkspaceFile> = {}): WorkspaceFile =>
  file({
    id: overrides.id ?? `created-${index}`,
    title: overrides.title ?? `Created ${index}.md`,
    text: overrides.text ?? "",
    ...overrides,
  });

const workspaceState = (overrides: Partial<WorkspaceRoomState> = {}): WorkspaceRoomState => ({
  roomId: "room-1",
  mode: "workspace",
  version: 1,
  rootId: "workspace-root",
  activeDocumentId: "readme",
  nodes: [
    {
      id: "workspace-root",
      type: "folder",
      parentId: null,
      title: "Workspace",
      order: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ],
  ...overrides,
});

const documentNode = (id: string, title: string, order: number, parentId = "workspace-root") => ({
  id,
  type: "document" as const,
  parentId,
  title,
  sha256: `hash-${id}`,
  textLength: 0,
  order,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
});

describe("reconcileWorkspaceRoomState", () => {
  it("removes shared room files that are no longer in workspace.updated while preserving local-only files", () => {
    const activeFile = file({
      id: "readme",
      title: "README.md",
      roomId: "room-1",
      shareUrl: "https://tabula.test/#room=room-1,key",
      connectionStatus: "connected",
    });
    const nextWorkspace = reconcileWorkspaceRoomState({
      activeFile,
      createFile,
      workspace: workspaceState({
        activeDocumentId: "readme",
        nodes: [
          workspaceState().nodes[0],
          documentNode("readme", "README.md", 0),
        ],
      }),
      workspaceSnapshot: {
        activeFileId: "draft",
        openFileIds: ["readme", "draft", "removed"],
        files: [
          activeFile,
          file({ id: "draft", title: "Local draft.md" }),
          file({ id: "removed", title: "Removed.md", roomId: "room-1", shareUrl: activeFile.shareUrl }),
        ],
      },
    });

    expect(nextWorkspace?.files.map((nextFile) => nextFile.id)).toEqual(["readme", "draft"]);
    expect(nextWorkspace?.files.find((nextFile) => nextFile.id === "draft")?.roomId).toBeUndefined();
    expect(nextWorkspace?.openFileIds).toEqual(["readme", "draft"]);
    expect(nextWorkspace?.activeFileId).toBe("draft");
  });

  it("creates and updates shared room files from workspace.updated as room-owned files", () => {
    const activeFile = file({
      id: "readme",
      title: "README.md",
      roomId: "room-1",
      shareUrl: "https://tabula.test/#room=room-1,key",
      connectionStatus: "connected",
    });
    const nextWorkspace = reconcileWorkspaceRoomState({
      activeFile,
      createFile,
      workspace: workspaceState({
        activeDocumentId: "plan",
        nodes: [
          workspaceState().nodes[0],
          documentNode("readme", "README renamed.md", 1),
          documentNode("plan", "Plan.md", 0),
        ],
      }),
      workspaceSnapshot: {
        activeFileId: "readme",
        openFileIds: ["readme"],
        files: [
          activeFile,
          file({ id: "local", title: "Local.md" }),
        ],
      },
    });

    expect(nextWorkspace?.files.map((nextFile) => nextFile.id)).toEqual(["plan", "readme", "local"]);
    expect(nextWorkspace?.files.find((nextFile) => nextFile.id === "readme")).toMatchObject({
      title: "README renamed.md",
      roomId: "room-1",
      shareUrl: activeFile.shareUrl,
    });
    expect(nextWorkspace?.files.find((nextFile) => nextFile.id === "plan")).toMatchObject({
      title: "Plan.md",
      roomId: "room-1",
      shareUrl: activeFile.shareUrl,
    });
    expect(nextWorkspace?.openFileIds).toEqual(["readme", "plan"]);
    expect(nextWorkspace?.activeFileId).toBe("readme");
  });
});
