import { describe, expect, it } from "vitest";
import {
  PROJECT_STORAGE_VERSION,
  parseWorkspacePayload,
  serializeFile,
} from "./workspaceStorage";
import { migrateWorkspaceStoragePayload } from "./workspaceStorageMigrations";
import projectV5 from "./__fixtures__/storage/project-v5.json";
import projectV6 from "./__fixtures__/storage/project-v6.json";

const fixtures = [
  {
    name: "v5 flat paths",
    payload: projectV5,
  },
  {
    name: "v6 workspace tree",
    payload: projectV6,
  },
] as const;

describe("workspace storage migrations", () => {
  it.each(fixtures)("migrates $name to the current invariant", ({ payload }) => {
    const result = migrateWorkspaceStoragePayload(
      payload,
      PROJECT_STORAGE_VERSION,
    );
    const workspace = parseWorkspacePayload(payload);

    expect(result.payload?.version).toBe(PROJECT_STORAGE_VERSION);
    expect(result.event).toEqual({
      fromVersion: payload.version,
      status: "migrated",
      toVersion: PROJECT_STORAGE_VERSION,
    });
    expect(workspace?.files).toHaveLength(1);
    expect(workspace?.activeFileId).toBe("guide");
    expect(workspace?.openFileIds).toEqual(["guide"]);
    expect(workspace?.files[0]?.editingMode).toBe("source");
  });

  it("rebuilds v5 path segments as folders", () => {
    const workspace = parseWorkspacePayload(fixtures[0].payload);

    expect(workspace?.files[0]).toMatchObject({
      title: "Guide.md",
      parentId: "migrated-folder-1",
    });
    expect(workspace?.folders.map(({ title }) => title)).toEqual([
      "Project",
      "docs",
    ]);
  });

  it("rejects unsupported versions without mutating the source payload", () => {
    const payload = {
      schema: "tabula.project",
      version: 4,
      files: projectV6.files,
    };
    const snapshot = structuredClone(payload);

    expect(migrateWorkspaceStoragePayload(payload, PROJECT_STORAGE_VERSION)).toEqual({
      event: {
        fromVersion: 4,
        status: "rejected",
        toVersion: PROJECT_STORAGE_VERSION,
      },
      payload: null,
    });
    expect(payload).toEqual(snapshot);
    expect(parseWorkspacePayload(payload)).toBeNull();
  });

  it("rejects current-version payloads that violate storage invariants", () => {
    const malformed = {
      ...projectV6,
      version: PROJECT_STORAGE_VERSION,
      activeFileId: "missing",
      openFileIds: ["missing"],
      files: {
        guide: {
          ...projectV6.files.guide,
          editingMode: "source",
        },
      },
    };

    expect(
      migrateWorkspaceStoragePayload(malformed, PROJECT_STORAGE_VERSION),
    ).toMatchObject({
      event: { status: "rejected" },
      payload: null,
    });
    expect(parseWorkspacePayload(malformed)).toBeNull();
  });

  it("does not expose document data in migration events", () => {
    const { event } = migrateWorkspaceStoragePayload(
      fixtures[1].payload,
      PROJECT_STORAGE_VERSION,
    );

    expect(Object.keys(event).sort()).toEqual([
      "fromVersion",
      "status",
      "toVersion",
    ]);
  });

  it("persists artifact metadata without changing legacy Markdown defaults", () => {
    const workspace = parseWorkspacePayload(fixtures[1].payload);
    const file = workspace?.files[0];
    expect(file?.artifact).toBeUndefined();
    expect(file && serializeFile({
      ...file,
      artifact: {
        kind: "asset",
        mediaType: "image/png",
        contentKind: "binary",
        sourceHash: "sha256:abc",
        editable: false,
      },
    }).artifact).toEqual({
      kind: "asset",
      mediaType: "image/png",
      contentKind: "binary",
      sourceHash: "sha256:abc",
      editable: false,
    });
  });
});
