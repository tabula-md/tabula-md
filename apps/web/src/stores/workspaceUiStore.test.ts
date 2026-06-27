import { beforeEach, describe, expect, it } from "vitest";
import {
  resetWorkspaceUiStoreForTests,
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
    useWorkspaceUiStore.getState().setSharePanelTarget("publish");

    useWorkspaceUiStore.getState().closeFloatingChrome();

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      topPopover: null,
      centerPopover: null,
      workspaceMenuOpen: false,
      preferencesOpen: false,
      sharePanelTarget: undefined,
    });
  });

  it("opens project files panel as a single chrome action", () => {
    useWorkspaceUiStore.getState().setTopPopover("plus");
    useWorkspaceUiStore.getState().setWorkspaceMenuOpen(true);
    useWorkspaceUiStore.getState().setPreferencesOpen(true);
    useWorkspaceUiStore.getState().setRightPanelView("comments");

    useWorkspaceUiStore.getState().openFilesPanel();

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      topPopover: null,
      centerPopover: null,
      workspaceMenuOpen: false,
      preferencesOpen: false,
      rightPanelOpen: true,
      rightPanelView: "files",
    });
  });

  it("opens the requested share panel and closes conflicting chrome", () => {
    useWorkspaceUiStore.getState().setCenterPopover("view");
    useWorkspaceUiStore.getState().setWorkspaceMenuOpen(true);

    useWorkspaceUiStore.getState().openSharePanel("share-link");

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      topPopover: "share",
      centerPopover: null,
      workspaceMenuOpen: false,
      sharePanelTarget: "share-link",
    });
  });

  it("toggles right panel and clears floating chrome", () => {
    useWorkspaceUiStore.getState().setTopPopover("plus");
    useWorkspaceUiStore.getState().setCenterPopover("view");
    useWorkspaceUiStore.getState().setWorkspaceMenuOpen(true);
    useWorkspaceUiStore.getState().setPreferencesOpen(true);

    useWorkspaceUiStore.getState().toggleRightPanel();

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      rightPanelOpen: true,
      topPopover: null,
      centerPopover: null,
      workspaceMenuOpen: false,
      preferencesOpen: false,
    });
  });

  it("tracks search and split drag state as transient UI", () => {
    useWorkspaceUiStore.getState().toggleSearch();
    useWorkspaceUiStore.getState().setSplitDragging(true);

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      searchOpen: true,
      splitDragging: true,
    });

    useWorkspaceUiStore.getState().setSearchOpen((isOpen) => !isOpen);
    useWorkspaceUiStore.getState().setSplitDragging(false);

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      searchOpen: false,
      splitDragging: false,
    });
  });
});
