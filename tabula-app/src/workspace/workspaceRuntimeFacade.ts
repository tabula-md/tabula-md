import type { DocumentSurfaceModel } from "@tabula-md/tabula";
import type { DocumentWorkbenchProps } from "../document/DocumentWorkbench";
import type { LiveRoomOpenState } from "../collaboration/liveRoomOpenState";
import type { WorkspaceRightPanelProps } from "../right-panel/WorkspaceRightPanel";
import type { WorkspaceLeftPanelProps } from "../left-panel/WorkspaceLeftPanel";
import type { WorkspaceSearchModalProps } from "./components/WorkspaceSearchModal";
import type { WorkspaceEmptySurfaceProps } from "./components/WorkspaceEmptySurface";
import type { WorkspaceMenuSurfaceProps } from "./components/WorkspaceMenuSurface";
import type { WorkspaceOverlaySurfaceProps } from "./components/WorkspaceOverlaySurface";
import type { WorkspaceTopChromeProps } from "./components/WorkspaceTopChrome";
import type { WorkspaceFile } from "./workspaceStorage";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";
import { isWorkspaceMarkdownFile } from "./workspaceFilePresentation";

export type WorkspaceAppWorkbenchProps = Omit<
  DocumentWorkbenchProps,
  "activeFile"
> & {
  activeFile?: WorkspaceFile;
};

export type WorkspaceRuntimeFacade = {
  documentRuntime: {
    surface: DocumentSurfaceModel;
    workbench: WorkspaceAppWorkbenchProps;
  };
  workspaceSession: {
    emptySurface: WorkspaceEmptySurfaceProps;
    localOpening: boolean;
  };
  chrome: {
    mainPanelClassName: string;
    menu: WorkspaceMenuSurfaceProps;
    top: WorkspaceTopChromeProps;
  };
  panels: {
    left: WorkspaceLeftPanelProps;
    right: WorkspaceRightPanelProps;
    search: WorkspaceSearchModalProps;
  };
  overlays: {
    workspace: WorkspaceOverlaySurfaceProps;
  };
  collaboration: {
    liveRoomOpenState: LiveRoomOpenState;
    loadingSurface: {
      language: WorkspaceLanguage;
    };
  };
};

export type CreateWorkspaceRuntimeFacadeOptions = Omit<
  WorkspaceRuntimeFacade,
  "chrome"
> & {
  chrome: Omit<WorkspaceRuntimeFacade["chrome"], "mainPanelClassName">;
};

export function createWorkspaceRuntimeFacade({
  chrome,
  ...runtime
}: CreateWorkspaceRuntimeFacadeOptions): WorkspaceRuntimeFacade {
  const splitViewOpen =
    isWorkspaceMarkdownFile(runtime.documentRuntime.workbench.activeFile) &&
    runtime.documentRuntime.surface.documentControls.activeViewMode === "split";

  return {
    ...runtime,
    chrome: {
      ...chrome,
      mainPanelClassName: [
        "main-panel",
        runtime.panels.left.isOpen && "left-panel-open",
        runtime.panels.right.isOpen && "right-panel-open",
        splitViewOpen && "split-view-open",
      ].filter(Boolean).join(" "),
    },
  };
}
