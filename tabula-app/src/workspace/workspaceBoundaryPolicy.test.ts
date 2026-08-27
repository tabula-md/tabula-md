import { describe, expect, it } from "vitest";
import {
  getWorkspaceBoundaryCapabilities,
  resolveWorkspaceAuthority,
} from "./workspaceBoundaryPolicy";

describe("workspace boundary policy", () => {
  it("allows clearing a standalone browser workspace", () => {
    const authority = resolveWorkspaceAuthority({
      hasActiveRoom: false,
      hasLiveFolderBinding: false,
    });
    expect(authority).toEqual({ kind: "browser" });
    expect(getWorkspaceBoundaryCapabilities(authority)).toEqual({
      canUseLocalWorkspaceActions: true,
      canClearBrowserWorkspace: true,
      mustDisconnectFolderBeforeClearing: false,
    });
  });

  it("requires an explicit folder disconnect before clearing", () => {
    const authority = resolveWorkspaceAuthority({
      hasActiveRoom: false,
      hasLiveFolderBinding: true,
    });
    expect(authority).toEqual({ kind: "folder" });
    expect(getWorkspaceBoundaryCapabilities(authority)).toEqual({
      canUseLocalWorkspaceActions: true,
      canClearBrowserWorkspace: false,
      mustDisconnectFolderBeforeClearing: true,
    });
  });

  it("suspends local boundary actions inside a live room", () => {
    const authority = resolveWorkspaceAuthority({
      hasActiveRoom: true,
      hasLiveFolderBinding: true,
    });
    expect(authority).toEqual({ kind: "live" });
    expect(getWorkspaceBoundaryCapabilities(authority)).toEqual({
      canUseLocalWorkspaceActions: false,
      canClearBrowserWorkspace: false,
      mustDisconnectFolderBeforeClearing: false,
    });
  });
});
