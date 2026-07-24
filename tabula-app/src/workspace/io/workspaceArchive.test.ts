import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  createWorkspaceArchive,
  createZipArchive,
  getWorkspaceArchiveEntries,
} from "./workspaceArchive";
import {
  WORKSPACE_ROOT_FOLDER_ID,
  createWorkspaceFile,
  createWorkspaceRootFolder,
} from "../workspaceStorage";

const readZipEntries = async (blob: Blob) =>
  Object.entries(unzipSync(new Uint8Array(await blob.arrayBuffer()))).map(([path, content]) => ({
    path,
    content: strFromU8(content),
  }));

describe("workspace archive", () => {
  it("preserves exact safe file names, extensions, and case", () => {
    expect(
      getWorkspaceArchiveEntries([
        createWorkspaceFile(1, { title: "Design.md", text: "# Design" }),
        createWorkspaceFile(2, { title: "design.md", text: "# Lowercase" }),
        createWorkspaceFile(3, { title: "Draft?  v1.markdown", text: "# Draft" }),
        createWorkspaceFile(4, { title: "No extension", text: "# Exact" }),
      ]),
    ).toEqual([
      { path: "Design.md", content: "# Design" },
      { path: "design.md", content: "# Lowercase" },
      { path: "Draft?  v1.markdown", content: "# Draft" },
      { path: "No extension", content: "# Exact" },
    ]);
  });

  it("rejects unsafe or duplicate paths instead of silently rewriting them", () => {
    expect(() => getWorkspaceArchiveEntries([
      createWorkspaceFile(1, { title: "Design.md", text: "# First" }),
      createWorkspaceFile(2, { title: "Design.md", text: "# Second" }),
    ])).toThrow("duplicate path Design.md");

    expect(() => getWorkspaceArchiveEntries([
      createWorkspaceFile(1, { title: "docs/Guide.md", text: "# Guide" }),
    ])).toThrow("invalid path segment");
  });

  it("creates a compressed zip archive with Markdown files", async () => {
    const archive = await createWorkspaceArchive([
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
    const archive = await createWorkspaceArchive(
      [
        createWorkspaceFile(1, { title: "README.md", text: "# Docs", parentId: "docs" }),
        createWorkspaceFile(2, { title: "ADR 1.md", text: "# ADR", parentId: "decisions" }),
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
    const archive = await createWorkspaceArchive(
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

  it("rejects duplicate raw zip entries instead of overwriting content", async () => {
    await expect(createZipArchive([
      { path: "README.md", content: "first" },
      { path: "README.md", content: "second" },
    ])).rejects.toThrow("duplicate archive path");
  });
});
