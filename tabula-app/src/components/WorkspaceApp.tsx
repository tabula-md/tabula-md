import { DocumentWorkbench } from "../document/DocumentWorkbench";
import { LiveRoomLoadingSurface } from "./LiveRoomLoadingSurface";
import { WorkspaceEmptySurface } from "./WorkspaceEmptySurface";
import { WorkspaceMenuSurface } from "./WorkspaceMenuSurface";
import { WorkspaceOverlaySurface } from "./WorkspaceOverlaySurface";
import { WorkspaceRightPanel } from "../right-panel/WorkspaceRightPanel";
import { WorkspaceTopChrome } from "./WorkspaceTopChrome";
import { WorkspaceLoadingSurface } from "./WorkspaceLoadingSurface";
import { useWorkspaceRuntime } from "../hooks/useWorkspaceRuntime";
import { getWorkspaceTabId, getWorkspaceTabPanelId } from "../workspaceA11yIds";

export function WorkspaceApp() {
  const {
    documentSurface,
    emptySurfaceProps,
    liveRoomLoadingProps,
    liveRoomOpenState,
    localWorkspaceOpening,
    mainPanelClassName,
    menuSurfaceProps,
    overlayProps,
    rightPanelProps,
    topChromeProps,
    workbenchProps,
  } = useWorkspaceRuntime();
  const { activeFile, ...documentWorkbenchProps } = workbenchProps;

  if (localWorkspaceOpening) return <WorkspaceLoadingSurface />;

  return (
    <main className="app-shell">
      <WorkspaceOverlaySurface {...overlayProps} />
      <section className={mainPanelClassName}>
        <WorkspaceMenuSurface {...menuSurfaceProps} />

        <section className={documentSurface.centerWorkbenchClassName}>
          <WorkspaceTopChrome {...topChromeProps} />

          <section
            className={documentSurface.fileShellClassName}
            id={activeFile ? getWorkspaceTabPanelId(activeFile.id) : undefined}
            role={activeFile ? "tabpanel" : undefined}
            aria-labelledby={activeFile ? getWorkspaceTabId(activeFile.id) : undefined}
          >
            {liveRoomOpenState !== "idle" ? (
              <LiveRoomLoadingSurface
                state={liveRoomOpenState}
                {...liveRoomLoadingProps}
              />
            ) : activeFile ? (
              <DocumentWorkbench
                {...documentWorkbenchProps}
                activeFile={activeFile}
              />
            ) : (
              <WorkspaceEmptySurface {...emptySurfaceProps} />
            )}
          </section>
        </section>

        <WorkspaceRightPanel {...rightPanelProps} />
      </section>
    </main>
  );
}
