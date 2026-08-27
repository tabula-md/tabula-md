import { useSyncExternalStore } from "react";

export const WORKSPACE_COMPACT_MAX_WIDTH = 1160;
export const WORKSPACE_NARROW_MAX_WIDTH = 560;

export type WorkspaceShellSize = "wide" | "compact" | "narrow";

export const getWorkspaceShellSize = (viewportWidth: number): WorkspaceShellSize => {
  if (viewportWidth <= WORKSPACE_NARROW_MAX_WIDTH) return "narrow";
  if (viewportWidth <= WORKSPACE_COMPACT_MAX_WIDTH) return "compact";
  return "wide";
};

const subscribeToViewport = (onStoreChange: () => void) => {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
};

const getViewportSnapshot = (): WorkspaceShellSize => getWorkspaceShellSize(window.innerWidth);

export const useWorkspaceShellSize = () => useSyncExternalStore(
  subscribeToViewport,
  getViewportSnapshot,
  (): WorkspaceShellSize => "wide",
);

export const workspaceShellUsesOverlayPanels = (size: WorkspaceShellSize) =>
  size === "narrow";

export const workspaceShellUsesExclusivePanels = (size: WorkspaceShellSize) =>
  size !== "wide";
