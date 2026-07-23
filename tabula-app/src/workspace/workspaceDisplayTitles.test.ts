import { describe, expect, it } from "vitest";
import { createWorkspaceFile } from "./workspaceStorage";
import {
  getWorkspaceFileDisplayTitles,
  getWorkspaceFilePaths,
  getWorkspaceFileTabLabels,
  getWorkspaceFolderDisplayTitles,
} from "./workspaceDisplayTitles";

describe("workspace display titles", () => {
  it("uses deterministic suffixes without rewriting CRDT titles", () => {
    const files = [
      createWorkspaceFile(1, { id: "b", title: "Notes.md" }),
      createWorkspaceFile(2, { id: "a", title: "Notes.md" }),
      createWorkspaceFile(3, { id: "c", title: "Notes 2.md" }),
    ];
    const titles = getWorkspaceFileDisplayTitles(files);
    expect(titles.get("a")).toBe("Notes.md");
    expect(titles.get("b")).toBe("Notes 3.md");
    expect(titles.get("c")).toBe("Notes 2.md");
    expect(files.map((file) => file.title)).toEqual(["Notes.md", "Notes.md", "Notes 2.md"]);
  });

  it("allows the same title in different folders", () => {
    const titles = getWorkspaceFileDisplayTitles([
      createWorkspaceFile(1, { id: "one", title: "README.md", parentId: "folder-1" }),
      createWorkspaceFile(2, { id: "two", title: "README.md", parentId: "folder-2" }),
    ]);
    expect(titles.get("one")).toBe("README.md");
    expect(titles.get("two")).toBe("README.md");
  });

  it("uses the same deterministic display-only rule for concurrent folders", () => {
    const titles = getWorkspaceFolderDisplayTitles([
      { id: "workspace-root", title: "Project", parentId: null },
      { id: "folder-b", title: "Notes", parentId: "workspace-root" },
      { id: "folder-a", title: "Notes", parentId: "workspace-root" },
    ]);

    expect(titles.get("folder-a")).toBe("Notes");
    expect(titles.get("folder-b")).toBe("Notes 2");
  });

  it("keeps filenames primary and adds separate location context only when names collide", () => {
    const folders = [
      { id: "workspace-root", title: "Workspace", parentId: null },
      { id: "planning", title: "Planning", parentId: "workspace-root" },
    ];
    const labels = getWorkspaceFileTabLabels([
      createWorkspaceFile(1, { id: "root", title: "Untitled.md", parentId: "workspace-root" }),
      createWorkspaceFile(2, { id: "planning-file", title: "Untitled.md", parentId: "planning" }),
      createWorkspaceFile(3, { id: "readme", title: "README.md", parentId: "workspace-root" }),
    ], folders);

    expect(labels.get("root")).toEqual({
      displayTitle: "Untitled.md",
      fullPath: "Untitled.md",
      locationLabel: "Root",
    });
    expect(labels.get("planning-file")).toEqual({
      displayTitle: "Untitled.md",
      fullPath: "Planning/Untitled.md",
      locationLabel: "Planning",
    });
    expect(labels.get("readme")).toEqual({
      displayTitle: "README.md",
      fullPath: "README.md",
      locationLabel: undefined,
    });
  });

  it("uses enough parent folders to distinguish repeated folder names", () => {
    const folders = [
      { id: "workspace-root", title: "Workspace", parentId: null },
      { id: "a", title: "A", parentId: "workspace-root" },
      { id: "b", title: "B", parentId: "workspace-root" },
      { id: "a-notes", title: "Notes", parentId: "a" },
      { id: "b-notes", title: "Notes", parentId: "b" },
    ];
    const labels = getWorkspaceFileTabLabels([
      createWorkspaceFile(1, { id: "a-file", title: "Plan.md", parentId: "a-notes" }),
      createWorkspaceFile(2, { id: "b-file", title: "Plan.md", parentId: "b-notes" }),
    ], folders);

    expect(labels.get("a-file")).toMatchObject({
      displayTitle: "Plan.md",
      fullPath: "A/Notes/Plan.md",
      locationLabel: "A/Notes",
    });
    expect(labels.get("b-file")).toMatchObject({
      displayTitle: "Plan.md",
      fullPath: "B/Notes/Plan.md",
      locationLabel: "B/Notes",
    });
  });

  it("builds exact source paths without applying display-only suffixes", () => {
    const folders = [
      { id: "workspace-root", title: "Workspace", parentId: null },
      { id: "knowledge", title: "Knowledge  Base", parentId: "workspace-root" },
    ];
    const files = [
      createWorkspaceFile(1, { id: "first", title: "Guide.MD", parentId: "knowledge" }),
      createWorkspaceFile(2, { id: "second", title: "Guide.MD", parentId: "knowledge" }),
    ];

    expect(getWorkspaceFilePaths(files, folders)).toEqual(new Map([
      ["first", "Knowledge  Base/Guide.MD"],
      ["second", "Knowledge  Base/Guide.MD"],
    ]));
  });
});
