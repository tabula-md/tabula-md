import { describe, expect, it } from "vitest";
import { buildFileTree, flattenVisibleFileTree } from "./RightPanelFiles";
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
});
