import { describe, expect, it } from "vitest";
import { parseWorkspaceFolderImport } from "./workspaceFolderImport";
import { getWorkspaceImportResult } from "./workspaceImportResultModel";

const defaults = {
  viewMode: "edit",
  readingWidth: "standard",
  lineWrapping: false,
  lineNumbers: true,
} as const;

const createFolderFile = (relativePath: string, content: BlobPart) => {
  const file = new File(
    [content],
    relativePath.split("/").at(-1) ?? relativePath,
  );
  Object.defineProperty(file, "webkitRelativePath", {
    configurable: true,
    value: `Imported/${relativePath}`,
  });
  return file;
};

describe("workspace import result", () => {
  it("orients an imported OKF workspace with existing review models", async () => {
    const draft = await parseWorkspaceFolderImport([
      createFolderFile(
        "index.md",
        "---\nokf_version: \"0.1\"\n---\n\n# Files\n\n- [Architecture](architecture/)",
      ),
      createFolderFile(
        "architecture/index.md",
        "# Files\n\n- [Runtime](runtime.md)",
      ),
      createFolderFile(
        "architecture/runtime.md",
        "---\ntype: Architecture\ntitle: Runtime\n---\n\n# Runtime",
      ),
      createFolderFile("log.md", "# Log"),
      createFolderFile("references/query.sql", "SELECT 1;"),
      createFolderFile("source.ts", "console.log('preserved');"),
    ], defaults);

    const result = await getWorkspaceImportResult(draft);

    expect(result).toMatchObject({
      standardVersion: "0.1",
      conceptCount: 1,
      directoryIndexCount: 1,
      hasActivityLog: true,
      preservedSupportPaths: ["references/query.sql", "source.ts"],
      rootIndexDocumentId: expect.any(String),
      suggestsV02Transition: true,
    });
    expect(result?.requiredChangeCount).toEqual(expect.any(Number));
    expect(result?.attentionCount).toEqual(expect.any(Number));
  });

  it("does not add OKF orientation to a plain Markdown import", async () => {
    const draft = await parseWorkspaceFolderImport([
      createFolderFile("README.md", "# Readme"),
    ], defaults);

    await expect(getWorkspaceImportResult(draft)).resolves.toBeUndefined();
  });
});
