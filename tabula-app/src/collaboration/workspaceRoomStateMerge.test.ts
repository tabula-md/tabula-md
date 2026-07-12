import { describe, expect, it } from "vitest";
import type { WorkspaceRoomStructureSnapshot } from "@tabula-md/tabula";
import { reconcileWorkspaceRoomStructure } from "./workspaceRoomStateMerge";
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

describe("reconcileWorkspaceRoomStructure", () => {
  it("replaces the whole workspace with the room snapshot", () => {
    const activeFile = file({ id: "readme", title: "README.md" });
    const next = reconcileWorkspaceRoomStructure({
      createFile,
      readDocumentText: () => null,
      snapshot: snapshot([documentNode("readme", "README renamed.md", 0)]),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [activeFile, file({ id: "removed", title: "Removed.md" })],
        openFileIds: ["readme", "local", "removed"],
        activeFileId: "local",
      },
    });

    expect(next?.files.map((candidate) => candidate.id)).toEqual(["readme"]);
    expect(next?.files.find((candidate) => candidate.id === "readme")).toMatchObject({
      title: "README renamed.md",
      text: "",
    });
    expect(next?.activeFileId).toBe("readme");
  });

  it("uses the first remaining room document when the local active document is deleted", () => {
    const next = reconcileWorkspaceRoomStructure({
      createFile,
      readDocumentText: (documentId) => documentId === "readme" ? "# README" : null,
      snapshot: snapshot([documentNode("readme", "README.md", 0)]),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [file({ id: "removed", title: "Removed.md" })],
        openFileIds: ["removed"],
        activeFileId: "removed",
      },
    });
    expect(next?.activeFileId).toBe("readme");
    expect(next?.openFileIds).toEqual(["readme"]);
  });

  it("adds remote documents to the workspace without opening tabs for them", () => {
    const existing = file({ id: "readme", title: "README.md" });
    const next = reconcileWorkspaceRoomStructure({
      createFile,
      readDocumentText: (documentId) => documentId === "remote" ? "# Remote" : null,
      snapshot: snapshot([
        documentNode("readme", "README.md", 0),
        documentNode("remote", "Remote.md", 1),
      ]),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [existing],
        openFileIds: ["readme"],
        activeFileId: "readme",
      },
    });

    expect(next?.files.map((candidate) => candidate.id)).toEqual(["readme", "remote"]);
    expect(next?.files.find((candidate) => candidate.id === "remote")?.text).toBe("# Remote");
    expect(next?.openFileIds).toEqual(["readme"]);
    expect(next?.activeFileId).toBe("readme");
  });

  it("materializes existing document bodies only at an explicit persistence boundary", () => {
    const existing = file({ id: "readme", title: "README.md", text: "stale" });
    const next = reconcileWorkspaceRoomStructure({
      createFile,
      materializeExistingDocuments: true,
      readDocumentText: () => "current Yjs text",
      snapshot: snapshot([documentNode("readme", "README.md", 0)]),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [existing],
        openFileIds: ["readme"],
        activeFileId: "readme",
      },
    });

    expect(next.files[0].text).toBe("current Yjs text");
  });

  it("keeps canonical duplicate titles unchanged instead of publishing suffixes back into the room", () => {
    const next = reconcileWorkspaceRoomStructure({
      createFile,
      readDocumentText: (documentId) => documentId === "first" ? "A" : "B",
      snapshot: snapshot([
        documentNode("first", "Plan.md", 0),
        documentNode("second", "Plan.md", 1),
      ]),
      workspaceSnapshot: { folders: [createWorkspaceRootFolder()], files: [], openFileIds: [], activeFileId: "" },
    });
    expect(next?.files.map((candidate) => candidate.title)).toEqual(["Plan.md", "Plan.md"]);
  });

  it("accepts an empty room snapshot and removes every document", () => {
    const next = reconcileWorkspaceRoomStructure({
      createFile,
      readDocumentText: () => null,
      snapshot: snapshot([]),
      workspaceSnapshot: {
        folders: [createWorkspaceRootFolder()],
        files: [
          file({ id: "room-doc", title: "Room.md" }),
        ],
        openFileIds: ["room-doc", "unrelated-local"],
        activeFileId: "room-doc",
      },
    });

    expect(next.files).toEqual([]);
    expect(next.openFileIds).toEqual([]);
    expect(next.activeFileId).toBe("");
  });
});
