import { describe, expect, it } from "vitest";
import { parseWorkspaceFolderFiles } from "./workspaceFolderImport";

const defaults = {
  viewMode: "edit",
  readingWidth: "standard",
  lineWrapping: false,
  lineNumbers: true,
} as const;

const createFolderFile = (relativePath: string, content: string) => {
  const fileName = relativePath.split("/").at(-1) ?? relativePath;
  const file = new File([content], fileName, { type: "text/markdown" });
  Object.defineProperty(file, "webkitRelativePath", {
    configurable: true,
    value: `Selected workspace/${relativePath}`,
  });
  return file;
};

describe("workspace folder import", () => {
  it("imports Markdown documents into their logical folder tree without opening every file", async () => {
    const workspace = await parseWorkspaceFolderFiles([
      createFolderFile("Planning/Launch notes.md", "# Launch"),
      createFolderFile("Planning/Research/Questions.md", "# Questions"),
    ], defaults);

    expect(workspace.files.map((file) => file.title)).toEqual(["Launch notes.md", "Questions.md"]);
    expect(workspace.folders.map((folder) => folder.title)).toEqual(["Project", "Planning", "Research"]);
    expect(workspace.files[1]?.parentId).toBe(workspace.folders[2]?.id);
    expect(workspace.files[0]).toMatchObject({ readingWidth: "standard", lineWrapping: false });
    expect(workspace.openFileIds).toEqual([]);
    expect(workspace.activeFileId).toBe("");
  });

  it("includes only .md documents", async () => {
    const workspace = await parseWorkspaceFolderFiles([
      createFolderFile("README.md", "# Readme"),
      createFolderFile("Legacy.markdown", "# Legacy"),
      createFolderFile("notes.txt", "notes"),
    ], defaults);

    expect(workspace.files.map((file) => file.title)).toEqual(["README.md"]);
  });

  it("rejects folders without Markdown documents", async () => {
    await expect(parseWorkspaceFolderFiles([
      createFolderFile("notes.txt", "notes"),
    ], defaults)).rejects.toThrow("does not contain any Markdown");
  });
});
