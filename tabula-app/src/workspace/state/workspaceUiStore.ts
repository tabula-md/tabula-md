import { create } from "zustand";
import type {
  CenterPopover,
  LeftPanelView,
  RightPanelView,
  TopPopover,
} from "../../ui/uiTypes";

type UiValueUpdater<T> = T | ((currentValue: T) => T);

const applyUiValueUpdater = <T>(value: T, update: UiValueUpdater<T>) =>
  typeof update === "function" ? (update as (currentValue: T) => T)(value) : update;

type WorkspaceUiStoreState = {
  topPopover: TopPopover;
  centerPopover: CenterPopover;
  leftPanelOpen: boolean;
  leftPanelView: LeftPanelView;
  rightPanelOpen: boolean;
  rightPanelView: RightPanelView;
  workspaceMenuOpen: boolean;
  preferencesOpen: boolean;
  searchOpen: boolean;
  launcherOpen: boolean;
  splitDragging: boolean;
};

type WorkspaceUiStoreActions = {
  closeFloatingChrome: () => void;
  closePreferences: () => void;
  openFilesPanel: () => void;
  openSharePanel: () => void;
  setCenterPopover: (popover: UiValueUpdater<CenterPopover>) => void;
  setLeftPanelOpen: (isOpen: UiValueUpdater<boolean>) => void;
  setLeftPanelView: (view: LeftPanelView) => void;
  setPreferencesOpen: (isOpen: UiValueUpdater<boolean>) => void;
  setRightPanelOpen: (isOpen: UiValueUpdater<boolean>) => void;
  setRightPanelView: (view: RightPanelView) => void;
  setSearchOpen: (isOpen: UiValueUpdater<boolean>) => void;
  setLauncherOpen: (isOpen: UiValueUpdater<boolean>) => void;
  setSplitDragging: (isDragging: boolean) => void;
  setTopPopover: (popover: UiValueUpdater<TopPopover>) => void;
  setWorkspaceMenuOpen: (isOpen: UiValueUpdater<boolean>) => void;
  toggleLeftPanel: (view: LeftPanelView) => void;
  togglePreferences: () => void;
  toggleRightPanel: () => void;
  toggleSearch: () => void;
  toggleWorkspaceMenu: () => void;
};

export type WorkspaceUiStore = WorkspaceUiStoreState & WorkspaceUiStoreActions;

const DEFAULT_WORKSPACE_UI_STORE_STATE: WorkspaceUiStoreState = {
  topPopover: null,
  centerPopover: null,
  leftPanelOpen: false,
  leftPanelView: "files",
  rightPanelOpen: false,
  rightPanelView: "outline",
  workspaceMenuOpen: false,
  preferencesOpen: false,
  searchOpen: false,
  launcherOpen: false,
  splitDragging: false,
};

export const useWorkspaceUiStore = create<WorkspaceUiStore>()((set) => ({
  ...DEFAULT_WORKSPACE_UI_STORE_STATE,

  closeFloatingChrome: () => {
    set({
      topPopover: null,
      centerPopover: null,
      preferencesOpen: false,
      workspaceMenuOpen: false,
      launcherOpen: false,
    });
  },

  closePreferences: () => {
    set({ preferencesOpen: false });
  },

  openFilesPanel: () => {
    set({
      topPopover: null,
      centerPopover: null,
      preferencesOpen: false,
      workspaceMenuOpen: false,
      leftPanelOpen: true,
      leftPanelView: "files",
    });
  },

  openSharePanel: () => {
    set({
      topPopover: "share",
      centerPopover: null,
      workspaceMenuOpen: false,
    });
  },

  setCenterPopover: (popover) => {
    set((state) => ({ centerPopover: applyUiValueUpdater(state.centerPopover, popover) }));
  },

  setLeftPanelOpen: (isOpen) => {
    set((state) => ({ leftPanelOpen: applyUiValueUpdater(state.leftPanelOpen, isOpen) }));
  },

  setLeftPanelView: (view) => {
    set({ leftPanelView: view });
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

  setLauncherOpen: (isOpen) => {
    set((state) => ({
      launcherOpen: applyUiValueUpdater(state.launcherOpen, isOpen),
      workspaceMenuOpen: false,
      preferencesOpen: false,
    }));
  },

  setSplitDragging: (isDragging) => {
    set({ splitDragging: isDragging });
  },

  setTopPopover: (popover) => {
    set((state) => ({ topPopover: applyUiValueUpdater(state.topPopover, popover) }));
  },

  setWorkspaceMenuOpen: (isOpen) => {
    set((state) => {
      const nextOpen = applyUiValueUpdater(state.workspaceMenuOpen, isOpen);
      return {
        workspaceMenuOpen: nextOpen,
        ...(nextOpen ? {
          leftPanelOpen: true,
          leftPanelView: "files" as const,
          topPopover: null,
          centerPopover: null,
        } : {}),
      };
    });
  },

  togglePreferences: () => {
    set((state) => ({
      preferencesOpen: !state.preferencesOpen,
      topPopover: null,
    }));
  },

  toggleLeftPanel: (view) => {
    set((state) => ({
      leftPanelOpen: !(state.leftPanelOpen && state.leftPanelView === view),
      leftPanelView: view,
      workspaceMenuOpen: false,
      preferencesOpen: false,
      topPopover: null,
      centerPopover: null,
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
      leftPanelOpen: true,
      leftPanelView: "files",
      preferencesOpen: false,
      topPopover: null,
      centerPopover: null,
    }));
  },
}));

export const resetWorkspaceUiStoreForTests = () => {
  useWorkspaceUiStore.setState(DEFAULT_WORKSPACE_UI_STORE_STATE);
};
