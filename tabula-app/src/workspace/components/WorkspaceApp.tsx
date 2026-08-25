import { lazy, memo, Suspense, useEffect, useState } from "react";
import { LiveRoomLoadingSurface } from "./LiveRoomLoadingSurface";
import { WorkspaceEmptySurface } from "./WorkspaceEmptySurface";
import { WorkspaceImportInputs } from "./WorkspaceImportInputs";
import { WorkspaceOverlaySurface } from "./WorkspaceOverlaySurface";
import { WorkspaceTopChrome } from "./WorkspaceTopChrome";
import { WorkspaceLoadingSurface } from "./WorkspaceLoadingSurface";
import { useWorkspaceRuntime } from "../useWorkspaceRuntime";
import { getWorkspaceTabId, getWorkspaceTabPanelId } from "../workspaceA11yIds";

const MemoWorkspaceTopChrome = memo(WorkspaceTopChrome);
const DocumentWorkbench = lazy(() => import("../../document/DocumentWorkbench").then(
  ({ DocumentWorkbench: Component }) => ({ default: Component }),
));
const WorkspaceMenuSurface = lazy(() => import("./WorkspaceMenuSurface").then(
  ({ WorkspaceMenuSurface: Component }) => ({ default: memo(Component) }),
));
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
  const [workspaceMenuMounted, setWorkspaceMenuMounted] = useState(false);

  useEffect(() => {
    if (chrome.menu.isOpen) setWorkspaceMenuMounted(true);
  }, [chrome.menu.isOpen]);

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
      <section className={chrome.mainPanelClassName}>
        <WorkspaceImportInputs
          importInputRef={chrome.menu.importInputRef}
          workspaceImportInputRef={chrome.menu.workspaceImportInputRef}
          language={chrome.menu.language}
          onImportFileChange={chrome.menu.onImportFileChange}
          onImportWorkspaceChange={chrome.menu.onImportWorkspaceChange}
        />
        {(workspaceMenuMounted || chrome.menu.isOpen) && (
          <Suspense fallback={null}>
            <WorkspaceMenuSurface {...chrome.menu} />
          </Suspense>
        )}

        <Suspense fallback={null}>
          <WorkspaceLeftPanel {...panels.left} />
        </Suspense>

        <section className={documentRuntime.surface.centerWorkbenchClassName}>
          <MemoWorkspaceTopChrome {...chrome.top} />

          <section
            className={documentRuntime.surface.fileShellClassName}
            id={activeFile ? getWorkspaceTabPanelId(activeFile.id) : undefined}
            role={activeFile ? "tabpanel" : undefined}
            aria-labelledby={activeFile ? getWorkspaceTabId(activeFile.id) : undefined}
          >
            {collaboration.liveRoomOpenState === "opening" ? (
              <LiveRoomLoadingSurface {...collaboration.loadingSurface} />
            ) : activeFile ? (
              <Suspense
                fallback={<section className="workspace" aria-busy="true" />}
              >
                <DocumentWorkbench
                  {...documentWorkbenchProps}
                  activeFile={activeFile}
                />
              </Suspense>
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
