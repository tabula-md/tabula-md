import { describe, expect, it } from "vitest";
import type {
  WorkspaceRoomSnapshot,
  WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";
import {
  materializeWorkspaceRoomSnapshot,
  projectWorkspaceRoomStructure,
} from "./workspaceRoomProjection";
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

const snapshot = (nodes: WorkspaceRoomStructureSnapshot["nodes"]): WorkspaceRoomStructureSnapshot => ({
  roomId: "room-1",
  schemaVersion: 2,
  rootId: "workspace-root",
  nodes: [
    { id: "workspace-root", type: "folder", parentId: null, title: "Workspace", order: 0, createdAt: "2026-07-01", updatedAt: "2026-07-01" },
    ...nodes,
  ],
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

describe("projectWorkspaceRoomStructure", () => {
  it("projects room metadata without retaining document bodies", () => {
    const next = projectWorkspaceRoomStructure({
      createFile,
      snapshot: snapshot([
        documentNode("readme", "README renamed.md", 0),
        documentNode("remote", "Remote.md", 1),
      ]),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [
          file({ id: "readme", title: "README.md", text: "stale body" }),
          file({ id: "removed", title: "Removed.md", text: "removed body" }),
        ],
        openFileIds: ["readme", "removed"],
        activeFileId: "removed",
      },
    });

    expect(next.files.map((candidate) => candidate.id)).toEqual(["readme", "remote"]);
    expect(next.files.map((candidate) => candidate.text)).toEqual(["", ""]);
    expect(next.files[0].title).toBe("README renamed.md");
    expect(next.activeFileId).toBe("readme");
    expect(next.openFileIds).toEqual(["readme"]);
  });

  it("keeps canonical duplicate titles unchanged", () => {
    const next = projectWorkspaceRoomStructure({
      createFile,
      snapshot: snapshot([
        documentNode("first", "Plan.md", 0),
        documentNode("second", "Plan.md", 1),
      ]),
      workspaceSnapshot: { folders: [createWorkspaceRootFolder()], files: [], openFileIds: [], activeFileId: "" },
    });

    expect(next.files.map((candidate) => candidate.title)).toEqual(["Plan.md", "Plan.md"]);
  });

  it("accepts an empty room without creating a placeholder document", () => {
    const next = projectWorkspaceRoomStructure({
      createFile,
      snapshot: snapshot([]),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [file({ id: "room-doc", title: "Room.md" })],
        openFileIds: ["room-doc"],
        activeFileId: "room-doc",
      },
    });

    expect(next.files).toEqual([]);
    expect(next.openFileIds).toEqual([]);
    expect(next.activeFileId).toBe("");
  });
});

describe("materializeWorkspaceRoomSnapshot", () => {
  it("reads every body only at an explicit workspace boundary", () => {
    const structure = snapshot([
      documentNode("readme", "README.md", 0),
      documentNode("guide", "Guide.md", 1),
    ]);
    const roomSnapshot: WorkspaceRoomSnapshot = {
      ...structure,
      documents: {
        readme: "# README",
        guide: "# Guide",
      },
      commentsByFileId: {},
    };
    const next = materializeWorkspaceRoomSnapshot({
      createFile,
      snapshot: roomSnapshot,
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [file({ id: "readme", title: "README.md", text: "stale" })],
        openFileIds: ["readme"],
        activeFileId: "readme",
      },
    });

    expect(Object.fromEntries(next.files.map((candidate) => [candidate.id, candidate.text]))).toEqual({
      readme: "# README",
      guide: "# Guide",
    });
  });
});
