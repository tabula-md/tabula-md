import { describe, expect, it } from "vitest";
import {
  createWorkspaceArtifact,
  type WorkspaceArtifact,
} from "@tabula-md/tabula";
import {
  createArtifactSnapshotFromWorkspace,
  createLiveFolderSourceAdapter,
  createWorkspaceDraftFromArtifactSnapshot,
  getLiveFolderWorkspaceWritePlan,
  type LiveFolderDirectoryHandle,
  type LiveFolderFileHandle,
} from "./workspaceLiveFolder";

class MemoryFileHandle implements LiveFolderFileHandle {
  readonly kind = "file";
  failWrites = 0;
  constructor(
    readonly name: string,
    private bytes: Uint8Array,
  ) {}
  async getFile() {
    const bytes = Uint8Array.from(this.bytes);
    return { arrayBuffer: async () => bytes.buffer };
  }
  async createWritable() {
    return {
      write: async (data: BufferSource | Blob | string) => {
        if (this.failWrites > 0) {
          this.failWrites -= 1;
          throw new Error("Injected write failure");
        }
        if (typeof data === "string") {
          this.bytes = new TextEncoder().encode(data);
        } else if (data instanceof Blob) {
          this.bytes = new Uint8Array(await data.arrayBuffer());
        } else {
          const view = ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : new Uint8Array(data);
          this.bytes = Uint8Array.from(view);
        }
      },
      close: async () => undefined,
    };
  }
}

class MemoryDirectoryHandle implements LiveFolderDirectoryHandle {
  readonly kind = "directory";
  readonly children = new Map<
    string,
    MemoryDirectoryHandle | MemoryFileHandle
  >();
  permission: "denied" | "granted" | "prompt" = "granted";
  constructor(readonly name: string) {}
  async *entries() {
    for (const entry of [...this.children.entries()].sort()) yield entry;
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.children.get(name);
    if (existing?.kind === "directory") return existing;
    if (existing || !options?.create) throw new DOMException("Missing", "NotFoundError");
    const directory = new MemoryDirectoryHandle(name);
    this.children.set(name, directory);
    return directory;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.children.get(name);
    if (existing?.kind === "file") return existing;
    if (existing || !options?.create) throw new DOMException("Missing", "NotFoundError");
    const file = new MemoryFileHandle(name, new Uint8Array());
    this.children.set(name, file);
    return file;
  }
  async removeEntry(name: string) {
    if (!this.children.delete(name)) {
      throw new DOMException("Missing", "NotFoundError");
    }
  }
  async queryPermission() {
    return this.permission;
  }
  async requestPermission() {
    return this.permission;
  }
}

const put = async (
  root: MemoryDirectoryHandle,
  path: string,
  content: string,
) => {
  const segments = path.split("/");
  const name = segments.pop()!;
  let directory = root;
  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, { create: true });
  }
  const file = await directory.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(content);
  await writable.close();
};

const textArtifact = (
  id: string,
  path: string,
  text: string,
): Promise<WorkspaceArtifact> =>
  createWorkspaceArtifact({
    id,
    path,
    content: { kind: "text", text, encoding: "utf-8" },
  });

