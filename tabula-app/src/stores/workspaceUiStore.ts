import { create } from "zustand";
import type { CenterPopover, RightPanelView, SharePanel, TopPopover } from "../uiTypes";

type UiValueUpdater<T> = T | ((currentValue: T) => T);

const applyUiValueUpdater = <T>(value: T, update: UiValueUpdater<T>) =>
  typeof update === "function" ? (update as (currentValue: T) => T)(value) : update;

type WorkspaceUiStoreState = {
  topPopover: TopPopover;
  centerPopover: CenterPopover;
  rightPanelOpen: boolean;
  rightPanelView: RightPanelView;
  workspaceMenuOpen: boolean;
  preferencesOpen: boolean;
  searchOpen: boolean;
  splitDragging: boolean;
  sharePanelTarget?: SharePanel;
};

type WorkspaceUiStoreActions = {
  closeFloatingChrome: () => void;
  closePreferences: () => void;
  closeSharePanel: () => void;
  openFilesPanel: () => void;
  openSharePanel: (panel?: SharePanel) => void;
  setCenterPopover: (popover: UiValueUpdater<CenterPopover>) => void;
  setPreferencesOpen: (isOpen: UiValueUpdater<boolean>) => void;
  setRightPanelOpen: (isOpen: UiValueUpdater<boolean>) => void;
  setRightPanelView: (view: RightPanelView) => void;
  setSearchOpen: (isOpen: UiValueUpdater<boolean>) => void;
  setSharePanelTarget: (panel: SharePanel | undefined) => void;
  setSplitDragging: (isDragging: boolean) => void;
  setTopPopover: (popover: UiValueUpdater<TopPopover>) => void;
  setWorkspaceMenuOpen: (isOpen: UiValueUpdater<boolean>) => void;
  togglePreferences: () => void;
  toggleRightPanel: () => void;
  toggleSearch: () => void;
  toggleWorkspaceMenu: () => void;
};

export type WorkspaceUiStore = WorkspaceUiStoreState & WorkspaceUiStoreActions;

const DEFAULT_WORKSPACE_UI_STORE_STATE: WorkspaceUiStoreState = {
  topPopover: null,
  centerPopover: null,
  rightPanelOpen: false,
  rightPanelView: "files",
  workspaceMenuOpen: false,
  preferencesOpen: false,
  searchOpen: false,
  splitDragging: false,
  sharePanelTarget: undefined,
};

export const useWorkspaceUiStore = create<WorkspaceUiStore>()((set) => ({
  ...DEFAULT_WORKSPACE_UI_STORE_STATE,

  closeFloatingChrome: () => {
    set({
      topPopover: null,
      centerPopover: null,
      preferencesOpen: false,
      workspaceMenuOpen: false,
      sharePanelTarget: undefined,
    });
  },

  closePreferences: () => {
    set({ preferencesOpen: false });
  },

  closeSharePanel: () => {
    set({ topPopover: null, sharePanelTarget: undefined });
  },

  openFilesPanel: () => {
    set({
      topPopover: null,
      centerPopover: null,
      preferencesOpen: false,
      workspaceMenuOpen: false,
      sharePanelTarget: undefined,
      rightPanelOpen: true,
      rightPanelView: "files",
    });
  },

  openSharePanel: (panel) => {
    set({
      topPopover: "share",
      centerPopover: null,
      workspaceMenuOpen: false,
      sharePanelTarget: panel,
    });
  },

  setCenterPopover: (popover) => {
    set((state) => ({ centerPopover: applyUiValueUpdater(state.centerPopover, popover) }));
  },

  setPreferencesOpen: (isOpen) => {
    set((state) => ({ preferencesOpen: applyUiValueUpdater(state.preferencesOpen, isOpen) }));
  },

  setRightPanelOpen: (isOpen) => {
    set((state) => ({ rightPanelOpen: applyUiValueUpdater(state.rightPanelOpen, isOpen) }));
  },

  setRightPanelView: (view) => {
    set({ rightPanelView: view });
  },

  setSearchOpen: (isOpen) => {
    set((state) => ({ searchOpen: applyUiValueUpdater(state.searchOpen, isOpen) }));
  },

  setSharePanelTarget: (panel) => {
    set({ sharePanelTarget: panel });
  },

  setSplitDragging: (isDragging) => {
    set({ splitDragging: isDragging });
  },

  setTopPopover: (popover) => {
    set((state) => ({ topPopover: applyUiValueUpdater(state.topPopover, popover) }));
  },

  setWorkspaceMenuOpen: (isOpen) => {
    set((state) => ({ workspaceMenuOpen: applyUiValueUpdater(state.workspaceMenuOpen, isOpen) }));
  },

  togglePreferences: () => {
    set((state) => ({
      preferencesOpen: !state.preferencesOpen,
      topPopover: null,
    }));
  },

  toggleRightPanel: () => {
    set((state) => ({
      rightPanelOpen: !state.rightPanelOpen,
      workspaceMenuOpen: false,
      preferencesOpen: false,
      topPopover: null,
      centerPopover: null,
    }));
  },

  toggleSearch: () => {
    set((state) => ({
      searchOpen: !state.searchOpen,
      topPopover: null,
      centerPopover: null,
    }));
  },

  toggleWorkspaceMenu: () => {
    set((state) => ({
      workspaceMenuOpen: !state.workspaceMenuOpen,
      preferencesOpen: false,
      topPopover: null,
      centerPopover: null,
    }));
  },
}));

export const resetWorkspaceUiStoreForTests = () => {
  useWorkspaceUiStore.setState(DEFAULT_WORKSPACE_UI_STORE_STATE);
};
