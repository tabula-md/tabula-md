import { describe, expect, it } from "vitest";
import {
  buildFileTree,
  flattenVisibleFileTree,
  getValidDropFolderIds,
} from "./fileTreeModel";
import { WORKSPACE_ROOT_FOLDER_ID, createWorkspaceFile, createWorkspaceRootFolder } from "../workspace/workspaceStorage";

describe("right panel file rows", () => {
  it("flattens only expanded tree branches into virtual rows", () => {
    const rootFile = createWorkspaceFile(1, { title: "Root", parentId: WORKSPACE_ROOT_FOLDER_ID });
    const nestedFile = createWorkspaceFile(2, { title: "Nested", parentId: "docs" });
    const tree = buildFileTree(
      [rootFile, nestedFile],
      [
        createWorkspaceRootFolder(),
        { id: "docs", title: "Docs", parentId: WORKSPACE_ROOT_FOLDER_ID },
      ],
    );

    expect(flattenVisibleFileTree(tree, new Set()).map(({ node, depth }) => [node.id, depth])).toEqual([
      ["docs", 0],
      [nestedFile.id, 1],
      [rootFile.id, 0],
    ]);
    expect(flattenVisibleFileTree(tree, new Set(["docs"])).map(({ node }) => node.id)).toEqual([
      "docs",
      rootFile.id,
    ]);
  });

  it("allows drag-and-drop only into folders outside the current branch", () => {
    const folders = [
      createWorkspaceRootFolder(),
      { id: "docs", title: "Docs", parentId: WORKSPACE_ROOT_FOLDER_ID },
      { id: "drafts", title: "Drafts", parentId: "docs" },
      { id: "archive", title: "Archive", parentId: WORKSPACE_ROOT_FOLDER_ID },
    ];

    expect([...getValidDropFolderIds(folders, {
      type: "folder",
      id: "docs",
      title: "Docs",
      parentId: WORKSPACE_ROOT_FOLDER_ID,
    })]).toEqual(["archive"]);
  });
});
