import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  createProjectArchive,
  createZipArchive,
  getProjectArchiveEntries,
  parseProjectArchive,
} from "./projectArchive";
import {
  WORKSPACE_ROOT_FOLDER_ID,
  createWorkspaceFile,
  createWorkspaceRootFolder,
} from "./workspaceStorage";

const readZipEntries = async (blob: Blob) =>
  Object.entries(unzipSync(new Uint8Array(await blob.arrayBuffer()))).map(([path, content]) => ({
    path,
    content: strFromU8(content),
  }));

describe("project archive", () => {
  it("normalizes project files into deduped Markdown entry paths", () => {
    expect(
      getProjectArchiveEntries([
        createWorkspaceFile(1, { title: "Design", text: "# Design" }),
        createWorkspaceFile(2, { title: "Design.md", text: "# Second" }),
        createWorkspaceFile(3, { title: "../bad/name?.markdown", text: "# Third" }),
        createWorkspaceFile(4, { title: "docs/Guide", text: "# Guide" }),
        createWorkspaceFile(5, { title: "docs/Guide.md", text: "# Guide 2" }),
      ]),
    ).toEqual([
      { path: "Design.md", content: "# Design" },
      { path: "Design 2.md", content: "# Second" },
      { path: "bad-name-.markdown", content: "# Third" },
      { path: "docs-Guide.md", content: "# Guide" },
      { path: "docs-Guide 2.md", content: "# Guide 2" },
    ]);
  });

  it("creates a compressed zip archive with Markdown files", async () => {
    const archive = await createProjectArchive([
      createWorkspaceFile(1, { title: "README.md", text: "# README" }),
      createWorkspaceFile(2, { title: "Notes.md", text: "한글 Markdown" }),
    ]);

    expect(archive.type).toBe("application/zip");
    await expect(readZipEntries(archive)).resolves.toEqual([
      { path: "README.md", content: "# README" },
      { path: "Notes.md", content: "한글 Markdown" },
    ]);
  });

  it("creates zip entries with logical folder structure", async () => {
    const archive = await createProjectArchive(
      [
        createWorkspaceFile(1, { title: "README.md", text: "# Docs", parentId: "docs" }),
        createWorkspaceFile(2, { title: "ADR 1", text: "# ADR", parentId: "decisions" }),
      ],
      [
        createWorkspaceRootFolder(),
        { id: "docs", title: "docs", parentId: WORKSPACE_ROOT_FOLDER_ID },
        { id: "decisions", title: "decisions", parentId: WORKSPACE_ROOT_FOLDER_ID },
      ],
    );

    await expect(readZipEntries(archive)).resolves.toEqual([
      { path: "docs/README.md", content: "# Docs" },
      { path: "decisions/ADR 1.md", content: "# ADR" },
    ]);
  });

  it("preserves empty logical folders", async () => {
    const archive = await createProjectArchive(
      [createWorkspaceFile(1, { title: "README.md", text: "# Root" })],
      [
        createWorkspaceRootFolder(),
        { id: "empty", title: "Empty notes", parentId: WORKSPACE_ROOT_FOLDER_ID },
      ],
    );

    await expect(readZipEntries(archive)).resolves.toEqual([
      { path: "Empty notes/", content: "" },
      { path: "README.md", content: "# Root" },
    ]);
  });

  it("supports empty zip archives for defensive callers", async () => {
    await expect(createZipArchive([]).then(readZipEntries)).resolves.toEqual([]);
  });

  it("opens a workspace archive into its logical folder tree", async () => {
    const archive = await createZipArchive([
      { path: "Planning/Launch notes.md", content: "# Launch" },
      { path: "Planning/Research/Questions.markdown", content: "# Questions" },
    ]);
    const workspace = await parseProjectArchive(new Uint8Array(await archive.arrayBuffer()), {
      viewMode: "edit",
      readingWidth: "standard",
      lineWrapping: false,
      lineNumbers: true,
    });

    expect(workspace.files.map((file) => file.title)).toEqual(["Launch notes.md", "Questions.markdown"]);
    expect(workspace.folders.map((folder) => folder.title)).toEqual(["Project", "Planning", "Research"]);
    expect(workspace.files[1]?.parentId).toBe(workspace.folders[2]?.id);
    expect(workspace.files[0]).toMatchObject({ readingWidth: "standard", lineWrapping: false });
  });

  it("rejects path traversal and archives without Markdown files", async () => {
    const traversalArchive = await createZipArchive([{ path: "../secret.md", content: "secret" }]);
    const textArchive = await createZipArchive([{ path: "notes.txt", content: "not Markdown" }]);
    const defaults = { viewMode: "edit", readingWidth: "wide", lineWrapping: true, lineNumbers: true } as const;

    await expect(parseProjectArchive(new Uint8Array(await traversalArchive.arrayBuffer()), defaults)).rejects.toThrow(
      "invalid path",
    );
    await expect(parseProjectArchive(new Uint8Array(await textArchive.arrayBuffer()), defaults)).rejects.toThrow(
      "does not contain any Markdown",
    );
  });
});
