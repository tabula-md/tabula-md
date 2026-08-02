import { describe, expect, it, vi } from "vitest";
import { createLibraryBundle, getLibraryBundleRows } from "./libraryBundleStore";

const createSelectedFile = (path: string, content = "content") => {
  const name = path.split("/").at(-1) ?? path;
  const file = new File([content], name, { type: "text/plain" });
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
};

describe("library bundles", () => {
  it("keeps every selected file while removing the shared folder root", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "bundle-id" });
    const bundle = createLibraryBundle([
      createSelectedFile("Team handbook/index.md"),
      createSelectedFile("Team handbook/assets/diagram.png"),
    ], new Date("2026-08-02T00:00:00.000Z"));

    expect(bundle).toMatchObject({
      id: "bundle-id",
      name: "Team handbook",
      importedAt: "2026-08-02T00:00:00.000Z",
    });
    expect(bundle.files.map((file) => file.path)).toEqual([
      "index.md",
      "assets/diagram.png",
    ]);
    expect(bundle.files.every((file) => file.content instanceof Blob)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("rejects an empty folder selection", () => {
    expect(() => createLibraryBundle([])).toThrow("Select a folder");
  });

  it("presents bundle folders before their nested files", () => {
    const bundle = createLibraryBundle([
      createSelectedFile("Runbooks/index.md"),
      createSelectedFile("Runbooks/operations/deploy.md"),
    ]);

    expect(getLibraryBundleRows(bundle.files)).toEqual([
      { path: "operations", name: "operations", depth: 0, kind: "folder" },
      { path: "operations/deploy.md", name: "deploy.md", depth: 1, kind: "file" },
      { path: "index.md", name: "index.md", depth: 0, kind: "file" },
    ]);
  });
});
