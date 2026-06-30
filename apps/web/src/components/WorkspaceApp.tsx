import { DocumentWorkbench } from "./DocumentWorkbench";
import { WorkspaceEmptySurface } from "./WorkspaceEmptySurface";
import { WorkspaceMenuSurface } from "./WorkspaceMenuSurface";
import { WorkspaceOverlaySurface } from "./WorkspaceOverlaySurface";
import { WorkspaceProjectContext } from "./WorkspaceProjectContext";
import { WorkspaceTopChrome } from "./WorkspaceTopChrome";
import { useWorkspaceRuntime } from "../hooks/useWorkspaceRuntime";

export function WorkspaceApp() {
  const {
    documentSurface,
    emptySurfaceProps,
    mainPanelClassName,
    menuSurfaceProps,
    overlayProps,
    projectContextProps,
    topChromeProps,
    workbenchProps,
  } = useWorkspaceRuntime();
  const { activeFile, ...documentWorkbenchProps } = workbenchProps;

  return (
    <main className="app-shell">
      <WorkspaceOverlaySurface {...overlayProps} />
      <section className={mainPanelClassName}>
        <WorkspaceMenuSurface {...menuSurfaceProps} />

        <section className={documentSurface.centerWorkbenchClassName}>
          <WorkspaceTopChrome {...topChromeProps} />

          <section className={documentSurface.fileShellClassName}>
            {activeFile ? (
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
