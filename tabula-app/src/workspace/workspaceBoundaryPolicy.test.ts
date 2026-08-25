import { describe, expect, it } from "vitest";
import { getWorkspaceBoundaryCapabilities } from "./workspaceBoundaryPolicy";

describe("workspace boundary policy", () => {
  it("allows clearing a standalone browser workspace", () => {
    expect(getWorkspaceBoundaryCapabilities({
      hasActiveRoom: false,
      hasLiveFolderBinding: false,
    })).toEqual({
      canUseLocalWorkspaceActions: true,
      canClearBrowserWorkspace: true,
      mustDisconnectFolderBeforeClearing: false,
    });
  });

  it("requires an explicit folder disconnect before clearing", () => {
    expect(getWorkspaceBoundaryCapabilities({
      hasActiveRoom: false,
      hasLiveFolderBinding: true,
    })).toEqual({
      canUseLocalWorkspaceActions: true,
      canClearBrowserWorkspace: false,
      mustDisconnectFolderBeforeClearing: true,
    });
  });

  it("suspends local boundary actions inside a live room", () => {
    expect(getWorkspaceBoundaryCapabilities({
      hasActiveRoom: true,
      hasLiveFolderBinding: true,
    })).toEqual({
      canUseLocalWorkspaceActions: false,
      canClearBrowserWorkspace: false,
      mustDisconnectFolderBeforeClearing: false,
    });
  });
});
