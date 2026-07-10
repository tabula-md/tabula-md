import { DocumentWorkbench } from "./DocumentWorkbench";
import { LiveRoomLoadingSurface } from "./LiveRoomLoadingSurface";
import { WorkspaceEmptySurface } from "./WorkspaceEmptySurface";
import { WorkspaceMenuSurface } from "./WorkspaceMenuSurface";
import { WorkspaceOverlaySurface } from "./WorkspaceOverlaySurface";
import { WorkspaceProjectContext } from "./WorkspaceProjectContext";
import { WorkspaceTopChrome } from "./WorkspaceTopChrome";
import { useWorkspaceRuntime } from "../hooks/useWorkspaceRuntime";
import { isEmptyGeneratedLivePlaceholder } from "../workspaceStorage";
import { getWorkspaceTabId, getWorkspaceTabPanelId } from "../workspaceA11yIds";

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
    liveRoomOpenState === "idle" && activeFileIsLivePlaceholder
      ? "opening"
      : liveRoomOpenState;

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
            {liveRoomOpenState !== "idle" || activeFileIsLivePlaceholder ? (
              <LiveRoomLoadingSurface
                state={liveRoomSurfaceState === "idle" ? "opening" : liveRoomSurfaceState}
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
