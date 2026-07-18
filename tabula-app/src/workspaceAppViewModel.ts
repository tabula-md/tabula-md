import type { DocumentSurfaceModel } from "@tabula-md/tabula";
import type { DocumentWorkbenchProps } from "./components/DocumentWorkbench";
import type { WorkspaceEmptySurfaceProps } from "./components/WorkspaceEmptySurface";
import type { WorkspaceMenuSurfaceProps } from "./components/WorkspaceMenuSurface";
import type { WorkspaceOverlaySurfaceProps } from "./components/WorkspaceOverlaySurface";
import type { WorkspaceSidePanelProps } from "./components/WorkspaceSidePanel";
import type { WorkspaceTopChromeProps } from "./components/WorkspaceTopChrome";
import type { LiveRoomOpenState } from "./liveRoomOpenState";
import type { WorkspaceFile } from "./workspaceStorage";
import type { WorkspaceLanguage } from "./hooks/useWorkspacePreferences";

export type WorkspaceAppWorkbenchProps = Omit<
  DocumentWorkbenchProps,
  "activeFile"
> & {
  activeFile?: WorkspaceFile;
};

export type WorkspaceAppViewModel = {
  activeFile?: WorkspaceFile;
  documentSurface: DocumentSurfaceModel;
  emptySurfaceProps: WorkspaceEmptySurfaceProps;
  liveRoomOpenState: LiveRoomOpenState;
  liveRoomLoadingProps: {
    language: WorkspaceLanguage;
    onOpenLocalWorkspace: () => void;
    onRetry: () => void;
  };
  localWorkspaceOpening: boolean;
  mainPanelClassName: string;
  menuSurfaceProps: WorkspaceMenuSurfaceProps;
  overlayProps: WorkspaceOverlaySurfaceProps;
  sidePanelProps: WorkspaceSidePanelProps;
  topChromeProps: WorkspaceTopChromeProps;
  workbenchProps: WorkspaceAppWorkbenchProps;
};

type CreateWorkspaceAppViewModelOptions = Omit<
  WorkspaceAppViewModel,
  "mainPanelClassName"
> & {
  rightPanelOpen: boolean;
};

export function createWorkspaceAppViewModel({
  rightPanelOpen,
  ...view
}: CreateWorkspaceAppViewModelOptions): WorkspaceAppViewModel {
  const splitViewOpen = view.documentSurface.documentControls.activeViewMode === "split";

  return {
    ...view,
    mainPanelClassName: [
      "main-panel",
      rightPanelOpen && "right-panel-open",
      splitViewOpen && "split-view-open",
    ].filter(Boolean).join(" "),
  };
}
