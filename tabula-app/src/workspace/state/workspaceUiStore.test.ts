import { beforeEach, describe, expect, it } from "vitest";
import {
  resetWorkspaceUiStoreForTests,
  selectCenterPopover,
  selectLauncherOpen,
  selectPreferencesOpen,
  selectSearchOpen,
  selectWorkspaceMenuOpen,
  useWorkspaceUiStore,
} from "./workspaceUiStore";

describe("workspace UI store", () => {
  beforeEach(() => {
    resetWorkspaceUiStoreForTests();
  });

  it("closes floating chrome without changing durable workspace data", () => {
    useWorkspaceUiStore.getState().setTopPopover("share");
    useWorkspaceUiStore.getState().setCenterPopover("view");
    useWorkspaceUiStore.getState().setWorkspaceMenuOpen(true);
    useWorkspaceUiStore.getState().setPreferencesOpen(true);
    useWorkspaceUiStore.getState().setLauncherOpen(true);

    useWorkspaceUiStore.getState().closeFloatingChrome();

    const state = useWorkspaceUiStore.getState();
    expect(state).toMatchObject({
      topPopover: null,
      documentSurface: null,
      workspaceSurface: null,
    });
    expect(selectCenterPopover(state)).toBeNull();
    expect(selectWorkspaceMenuOpen(state)).toBe(false);
    expect(selectPreferencesOpen(state)).toBe(false);
    expect(selectLauncherOpen(state)).toBe(false);
  });

  it("opens the launcher and closes conflicting floating chrome", () => {
    useWorkspaceUiStore.getState().setWorkspaceMenuOpen(true);
    useWorkspaceUiStore.getState().setPreferencesOpen(true);

    useWorkspaceUiStore.getState().setLauncherOpen(true);

    const state = useWorkspaceUiStore.getState();
    expect(state.workspaceSurface).toBe("launcher");
    expect(selectLauncherOpen(state)).toBe(true);
    expect(selectWorkspaceMenuOpen(state)).toBe(false);
    expect(selectPreferencesOpen(state)).toBe(false);
  });

  it("opens project files navigation as a single chrome action", () => {
    useWorkspaceUiStore.getState().setTopPopover("plus");
    useWorkspaceUiStore.getState().setWorkspaceMenuOpen(true);
    useWorkspaceUiStore.getState().setPreferencesOpen(true);
    useWorkspaceUiStore.getState().setRightPanelView("comments");

    useWorkspaceUiStore.getState().openFilesPanel();

    const state = useWorkspaceUiStore.getState();
    expect(state).toMatchObject({
      topPopover: null,
      documentSurface: null,
      workspaceSurface: null,
      leftPanelOpen: true,
      leftPanelView: "files",
      rightPanelOpen: false,
      rightPanelView: "comments",
    });
  });

  it("toggles workspace navigation independently", () => {
    useWorkspaceUiStore.getState().toggleLeftPanel("search");

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      leftPanelOpen: true,
      leftPanelView: "search",
    });

    useWorkspaceUiStore.getState().toggleLeftPanel("search");

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      leftPanelOpen: false,
      leftPanelView: "search",
    });
  });

  it("switches overlay panels in one transaction", () => {
    const store = useWorkspaceUiStore.getState();
    store.openSidePanel({ side: "left", view: "files" }, true);
    store.openSidePanel({ side: "right", view: "comments" }, true);

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      leftPanelOpen: false,
      leftPanelView: "files",
      rightPanelOpen: true,
      rightPanelView: "comments",
    });

    useWorkspaceUiStore.getState().toggleSidePanel(
      { side: "left", view: "search" },
      true,
    );

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      leftPanelOpen: true,
      leftPanelView: "search",
      rightPanelOpen: false,
      rightPanelView: "comments",
    });
  });

  it("opens Share and closes conflicting chrome", () => {
    useWorkspaceUiStore.getState().setCenterPopover("view");
    useWorkspaceUiStore.getState().setWorkspaceMenuOpen(true);

    useWorkspaceUiStore.getState().openSharePanel();

    const state = useWorkspaceUiStore.getState();
    expect(state).toMatchObject({
      topPopover: "share",
      documentSurface: null,
      workspaceSurface: null,
    });
  });

  it("opens and closes the workspace menu without changing the active left section", () => {
    useWorkspaceUiStore.getState().openSidePanel({ side: "left", view: "search" });

    useWorkspaceUiStore.getState().toggleWorkspaceMenu();
    expect(useWorkspaceUiStore.getState()).toMatchObject({
      leftPanelOpen: true,
      leftPanelView: "search",
      workspaceSurface: "menu",
    });

    useWorkspaceUiStore.getState().toggleWorkspaceMenu();
    expect(useWorkspaceUiStore.getState()).toMatchObject({
      leftPanelOpen: true,
      leftPanelView: "search",
      workspaceSurface: null,
    });
  });

  it("toggles right panel and clears floating chrome", () => {
    useWorkspaceUiStore.getState().setTopPopover("plus");
    useWorkspaceUiStore.getState().setCenterPopover("view");
    useWorkspaceUiStore.getState().setWorkspaceMenuOpen(true);
    useWorkspaceUiStore.getState().setPreferencesOpen(true);

    useWorkspaceUiStore.getState().toggleRightPanel();

    const state = useWorkspaceUiStore.getState();
    expect(state).toMatchObject({
      rightPanelOpen: true,
      rightPanelView: "metadata",
      topPopover: null,
      documentSurface: null,
      workspaceSurface: null,
    });
  });

  it("tracks search and split drag state as transient UI", () => {
    useWorkspaceUiStore.getState().toggleSearch();
    useWorkspaceUiStore.getState().setSplitDragging(true);

    expect(selectSearchOpen(useWorkspaceUiStore.getState())).toBe(true);
    expect(useWorkspaceUiStore.getState().splitDragging).toBe(true);

    useWorkspaceUiStore.getState().setSearchOpen((isOpen) => !isOpen);
    useWorkspaceUiStore.getState().setSplitDragging(false);

    expect(selectSearchOpen(useWorkspaceUiStore.getState())).toBe(false);
    expect(useWorkspaceUiStore.getState().splitDragging).toBe(false);
  });

  it("keeps persistent document search open while transient chrome changes", () => {
    useWorkspaceUiStore.getState().setWorkspaceMenuOpen(true);
    useWorkspaceUiStore.getState().setSearchOpen(true);

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      workspaceSurface: null,
      documentSurface: null,
      searchOpen: true,
      topPopover: null,
    });

    useWorkspaceUiStore.getState().setTopPopover("share");

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      workspaceSurface: null,
      documentSurface: null,
      searchOpen: true,
      topPopover: "share",
    });
  });
});
