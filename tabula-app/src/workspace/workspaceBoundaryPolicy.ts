export type WorkspaceBoundaryCapabilities = {
  canUseLocalWorkspaceActions: boolean;
  canClearBrowserWorkspace: boolean;
  mustDisconnectFolderBeforeClearing: boolean;
};

export function getWorkspaceBoundaryCapabilities({
  hasActiveRoom,
  hasLiveFolderBinding,
}: {
  hasActiveRoom: boolean;
  hasLiveFolderBinding: boolean;
}): WorkspaceBoundaryCapabilities {
  const canUseLocalWorkspaceActions = !hasActiveRoom;
  const mustDisconnectFolderBeforeClearing =
    canUseLocalWorkspaceActions && hasLiveFolderBinding;

  return {
    canUseLocalWorkspaceActions,
    canClearBrowserWorkspace:
      canUseLocalWorkspaceActions && !hasLiveFolderBinding,
    mustDisconnectFolderBeforeClearing,
  };
}
