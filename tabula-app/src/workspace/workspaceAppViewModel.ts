import type { DocumentSurfaceModel } from "@tabula-md/tabula";
import type { DocumentWorkbenchProps } from "../document/DocumentWorkbench";
import type { WorkspaceEmptySurfaceProps } from "./components/WorkspaceEmptySurface";
import type { WorkspaceMenuSurfaceProps } from "./components/WorkspaceMenuSurface";
import type { WorkspaceOverlaySurfaceProps } from "./components/WorkspaceOverlaySurface";
import type { WorkspaceRightPanelProps } from "../right-panel/WorkspaceRightPanel";
import type { WorkspaceTopChromeProps } from "./components/WorkspaceTopChrome";
import type { LiveRoomOpenState } from "../collaboration/liveRoomOpenState";
import type { WorkspaceFile } from "./workspaceStorage";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";

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
  };
  localWorkspaceOpening: boolean;
  mainPanelClassName: string;
  menuSurfaceProps: WorkspaceMenuSurfaceProps;
  overlayProps: WorkspaceOverlaySurfaceProps;
  rightPanelProps: WorkspaceRightPanelProps;
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
