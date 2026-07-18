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
} from "./workspaceStorage";

const readZipEntries = async (blob: Blob) =>
  Object.entries(unzipSync(new Uint8Array(await blob.arrayBuffer()))).map(([path, content]) => ({
    path,
    content: strFromU8(content),
  }));

describe("workspace archive", () => {
  it("normalizes workspace files into deduped Markdown entry paths", () => {
    expect(
      getWorkspaceArchiveEntries([
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
});
