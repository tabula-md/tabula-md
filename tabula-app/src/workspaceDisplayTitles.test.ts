import { describe, expect, it } from "vitest";
import { createWorkspaceFile } from "./workspaceStorage";
import {
  getWorkspaceFileDisplayTitles,
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
});
