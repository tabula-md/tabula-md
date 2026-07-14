import { describe, expect, it } from "vitest";
import {
  buildFileTree,
  flattenVisibleFileTree,
  pruneEmptyFileTreeFolders,
} from "./RightPanelFiles";
import { WORKSPACE_ROOT_FOLDER_ID, createWorkspaceFile, createWorkspaceRootFolder } from "../workspaceStorage";

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
      [WORKSPACE_ROOT_FOLDER_ID, 0],
      ["docs", 1],
      [nestedFile.id, 2],
      [rootFile.id, 1],
    ]);
    expect(flattenVisibleFileTree(tree, new Set(["docs"])).map(({ node }) => node.id)).toEqual([
      WORKSPACE_ROOT_FOLDER_ID,
      "docs",
      rootFile.id,
    ]);
  });

  it("keeps only matching file ancestors while search results are expanded", () => {
    const matchingFile = createWorkspaceFile(1, { title: "Plan", parentId: "planning" });
    const tree = buildFileTree(
      [matchingFile],
      [
        createWorkspaceRootFolder(),
        { id: "planning", title: "Planning", parentId: WORKSPACE_ROOT_FOLDER_ID },
        { id: "empty", title: "Empty", parentId: WORKSPACE_ROOT_FOLDER_ID },
      ],
    );
    const prunedTree = pruneEmptyFileTreeFolders(tree);

    expect(flattenVisibleFileTree(prunedTree, new Set()).map(({ node }) => node.id)).toEqual([
      WORKSPACE_ROOT_FOLDER_ID,
      "planning",
      matchingFile.id,
    ]);
  });
});
