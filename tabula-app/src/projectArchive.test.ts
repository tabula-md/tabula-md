import { describe, expect, it } from "vitest";
import {
  createProjectArchive,
  createZipArchive,
  getCrc32,
  getProjectArchiveEntries,
} from "./projectArchive";
import { createWorkspaceFile } from "./workspaceStorage";

const textDecoder = new TextDecoder();

const readStoredZipEntries = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const entries: Array<{ path: string; content: string }> = [];
  let offset = 0;

  while (offset + 30 <= bytes.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const pathLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const pathStart = offset + 30;
    const contentStart = pathStart + pathLength + extraLength;
    const contentEnd = contentStart + compressedSize;

    entries.push({
      path: textDecoder.decode(bytes.slice(pathStart, pathStart + pathLength)),
      content: textDecoder.decode(bytes.slice(contentStart, contentEnd)),
    });
    offset = contentEnd;
  }

  return entries;
};

describe("project archive", () => {
  it("computes standard CRC32 values", () => {
    expect(getCrc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

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
      { path: "bad/name-.markdown", content: "# Third" },
      { path: "docs/Guide.md", content: "# Guide" },
      { path: "docs/Guide 2.md", content: "# Guide 2" },
    ]);
  });

  it("creates an uncompressed zip archive with Markdown files", async () => {
    const archive = createProjectArchive([
      createWorkspaceFile(1, { title: "README.md", text: "# README" }),
      createWorkspaceFile(2, { title: "Notes.md", text: "한글 Markdown" }),
    ]);

    expect(archive.type).toBe("application/zip");
    await expect(readStoredZipEntries(archive)).resolves.toEqual([
      { path: "README.md", content: "# README" },
      { path: "Notes.md", content: "한글 Markdown" },
    ]);
  });

  it("creates zip entries with logical folder structure", async () => {
    const archive = createProjectArchive([
      createWorkspaceFile(1, { title: "docs/README.md", text: "# Docs" }),
      createWorkspaceFile(2, { title: "decisions/ADR 1", text: "# ADR" }),
    ]);

    await expect(readStoredZipEntries(archive)).resolves.toEqual([
      { path: "docs/README.md", content: "# Docs" },
      { path: "decisions/ADR 1.md", content: "# ADR" },
    ]);
  });

  it("supports empty zip archives for defensive callers", async () => {
    await expect(readStoredZipEntries(createZipArchive([]))).resolves.toEqual([]);
  });
});
