export type WorkspaceBoundaryCapabilities = {
  canUseLocalWorkspaceActions: boolean;
  canClearBrowserWorkspace: boolean;
  mustDisconnectFolderBeforeClearing: boolean;
};

/**
 * The single authority that currently accepts workspace writes.
 *
 * Browser persistence remains a recovery layer for folder work, while a live
 * room temporarily owns writes and suspends local-folder synchronization.
 */
export type WorkspaceAuthority =
  | { kind: "browser" }
  | { kind: "folder" }
  | { kind: "live" };

export function resolveWorkspaceAuthority({
  hasActiveRoom,
  hasLiveFolderBinding,
}: {
  hasActiveRoom: boolean;
  hasLiveFolderBinding: boolean;
}): WorkspaceAuthority {
  if (hasActiveRoom) return { kind: "live" };
  if (hasLiveFolderBinding) return { kind: "folder" };
  return { kind: "browser" };
}

export function getWorkspaceBoundaryCapabilities(
  authority: WorkspaceAuthority,
): WorkspaceBoundaryCapabilities {
  const canUseLocalWorkspaceActions = authority.kind !== "live";
  const mustDisconnectFolderBeforeClearing =
    authority.kind === "folder";

  return {
    canUseLocalWorkspaceActions,
    canClearBrowserWorkspace:
      authority.kind === "browser",
    mustDisconnectFolderBeforeClearing,
  };
}
