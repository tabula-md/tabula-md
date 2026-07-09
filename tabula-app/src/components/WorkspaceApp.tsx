import { DocumentWorkbench } from "./DocumentWorkbench";
import { LiveRoomLoadingSurface } from "./LiveRoomLoadingSurface";
import { WorkspaceEmptySurface } from "./WorkspaceEmptySurface";
import { WorkspaceMenuSurface } from "./WorkspaceMenuSurface";
import { WorkspaceOverlaySurface } from "./WorkspaceOverlaySurface";
import { WorkspaceProjectContext } from "./WorkspaceProjectContext";
import { WorkspaceTopChrome } from "./WorkspaceTopChrome";
import { useWorkspaceRuntime } from "../hooks/useWorkspaceRuntime";
import { isEmptyGeneratedLivePlaceholder } from "../workspaceStorage";

export function WorkspaceApp() {
  const {
    documentSurface,
    emptySurfaceProps,
    liveRoomLoadingProps,
    liveRoomOpenState,
    mainPanelClassName,
    menuSurfaceProps,
    overlayProps,
    projectContextProps,
    topChromeProps,
    workbenchProps,
  } = useWorkspaceRuntime();
  const { activeFile, ...documentWorkbenchProps } = workbenchProps;
  const activeFileIsLivePlaceholder = Boolean(activeFile && isEmptyGeneratedLivePlaceholder(activeFile));
  const liveRoomSurfaceState =
    activeFileIsLivePlaceholder || liveRoomOpenState !== "unavailable"
      ? "opening"
      : "unavailable";

  return (
    <main className="app-shell">
      <WorkspaceOverlaySurface {...overlayProps} />
      <section className={mainPanelClassName}>
        <WorkspaceMenuSurface {...menuSurfaceProps} />

        <section className={documentSurface.centerWorkbenchClassName}>
          <WorkspaceTopChrome {...topChromeProps} />

          <section className={documentSurface.fileShellClassName}>
            {liveRoomOpenState !== "idle" || activeFileIsLivePlaceholder ? (
              <LiveRoomLoadingSurface
                state={liveRoomSurfaceState}
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

        <WorkspaceProjectContext {...projectContextProps} />
      </section>
    </main>
  );
}
