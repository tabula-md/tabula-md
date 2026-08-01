import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getWorkspaceArchiveEntries } from "./workspaceArchive";
import {
  parseWorkspaceFolderFiles,
  parseWorkspaceFolderImport,
} from "./workspaceFolderImport";
import { getWorkspaceKnowledgeDocuments } from "../workspaceKnowledgeModel";

const defaults = {
  viewMode: "edit",
  readingWidth: "standard",
  lineWrapping: false,
  lineNumbers: true,
} as const;

const createFolderFile = (relativePath: string, content: BlobPart) => {
  const fileName = relativePath.split("/").at(-1) ?? relativePath;
  const file = new File([content], fileName, { type: "text/markdown" });
  Object.defineProperty(file, "webkitRelativePath", {
    configurable: true,
    value: `Selected workspace/${relativePath}`,
  });
  return file;
};

const readFixtureFiles = async (
  directory: string,
  relativeDirectory = "",
): Promise<Array<{ path: string; content: Uint8Array }>> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: Array<{ path: string; content: Uint8Array }> = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readFixtureFiles(absolutePath, relativePath));
    } else {
      files.push({
        path: relativePath,
        content: new Uint8Array(await readFile(absolutePath)),
      });
    }
  }
  return files;
};

describe("workspace folder import", () => {
  it("imports Markdown documents into their logical folder tree without opening every file", async () => {
    const workspace = await parseWorkspaceFolderFiles([
      createFolderFile("Planning/Launch notes.md", "# Launch"),
      createFolderFile("Planning/Research/Questions.md", "# Questions"),
    ], defaults);

    expect(workspace.files.map((file) => file.title)).toEqual(["Launch notes.md", "Questions.md"]);
    expect(workspace.folders.map((folder) => folder.title)).toEqual(["Selected workspace", "Planning", "Research"]);
    expect(workspace.files[1]?.parentId).toBe(workspace.folders[2]?.id);
    expect(workspace.files[0]).toMatchObject({ readingWidth: "standard", lineWrapping: false });
    expect(workspace.openFileIds).toEqual([]);
    expect(workspace.activeFileId).toBe("");
  });

  it("imports every selected file while keeping the knowledge index Markdown-only", async () => {
    const workspace = await parseWorkspaceFolderFiles([
      createFolderFile("README.md", "# Readme"),
      createFolderFile("Legacy.markdown", "# Legacy"),
      createFolderFile("notes.txt", "notes"),
    ], defaults);

    expect(workspace.files.map((file) => file.title)).toEqual([
      "Legacy.markdown",
      "notes.txt",
      "README.md",
    ]);
    expect(getWorkspaceKnowledgeDocuments(
      workspace.files,
      workspace.folders,
    ).map((document) => document.path)).toEqual(["README.md"]);
  });

  it("preserves OpenWiki run state without treating it as a knowledge document", async () => {
    const lastUpdate = [
      "{",
      '  "updatedAt": "2026-07-23T08:55:47.484Z",',
      '  "command": "update",',
      '  "gitHead": "23ddd2bf8768c4e65890617fd116e5c8a0f8b9ff"',
      "}",
      "",
    ].join("\r\n");
    const draft = await parseWorkspaceFolderImport([
      createFolderFile(".last-update.json", lastUpdate),
      createFolderFile(
        "index.md",
        [
          "---",
          'okf_version: "0.1"',
          "---",
          "",
          "# Directories",
          "",
          "- [architecture](architecture/)",
        ].join("\n"),
      ),
      createFolderFile("architecture/index.md", "# Files\n\n- [Overview](overview.md)"),
      createFolderFile(
        "architecture/overview.md",
        "---\ntype: Architecture\ntitle: Overview\n---\n\n# Overview",
      ),
      createFolderFile("ignored.json", '{"not":"openwiki state"}'),
    ], defaults);
    const { workspace } = draft;

    expect(workspace.files).toHaveLength(5);
    expect(workspace.files.map((file) => file.title)).toEqual(
      expect.arrayContaining([
        ".last-update.json",
        "ignored.json",
        "index.md",
        "index.md",
        "overview.md",
      ]),
    );
    const archiveEntries = getWorkspaceArchiveEntries(workspace.files, workspace.folders);
    expect(archiveEntries).toHaveLength(5);
    expect(archiveEntries).toEqual(expect.arrayContaining([
      { path: ".last-update.json", content: lastUpdate },
      { path: "ignored.json", content: '{"not":"openwiki state"}' },
      {
        path: "index.md",
        content: [
          "---",
          'okf_version: "0.1"',
          "---",
          "",
          "# Directories",
          "",
          "- [architecture](architecture/)",
        ].join("\n"),
      },
      { path: "architecture/index.md", content: "# Files\n\n- [Overview](overview.md)" },
      {
        path: "architecture/overview.md",
        content: "---\ntype: Architecture\ntitle: Overview\n---\n\n# Overview",
      },
    ]));

    const knowledgeIndex = createWorkspaceKnowledgeIndex(
      getWorkspaceKnowledgeDocuments(workspace.files, workspace.folders),
    );
    expect(knowledgeIndex.documentsById.size).toBe(3);
    expect(knowledgeIndex.brokenLinks).toEqual([]);
    expect(knowledgeIndex.outgoingLinksByDocumentId.get(
      workspace.files.find((file) => file.title === "index.md" && file.parentId === workspace.folders[0]?.id)?.id ?? "",
    )).toEqual([
      expect.objectContaining({
        status: "resolved",
        targetPath: "architecture/index.md",
      }),
    ]);
  });

  it("round-trips text and binary bundle assets from any directory without indexing them", async () => {
    const binary = new Uint8Array([0, 255, 10, 128, 64]);
    const draft = await parseWorkspaceFolderImport([
      createFolderFile("index.md", "# Files"),
      createFolderFile(
        "concept.md",
        "---\ntype: Attested Computation\ncomputation: references/query.sql\n---\n\n# Computation",
      ),
      createFolderFile("references/query.sql", "SELECT 1;\r\n"),
      createFolderFile("references/diagram.png", binary),
      createFolderFile("source.ts", "not part of the knowledge bundle"),
    ], defaults);
    const { workspace } = draft;

    const archiveEntries = getWorkspaceArchiveEntries(workspace.files, workspace.folders);
    expect(archiveEntries).toEqual(expect.arrayContaining([
      { path: "references/query.sql", content: "SELECT 1;\r\n" },
      { path: "references/diagram.png", content: binary },
      { path: "source.ts", content: "not part of the knowledge bundle" },
    ]));
    expect(createWorkspaceKnowledgeIndex(
      getWorkspaceKnowledgeDocuments(workspace.files, workspace.folders),
    ).documentsById.size).toBe(2);
  });

  it("round-trips the OpenWiki fixture byte-for-byte", async () => {
    const fixtureFiles = await readFixtureFiles(path.resolve(
      "scripts/browser-smoke/fixtures/openwiki-okf",
    ));
    const workspace = await parseWorkspaceFolderFiles(
      fixtureFiles.map((entry) =>
        createFolderFile(entry.path, new Uint8Array(entry.content).buffer)
      ),
      defaults,
    );
    const exported = new Map(
      getWorkspaceArchiveEntries(workspace.files, workspace.folders)
        .filter((entry) => !entry.path.endsWith("/"))
        .map((entry) => [
          entry.path,
          typeof entry.content === "string"
            ? new TextEncoder().encode(entry.content)
            : entry.content,
        ]),
    );

    expect([...exported.keys()].sort()).toEqual(
      fixtureFiles.map((entry) => entry.path).sort(),
    );
    for (const fixture of fixtureFiles) {
      expect(exported.get(fixture.path)).toEqual(fixture.content);
    }
  });

  it("round-trips exact relative paths, case, spacing, and Markdown text", async () => {
    const text = "---\r\ntype: Concept\r\n---\r\n\r\n# Attention\r\n";
    const workspace = await parseWorkspaceFolderFiles([
      createFolderFile("Knowledge  Base/Concepts/Attention.MD", text),
      createFolderFile("Knowledge  Base/Concepts/attention.md", "# lowercase"),
    ], defaults);

    expect(getWorkspaceArchiveEntries(workspace.files, workspace.folders)).toEqual([
      { path: "Knowledge  Base/Concepts/attention.md", content: "# lowercase" },
      { path: "Knowledge  Base/Concepts/Attention.MD", content: text },
    ]);
  });

  it("rejects unsupported path segments instead of normalizing them", async () => {
    await expect(parseWorkspaceFolderFiles([
      createFolderFile("Docs\\Guide.md", "# Guide"),
    ], defaults)).rejects.toThrow("invalid path");
  });

  it("rejects folders without Markdown documents", async () => {
    await expect(parseWorkspaceFolderFiles([
      createFolderFile("notes.txt", "notes"),
    ], defaults)).rejects.toThrow("does not contain any Markdown");
  });
});
