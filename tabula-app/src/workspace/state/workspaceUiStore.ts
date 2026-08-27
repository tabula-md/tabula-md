import { create } from "zustand";
import type {
  CenterPopover,
  LeftPanelView,
  RightPanelView,
  TopPopover,
} from "../../ui/uiTypes";

type UiValueUpdater<T> = T | ((currentValue: T) => T);
type WorkspaceSurface = "menu" | "preferences" | "launcher" | null;
type DocumentChromeSurface = "view" | null;
type SidePanelTarget =
  | { side: "left"; view: LeftPanelView }
  | { side: "right"; view: RightPanelView };

const applyUiValueUpdater = <T>(value: T, update: UiValueUpdater<T>) =>
  typeof update === "function" ? (update as (currentValue: T) => T)(value) : update;

type WorkspaceUiStoreState = {
  topPopover: TopPopover;
  documentSurface: DocumentChromeSurface;
  workspaceSurface: WorkspaceSurface;
  leftPanelOpen: boolean;
  leftPanelView: LeftPanelView;
  rightPanelOpen: boolean;
  rightPanelView: RightPanelView;
  searchOpen: boolean;
  splitDragging: boolean;
};

type WorkspaceUiStoreActions = {
  closeFloatingChrome: () => void;
  closePreferences: () => void;
  openFilesPanel: (exclusive?: boolean) => void;
  openSidePanel: (target: SidePanelTarget, exclusive?: boolean) => void;
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
  toggleRightPanel: (exclusive?: boolean) => void;
  toggleSidePanel: (target: SidePanelTarget, exclusive?: boolean) => void;
  toggleSearch: () => void;
  toggleWorkspaceMenu: () => void;
};

export type WorkspaceUiStore = WorkspaceUiStoreState & WorkspaceUiStoreActions;

const DEFAULT_WORKSPACE_UI_STORE_STATE: WorkspaceUiStoreState = {
  topPopover: null,
  documentSurface: null,
  workspaceSurface: null,
  leftPanelOpen: false,
  leftPanelView: "files",
  rightPanelOpen: false,
  rightPanelView: "metadata",
  searchOpen: false,
  splitDragging: false,
};

const closeSurfaceState = {
  topPopover: null,
  documentSurface: null,
  workspaceSurface: null,
} as const;

export const selectCenterPopover = (state: WorkspaceUiStore): CenterPopover =>
  state.documentSurface === "view" ? "view" : null;
export const selectSearchOpen = (state: WorkspaceUiStore) => state.searchOpen;
export const selectWorkspaceMenuOpen = (state: WorkspaceUiStore) =>
  state.workspaceSurface === "menu";
export const selectPreferencesOpen = (state: WorkspaceUiStore) =>
  state.workspaceSurface === "preferences";
export const selectLauncherOpen = (state: WorkspaceUiStore) =>
  state.workspaceSurface === "launcher";

