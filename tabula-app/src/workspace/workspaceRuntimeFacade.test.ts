import { describe, expect, it } from "vitest";
import {
  createWorkspaceRuntimeFacade,
  type CreateWorkspaceRuntimeFacadeOptions,
  type WorkspaceRuntimeFacade,
} from "./workspaceRuntimeFacade";

const createFacadeInput = ({
  activeFileTitle = "Plan.md",
  rightPanelOpen,
  splitViewOpen,
}: {
  activeFileTitle?: string;
  rightPanelOpen: boolean;
  splitViewOpen: boolean;
}): CreateWorkspaceRuntimeFacadeOptions => ({
  documentRuntime: {
    surface: {
      documentControls: {
        activeViewMode: splitViewOpen ? "split" : "visual",
      },
    },
    workbench: {
      activeFile: {
        id: "active-file",
        title: activeFileTitle,
      },
    },
  } as unknown as WorkspaceRuntimeFacade["documentRuntime"],
  workspaceSession: {
    emptySurface: {},
    localOpening: false,
  } as unknown as WorkspaceRuntimeFacade["workspaceSession"],
  chrome: {
    menu: {},
    top: {},
  } as unknown as CreateWorkspaceRuntimeFacadeOptions["chrome"],
  panels: {
    right: {
      isOpen: rightPanelOpen,
    },
  } as unknown as WorkspaceRuntimeFacade["panels"],
  overlays: {
    workspace: {},
  } as unknown as WorkspaceRuntimeFacade["overlays"],
  collaboration: {
    liveRoomOpenState: "idle",
    loadingSurface: {
      language: "en",
    },
  } as WorkspaceRuntimeFacade["collaboration"],
});

describe("createWorkspaceRuntimeFacade", () => {
  it("preserves domain ownership while deriving the workspace layout class", () => {
    const input = createFacadeInput({
      rightPanelOpen: true,
      splitViewOpen: true,
    });

    const facade = createWorkspaceRuntimeFacade(input);

    expect(facade.documentRuntime).toBe(input.documentRuntime);
    expect(facade.workspaceSession).toBe(input.workspaceSession);
    expect(facade.panels).toBe(input.panels);
    expect(facade.overlays).toBe(input.overlays);
    expect(facade.collaboration).toBe(input.collaboration);
    expect(facade.chrome.menu).toBe(input.chrome.menu);
    expect(facade.chrome.top).toBe(input.chrome.top);
    expect(facade.chrome.mainPanelClassName).toBe(
      "main-panel right-panel-open split-view-open",
    );
  });

  it("keeps the default layout class quiet when panels and split view are closed", () => {
    const facade = createWorkspaceRuntimeFacade(createFacadeInput({
      rightPanelOpen: false,
      splitViewOpen: false,
    }));

    expect(facade.chrome.mainPanelClassName).toBe("main-panel");
  });

  it("does not reserve split-view layout space for a bundle asset", () => {
    const facade = createWorkspaceRuntimeFacade(createFacadeInput({
      activeFileTitle: "query.sql",
      rightPanelOpen: true,
      splitViewOpen: true,
    }));

    expect(facade.chrome.mainPanelClassName).toBe("main-panel right-panel-open");
  });
});
