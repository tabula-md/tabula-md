import type { DocumentSurfaceModel } from "@tabula-md/tabula";
import type { DocumentWorkbenchProps } from "./components/DocumentWorkbench";
import type { WorkspaceEmptySurfaceProps } from "./components/WorkspaceEmptySurface";
import type { WorkspaceMenuSurfaceProps } from "./components/WorkspaceMenuSurface";
import type { WorkspaceOverlaySurfaceProps } from "./components/WorkspaceOverlaySurface";
import type { WorkspaceProjectContextProps } from "./components/WorkspaceProjectContext";
import type { WorkspaceTopChromeProps } from "./components/WorkspaceTopChrome";
import type { WorkspaceFile } from "./workspaceStorage";

export type WorkspaceRuntimeWorkbenchProps = Omit<
  DocumentWorkbenchProps,
  "activeFile"
> & {
  activeFile?: WorkspaceFile;
};

export type WorkspaceRuntimeView = {
  activeFile?: WorkspaceFile;
  documentSurface: DocumentSurfaceModel;
  emptySurfaceProps: WorkspaceEmptySurfaceProps;
  mainPanelClassName: string;
  menuSurfaceProps: WorkspaceMenuSurfaceProps;
  overlayProps: WorkspaceOverlaySurfaceProps;
  projectContextProps: WorkspaceProjectContextProps;
  topChromeProps: WorkspaceTopChromeProps;
  workbenchProps: WorkspaceRuntimeWorkbenchProps;
};

type CreateWorkspaceRuntimeViewOptions = Omit<
  WorkspaceRuntimeView,
  "mainPanelClassName"
> & {
  rightPanelOpen: boolean;
};

export function createWorkspaceRuntimeView({
  rightPanelOpen,
  ...view
}: CreateWorkspaceRuntimeViewOptions): WorkspaceRuntimeView {
  return {
    ...view,
    mainPanelClassName: `main-panel ${rightPanelOpen ? "right-panel-open" : ""}`,
  };
}
