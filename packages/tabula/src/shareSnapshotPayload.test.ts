import { describe, expect, it } from "vitest";

import {
  createShareSnapshotPayload,
  validateShareSnapshotPayload,
} from "./shareSnapshotPayload";
import { WORKSPACE_ROOM_MAX_DOCUMENTS } from "./workspaceRoomModel";

const root = { id: "workspace-root", title: "Project", parentId: null, order: 0 };

describe("share snapshot payload", () => {
  it("keeps selected files and their logical folder ancestors", () => {
    const payload = createShareSnapshotPayload({
      rootFolderId: root.id,
      folders: [root, { id: "docs", title: "Docs", parentId: root.id, order: 1 }],
      files: [{ id: "readme", title: "README.md", text: "# Hello", parentId: "docs" }],
      activeFileId: "readme",
      commentsByFileId: {},
    });

    expect(payload.folders.map(({ id }) => id)).toEqual(["workspace-root", "docs"]);
    expect(payload.files[0]).toMatchObject({ id: "readme", parentId: "docs" });
  });

  it("rejects payloads that exceed workspace document limits", () => {
    const files = Array.from({ length: WORKSPACE_ROOM_MAX_DOCUMENTS + 1 }, (_, index) => ({
      id: `doc-${index}`,
      title: `Doc ${index}.md`,
      text: "",
      parentId: root.id,
      order: index,
    }));

    expect(() => validateShareSnapshotPayload({
      schemaVersion: 2,
      createdAt: "2026-07-10T00:00:00.000Z",
      rootFolderId: root.id,
      activeFileId: files[0].id,
      folders: [root],
      files,
      commentsByFileId: {},
    })).toThrow("workspace is too large");
  });

  it("rejects path-like titles and oversized comment bodies", () => {
    const base = {
      schemaVersion: 2,
      createdAt: "2026-07-10T00:00:00.000Z",
      rootFolderId: root.id,
      activeFileId: "readme",
      folders: [root],
      files: [{ id: "readme", title: "README.md", text: "", parentId: root.id, order: 0 }],
      commentsByFileId: {},
    };

    expect(() => validateShareSnapshotPayload({
      ...base,
      files: [{ ...base.files[0], title: "docs/README.md" }],
    })).toThrow("invalid file.title");
    expect(() => validateShareSnapshotPayload({
      ...base,
      commentsByFileId: {
        readme: [{
          id: "comment",
          body: "x".repeat(10_001),
          createdAt: "2026-07-10T00:00:00.000Z",
        }],
      },
    })).toThrow("comment.body is too long");
  });
});
