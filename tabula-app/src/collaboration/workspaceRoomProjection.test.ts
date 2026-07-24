import { describe, expect, it } from "vitest";
import type {
  WorkspaceRoomSnapshot,
  WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";
import {
  clearWorkspaceDocumentBodies,
  materializeWorkspaceRoomSnapshot,
  projectWorkspaceRoomComments,
  projectWorkspaceRoomStructure,
} from "./workspaceRoomProjection";
import { createWorkspaceRootFolder, type WorkspaceFile } from "../workspace/workspaceStorage";

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
  it("clears local bodies at the Local-to-Room session boundary", () => {
    const source = {
      folders: [createWorkspaceRootFolder()],
      files: [file({ id: "readme", title: "README.md", text: "# README" })],
      openFileIds: ["readme"],
      activeFileId: "readme",
    };

    const next = clearWorkspaceDocumentBodies(source);

    expect(next.files[0].text).toBe("");
    expect(source.files[0].text).toBe("# README");
  });

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
    expect(next.folders[0]?.title).toBe("Workspace");
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

  it("preserves an existing workspace with every document tab closed", () => {
    const next = projectWorkspaceRoomStructure({
      createFile,
      snapshot: snapshot([
        documentNode("readme", "README.md", 0),
        documentNode("notes", "Notes.md", 1),
      ]),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [
          file({ id: "readme", title: "README.md" }),
          file({ id: "notes", title: "Notes.md" }),
        ],
        openFileIds: [],
        activeFileId: "",
      },
    });

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

describe("projectWorkspaceRoomComments", () => {
  it("removes room-only actor fields and marks unresolved anchors detached", () => {
    const comments = projectWorkspaceRoomComments({
      readme: [{
        id: "comment-1",
        fileId: "readme",
        body: "Review this",
        authorId: "human-1",
        authorName: "Curious Human",
        createdAt: "2026-07-12T00:00:00.000Z",
        resolved: false,
        replies: [{
          id: "reply-1",
          body: "Done",
          authorId: "agent-1",
          authorName: "Curious Agent",
          createdAt: "2026-07-12T00:00:01.000Z",
        }],
      }],
    });

    expect(comments.readme[0]).toMatchObject({
      id: "comment-1",
      anchorDetached: true,
      authorName: "Curious Human",
      replies: [{ id: "reply-1", authorName: "Curious Agent" }],
    });
    expect(comments.readme[0]).not.toHaveProperty("fileId");
    expect(comments.readme[0]).not.toHaveProperty("authorId");
    expect(comments.readme[0].replies?.[0]).not.toHaveProperty("authorId");
  });
});
