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

const MemoDocumentWorkbench = memo(DocumentWorkbench);
const MemoLiveRoomLoadingSurface = memo(LiveRoomLoadingSurface);
const MemoWorkspaceEmptySurface = memo(WorkspaceEmptySurface);
const MemoWorkspaceMenuSurface = memo(WorkspaceMenuSurface);
const MemoWorkspaceOverlaySurface = memo(WorkspaceOverlaySurface);
const MemoWorkspaceTopChrome = memo(WorkspaceTopChrome);
const WorkspaceRightPanel = lazy(() => import("../../right-panel/WorkspaceRightPanel").then(
  ({ WorkspaceRightPanel: Component }) => ({ default: memo(Component) }),
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

  if (workspaceSession.localOpening) {
    return (
      <>
        <MemoWorkspaceOverlaySurface {...overlays.workspace} />
        <WorkspaceLoadingSurface />
      </>
    );
  }

  return (
    <main className="app-shell">
      <MemoWorkspaceOverlaySurface {...overlays.workspace} />
      <section className={chrome.mainPanelClassName}>
        <MemoWorkspaceMenuSurface {...chrome.menu} />

        <section className={documentRuntime.surface.centerWorkbenchClassName}>
          <MemoWorkspaceTopChrome {...chrome.top} />

          <section
            className={documentRuntime.surface.fileShellClassName}
            id={activeFile ? getWorkspaceTabPanelId(activeFile.id) : undefined}
            role={activeFile ? "tabpanel" : undefined}
            aria-labelledby={activeFile ? getWorkspaceTabId(activeFile.id) : undefined}
          >
            {collaboration.liveRoomOpenState === "opening" ? (
              <MemoLiveRoomLoadingSurface {...collaboration.loadingSurface} />
            ) : activeFile ? (
              <MemoDocumentWorkbench
                {...documentWorkbenchProps}
                activeFile={activeFile}
              />
            ) : (
              <MemoWorkspaceEmptySurface {...workspaceSession.emptySurface} />
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