describe("live folder source", () => {
  it("writes edits, creates, moves, and explicit deletes to the selected folder", async () => {
    const root = new MemoryDirectoryHandle("Project");
    await put(root, "README.md", "# Before");
    await put(root, "old.md", "# Move");
    await put(root, "delete.md", "# Delete");
    const adapter = createLiveFolderSourceAdapter(root);
    const baseline = await adapter.readSnapshot();
    const readme = baseline.artifacts.find((item) => item.path === "README.md")!;
    const deleted = baseline.artifacts.find((item) => item.path === "delete.md")!;
    const changed = await textArtifact(readme.id, "README.md", "# After");
    const created = await textArtifact("new", "docs/new.md", "# New");

    const result = await adapter.writeChanges?.([
      {
        type: "update",
        artifact: changed,
        expectedSourceHash: readme.sourceHash,
      },
      { type: "create", artifact: created },
      {
        type: "move",
        artifactId: "old.md",
        fromPath: "old.md",
        toPath: "archive/old.md",
      },
      {
        type: "delete",
        artifactId: deleted.id,
        path: deleted.path,
        expectedSourceHash: deleted.sourceHash,
      },
    ]);

    expect(result?.ok).toBe(true);
    expect((await adapter.readSnapshot()).artifacts.map((item) => item.path))
      .toEqual(["archive/old.md", "docs/new.md", "README.md"]);
  });

  it("skips generated dependency folders without hiding the exclusion", async () => {
    const root = new MemoryDirectoryHandle("Project");
    await put(root, "README.md", "# Project");
    await put(root, ".obsidian/app.json", '{"vimMode":true}');
    await put(root, "node_modules/dependency/index.js", "generated");
    await put(root, ".git/objects/pack", "generated");
    await put(root, "dist/index.js", "generated");

    const snapshot = await createLiveFolderSourceAdapter(root).readSnapshot();

    expect(snapshot.artifacts.map((item) => item.path)).toEqual([
      ".obsidian/app.json",
      "README.md",
    ]);
    expect(snapshot.excludedPaths).toEqual([
      ".git/",
      "dist/",
      "node_modules/",
    ]);

    const draft = await createWorkspaceDraftFromArtifactSnapshot(
      snapshot,
      root.name,
      {
        viewMode: "edit",
        readingWidth: "standard",
        lineWrapping: false,
        lineNumbers: false,
      },
    );
    expect(draft).toMatchObject({
      excludedPaths: [".git/", "dist/", "node_modules/"],
      sourceKind: "live-folder",
      profile: { ignoredFileCount: 3 },
    });
  });

  it("does not apply collaboration-room file limits to a local folder", async () => {
    const artifacts = await Promise.all(
      Array.from({ length: 501 }, (_, index) =>
        textArtifact(`file-${index}`, `notes/file-${index}.md`, `# ${index}`)),
    );

    const draft = await createWorkspaceDraftFromArtifactSnapshot(
      {
        artifacts,
        capturedAt: "2026-07-30T00:00:00.000Z",
      },
      "Project",
      {
        viewMode: "edit",
        readingWidth: "standard",
        lineWrapping: false,
        lineNumbers: false,
      },
    );

    expect(draft.workspace.files).toHaveLength(501);
    expect(draft.sourceKind).toBe("live-folder");
  });

  it("connects an empty folder so its first document can be created in Tabula", async () => {
    const draft = await createWorkspaceDraftFromArtifactSnapshot(
      {
        artifacts: [],
        capturedAt: "2026-07-30T00:00:00.000Z",
      },
      "Empty workspace",
      {
        viewMode: "edit",
        readingWidth: "standard",
        lineWrapping: false,
        lineNumbers: false,
      },
    );

    expect(draft.workspace.files).toEqual([]);
    expect(draft.workspace.folders).toEqual([
      expect.objectContaining({
        title: "Empty workspace",
        parentId: null,
      }),
    ]);
    expect(draft.sourceKind).toBe("live-folder");
  });

  it("does not overwrite an externally changed file", async () => {
    const root = new MemoryDirectoryHandle("Project");
    await put(root, "README.md", "# Base");
    const adapter = createLiveFolderSourceAdapter(root);
    const baseline = await adapter.readSnapshot();
    const readme = baseline.artifacts[0]!;
    await put(root, "README.md", "# External");
    const local = await textArtifact(readme.id, readme.path, "# Local");

    await expect(adapter.writeChanges?.([{
      type: "update",
      artifact: local,
      expectedSourceHash: readme.sourceHash,
    }])).resolves.toEqual({ ok: false, reason: "conflict" });
    expect(
      (await adapter.readSnapshot()).artifacts[0]?.content,
    ).toMatchObject({ kind: "text", text: "# External" });
  });

  it("restores earlier files when a later write fails", async () => {
    const root = new MemoryDirectoryHandle("Project");
    await put(root, "first.md", "# First");
    await put(root, "second.md", "# Second");
    const adapter = createLiveFolderSourceAdapter(root);
    const baseline = await adapter.readSnapshot();
    const first = baseline.artifacts.find((item) => item.path === "first.md")!;
    const second = baseline.artifacts.find((item) => item.path === "second.md")!;
    const changedFirst = await textArtifact(first.id, first.path, "# Changed first");
    const changedSecond = await textArtifact(second.id, second.path, "# Changed second");
    const secondHandle = root.children.get("second.md") as MemoryFileHandle;
    secondHandle.failWrites = 1;

    const result = await adapter.writeChanges?.([
      {
        type: "update",
        artifact: changedFirst,
        expectedSourceHash: first.sourceHash,
      },
      {
        type: "update",
        artifact: changedSecond,
        expectedSourceHash: second.sourceHash,
      },
    ]);

    expect(result).toMatchObject({ ok: false, reason: "unknown" });
    const restored = await adapter.readSnapshot();
    expect(restored.artifacts.map((artifact) => artifact.content)).toEqual([
      expect.objectContaining({ kind: "text", text: "# First" }),
      expect.objectContaining({ kind: "text", text: "# Second" }),
    ]);
  });

  it("preserves local state when write permission is unavailable", async () => {
    const root = new MemoryDirectoryHandle("Project");
    root.permission = "denied";
    const adapter = createLiveFolderSourceAdapter(root);
    const created = await textArtifact("new", "new.md", "# New");

    await expect(adapter.writeChanges?.([
      { type: "create", artifact: created },
    ])).resolves.toEqual({ ok: false, reason: "permission" });
    expect((await adapter.readSnapshot()).artifacts).toEqual([]);
  });

  it("plans create, update, move, and separately confirmed delete operations", async () => {
    const original = await textArtifact("readme", "README.md", "# Original");
    const deleted = await textArtifact("deleted", "deleted.md", "# Deleted");
    const changed = await textArtifact("readme", "docs/README.md", "# Changed");
    const created = await textArtifact("created", "created.md", "# Created");
    const plan = getLiveFolderWorkspaceWritePlan(
      { artifacts: [original, deleted], capturedAt: "before" },
      { artifacts: [changed, created], capturedAt: "after" },
    );

    expect(plan.changes.map((change) => change.type)).toEqual([
      "move",
      "update",
      "create",
    ]);
    expect(plan.changes[0]).toMatchObject({
      type: "move",
      expectedSourceHash: original.sourceHash,
    });
    expect(plan.deletes).toEqual([
      expect.objectContaining({
        type: "delete",
        path: "deleted.md",
        expectedSourceHash: deleted.sourceHash,
      }),
    ]);
  });

  it("converts the existing workspace model without indexing editor state", async () => {
    const snapshot = await createArtifactSnapshotFromWorkspace([
      {
        id: "readme",
        title: "README.md",
        text: "# Readme",
        parentId: "workspace-root",
        viewMode: "visual",
        editingMode: "visual",
        readingWidth: "wide",
        lineWrapping: true,
        lineNumbers: true,
      },
    ], [
      { id: "workspace-root", title: "Project", parentId: null },
    ]);

    expect(snapshot.artifacts[0]).toMatchObject({
      id: "readme",
      path: "README.md",
      kind: "document",
      content: { kind: "text", text: "# Readme" },
    });
    expect(snapshot.artifacts[0]).not.toHaveProperty("viewMode");
  });

  it("preserves editor identity and preferences across an external move", async () => {
    const moved = await textArtifact(
      "disk-path",
      "archive/README.md",
      "# Readme",
    );
    const draft = await createWorkspaceDraftFromArtifactSnapshot(
      { artifacts: [moved], capturedAt: "external" },
      "Project",
      {
        viewMode: "edit",
        readingWidth: "standard",
        lineWrapping: false,
        lineNumbers: false,
      },
      {
        activeFileId: "stable-id",
        openFileIds: ["stable-id"],
        folders: [
          { id: "workspace-root", title: "Project", parentId: null },
        ],
        files: [{
          id: "stable-id",
          title: "README.md",
          text: "# Readme",
          parentId: "workspace-root",
          viewMode: "visual",
          editingMode: "visual",
          readingWidth: "wide",
          lineWrapping: true,
          lineNumbers: true,
          artifact: {
            kind: "document",
            mediaType: "text/markdown",
            contentKind: "text",
            sourceHash: moved.sourceHash,
            editable: true,
          },
        }],
      },
    );

    expect(draft.workspace.files[0]).toMatchObject({
      id: "stable-id",
      title: "README.md",
      viewMode: "visual",
      readingWidth: "wide",
    });
    expect(draft.workspace.activeFileId).toBe("stable-id");
    expect(draft.workspace.openFileIds).toEqual(["stable-id"]);
  });
});