export const useWorkspaceUiStore = create<WorkspaceUiStore>()((set) => ({
  ...DEFAULT_WORKSPACE_UI_STORE_STATE,

  closeFloatingChrome: () => set(closeSurfaceState),

  closePreferences: () => {
    set((state) => ({
      workspaceSurface: state.workspaceSurface === "preferences"
        ? null
        : state.workspaceSurface,
    }));
  },

  openFilesPanel: (exclusive = false) => {
    set({
      ...closeSurfaceState,
      leftPanelOpen: true,
      leftPanelView: "files",
      ...(exclusive ? { rightPanelOpen: false } : {}),
    });
  },

  openSidePanel: (target, exclusive = false) => {
    set({
      ...closeSurfaceState,
      ...(target.side === "left"
        ? {
            leftPanelOpen: true,
            leftPanelView: target.view,
            ...(exclusive ? { rightPanelOpen: false } : {}),
          }
        : {
            rightPanelOpen: true,
            rightPanelView: target.view,
            ...(exclusive ? { leftPanelOpen: false } : {}),
          }),
    });
  },

  openSharePanel: () => {
    set({
      topPopover: "share",
      documentSurface: null,
      workspaceSurface: null,
    });
  },

  setCenterPopover: (popover) => {
    set((state) => {
      const current: CenterPopover = selectCenterPopover(state);
      const next = applyUiValueUpdater(current, popover);
      if (next === null && state.documentSurface !== "view") return state;
      return {
        documentSurface: next,
        ...(next ? { topPopover: null, workspaceSurface: null } : {}),
      };
    });
  },

  setLeftPanelOpen: (isOpen) => {
    set((state) => ({ leftPanelOpen: applyUiValueUpdater(state.leftPanelOpen, isOpen) }));
  },

  setLeftPanelView: (view) => set({ leftPanelView: view }),

  setPreferencesOpen: (isOpen) => {
    set((state) => {
      const currentOpen = selectPreferencesOpen(state);
      const nextOpen = applyUiValueUpdater(currentOpen, isOpen);
      return {
        workspaceSurface: nextOpen
          ? "preferences"
          : currentOpen
            ? null
            : state.workspaceSurface,
        ...(nextOpen ? { topPopover: null, documentSurface: null } : {}),
      };
    });
  },

  setRightPanelOpen: (isOpen) => {
    set((state) => ({ rightPanelOpen: applyUiValueUpdater(state.rightPanelOpen, isOpen) }));
  },

  setRightPanelView: (view) => set({ rightPanelView: view }),

  setSearchOpen: (isOpen) => {
    set((state) => {
      const currentOpen = state.searchOpen;
      const nextOpen = applyUiValueUpdater(currentOpen, isOpen);
      return {
        searchOpen: nextOpen,
        ...(nextOpen
          ? { topPopover: null, documentSurface: null, workspaceSurface: null }
          : {}),
      };
    });
  },

  setLauncherOpen: (isOpen) => {
    set((state) => {
      const currentOpen = selectLauncherOpen(state);
      const nextOpen = applyUiValueUpdater(currentOpen, isOpen);
      return {
        workspaceSurface: nextOpen
          ? "launcher"
          : currentOpen
            ? null
            : state.workspaceSurface,
        ...(nextOpen ? { topPopover: null, documentSurface: null } : {}),
      };
    });
  },

  setSplitDragging: (isDragging) => set({ splitDragging: isDragging }),

  setTopPopover: (popover) => {
    set((state) => {
      const next = applyUiValueUpdater(state.topPopover, popover);
      return {
        topPopover: next,
        ...(next ? { documentSurface: null, workspaceSurface: null } : {}),
      };
    });
  },

  setWorkspaceMenuOpen: (isOpen) => {
    set((state) => {
      const currentOpen = selectWorkspaceMenuOpen(state);
      const nextOpen = applyUiValueUpdater(currentOpen, isOpen);
      return {
        workspaceSurface: nextOpen
          ? "menu"
          : currentOpen
            ? null
            : state.workspaceSurface,
        ...(nextOpen ? {
          leftPanelOpen: true,
          topPopover: null,
          documentSurface: null,
        } : {}),
      };
    });
  },

  togglePreferences: () => {
    set((state) => ({
      topPopover: null,
      documentSurface: null,
      workspaceSurface: selectPreferencesOpen(state) ? null : "preferences",
    }));
  },

  toggleLeftPanel: (view) => {
    set((state) => ({
      ...closeSurfaceState,
      leftPanelOpen: !(state.leftPanelOpen && state.leftPanelView === view),
      leftPanelView: view,
    }));
  },

  toggleRightPanel: (exclusive = false) => {
    set((state) => ({
      ...closeSurfaceState,
      rightPanelOpen: !state.rightPanelOpen,
      ...(!state.rightPanelOpen && exclusive ? { leftPanelOpen: false } : {}),
    }));
  },

  toggleSidePanel: (target, exclusive = false) => {
    set((state) => {
      const isTargetOpen = target.side === "left"
        ? state.leftPanelOpen && state.leftPanelView === target.view
        : state.rightPanelOpen && state.rightPanelView === target.view;

      return {
        ...closeSurfaceState,
        ...(target.side === "left"
          ? {
              leftPanelOpen: !isTargetOpen,
              leftPanelView: target.view,
              ...(!isTargetOpen && exclusive ? { rightPanelOpen: false } : {}),
            }
          : {
              rightPanelOpen: !isTargetOpen,
              rightPanelView: target.view,
              ...(!isTargetOpen && exclusive ? { leftPanelOpen: false } : {}),
            }),
      };
    });
  },

  toggleSearch: () => {
    set((state) => ({
      topPopover: null,
      documentSurface: null,
      workspaceSurface: null,
      searchOpen: !state.searchOpen,
    }));
  },

  toggleWorkspaceMenu: () => {
    set((state) => ({
      topPopover: null,
      documentSurface: null,
      workspaceSurface: selectWorkspaceMenuOpen(state) ? null : "menu",
      leftPanelOpen: true,
    }));
  },
}));

export const resetWorkspaceUiStoreForTests = () => {
  useWorkspaceUiStore.setState(DEFAULT_WORKSPACE_UI_STORE_STATE);
};
