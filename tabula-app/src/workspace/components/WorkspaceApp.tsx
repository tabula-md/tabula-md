import { lazy, memo, Suspense } from "react";
import { DocumentWorkbench } from "../../document/DocumentWorkbench";
import { LiveRoomLoadingSurface } from "./LiveRoomLoadingSurface";
import { WorkspaceEmptySurface } from "./WorkspaceEmptySurface";
import { WorkspaceMenuSurface } from "./WorkspaceMenuSurface";
import { WorkspaceOverlaySurface } from "./WorkspaceOverlaySurface";
import { WorkspaceTopChrome } from "./WorkspaceTopChrome";
import { WorkspaceLoadingSurface } from "./WorkspaceLoadingSurface";
import { useWorkspaceRuntime } from "../useWorkspaceRuntime";
import { getWorkspaceTabId, getWorkspaceTabPanelId } from "../workspaceA11yIds";
import { getWorkspaceFilePresentation } from "../workspaceFilePresentation";
import { WorkspaceAssetViewer } from "./WorkspaceAssetViewer";
import { WorkspaceSearchModal } from "./WorkspaceSearchModal";

const MemoWorkspaceMenuSurface = memo(WorkspaceMenuSurface);
const MemoWorkspaceTopChrome = memo(WorkspaceTopChrome);
const WorkspaceRightPanel = lazy(() => import("../../right-panel/WorkspaceRightPanel").then(
  ({ WorkspaceRightPanel: Component }) => ({ default: memo(Component) }),
));
const WorkspaceLeftPanel = lazy(() => import("../../left-panel/WorkspaceLeftPanel").then(
  ({ WorkspaceLeftPanel: Component }) => ({ default: memo(Component) }),
));

export function WorkspaceApp() {
  const {
    collaboration,
    chrome,
    documentRuntime,
    overlays,
    panels,
    workspaceSession,
  } = useWorkspaceRuntime();
  const { activeFile, ...documentWorkbenchProps } = documentRuntime.workbench;
  const activeFilePresentation = activeFile
    ? getWorkspaceFilePresentation(activeFile)
    : undefined;
  const assetOpen = activeFilePresentation?.kind === "asset";

  if (workspaceSession.localOpening) {
    return (
      <>
        <WorkspaceOverlaySurface {...overlays.workspace} />
        <WorkspaceLoadingSurface />
      </>
    );
  }

  return (
    <main className="app-shell">
      <WorkspaceOverlaySurface {...overlays.workspace} />
      <WorkspaceSearchModal {...panels.search} />
      <section className={chrome.mainPanelClassName}>
        <MemoWorkspaceMenuSurface {...chrome.menu} />

        <Suspense fallback={null}>
          <WorkspaceLeftPanel {...panels.left} />
        </Suspense>

        <section className={documentRuntime.surface.centerWorkbenchClassName}>
          <MemoWorkspaceTopChrome {...chrome.top} />

          <section
            className={`${documentRuntime.surface.fileShellClassName}${
              assetOpen ? " asset-file-shell" : ""
            }`}
            id={activeFile ? getWorkspaceTabPanelId(activeFile.id) : undefined}
            role={activeFile ? "tabpanel" : undefined}
            aria-labelledby={activeFile ? getWorkspaceTabId(activeFile.id) : undefined}
          >
            {collaboration.liveRoomOpenState === "opening" ? (
              <LiveRoomLoadingSurface {...collaboration.loadingSurface} />
            ) : activeFile ? (
              assetOpen ? (
                <WorkspaceAssetViewer
                  file={activeFile}
                  language={documentWorkbenchProps.language}
                />
              ) : (
                <DocumentWorkbench
                  {...documentWorkbenchProps}
                  activeFile={activeFile}
                />
              )
            ) : (
              <WorkspaceEmptySurface {...workspaceSession.emptySurface} />
            )}
          </section>
        </section>

        <Suspense fallback={null}>
          <WorkspaceRightPanel {...panels.right} />
        </Suspense>
      </section>
    </main>
  );
}
