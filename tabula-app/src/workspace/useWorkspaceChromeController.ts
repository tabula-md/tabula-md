import { useEffect } from "react";
import type { MarkdownSelectionActionPosition } from "../document/markdownEditorTypes";
import type { LeftPanelView, RightPanelView } from "../ui/uiTypes";
import {
  selectCenterPopover,
  selectLauncherOpen,
  selectPreferencesOpen,
  selectSearchOpen,
  selectWorkspaceMenuOpen,
  useWorkspaceUiStore,
} from "./state/workspaceUiStore";
import {
  workspaceShellUsesExclusivePanels,
  type WorkspaceShellSize,
} from "./workspaceShellLayout";

type UseWorkspaceChromeControllerArgs = {
  shellSize: WorkspaceShellSize;
  selectionActionPosition: MarkdownSelectionActionPosition | null;
  setCopiedFileId: (fileId: string | null) => void;
  setSelectionActionPosition: (position: MarkdownSelectionActionPosition | null) => void;
};

export function useWorkspaceChromeController({
  shellSize,
  selectionActionPosition,
  setCopiedFileId,
  setSelectionActionPosition,
}: UseWorkspaceChromeControllerArgs) {
  const topPopover = useWorkspaceUiStore((state) => state.topPopover);
  const setTopPopover = useWorkspaceUiStore((state) => state.setTopPopover);
  const centerPopover = useWorkspaceUiStore(selectCenterPopover);
  const setCenterPopover = useWorkspaceUiStore((state) => state.setCenterPopover);
  const workspaceMenuOpen = useWorkspaceUiStore(selectWorkspaceMenuOpen);
  const setWorkspaceMenuOpen = useWorkspaceUiStore((state) => state.setWorkspaceMenuOpen);
  const preferencesOpen = useWorkspaceUiStore(selectPreferencesOpen);
  const setPreferencesOpen = useWorkspaceUiStore((state) => state.setPreferencesOpen);
  const leftPanelOpen = useWorkspaceUiStore((state) => state.leftPanelOpen);
  const setLeftPanelOpen = useWorkspaceUiStore((state) => state.setLeftPanelOpen);
  const leftPanelView = useWorkspaceUiStore((state) => state.leftPanelView);
  const setLeftPanelView = useWorkspaceUiStore((state) => state.setLeftPanelView);
  const rightPanelOpen = useWorkspaceUiStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useWorkspaceUiStore((state) => state.setRightPanelOpen);
  const rightPanelView = useWorkspaceUiStore((state) => state.rightPanelView);
  const setRightPanelView = useWorkspaceUiStore((state) => state.setRightPanelView);
  const searchOpen = useWorkspaceUiStore(selectSearchOpen);
  const setSearchOpen = useWorkspaceUiStore((state) => state.setSearchOpen);
  const launcherOpen = useWorkspaceUiStore(selectLauncherOpen);
  const setLauncherOpen = useWorkspaceUiStore((state) => state.setLauncherOpen);
  const closeUiFloatingChrome = useWorkspaceUiStore((state) => state.closeFloatingChrome);
  const openUiFilesPanel = useWorkspaceUiStore((state) => state.openFilesPanel);
  const openUiSidePanel = useWorkspaceUiStore((state) => state.openSidePanel);
  const openSharePanel = useWorkspaceUiStore((state) => state.openSharePanel);
  const toggleUiWorkspaceMenu = useWorkspaceUiStore((state) => state.toggleWorkspaceMenu);
  const toggleUiRightPanel = useWorkspaceUiStore((state) => state.toggleRightPanel);
  const toggleUiSidePanel = useWorkspaceUiStore((state) => state.toggleSidePanel);

  const usesExclusivePanels = workspaceShellUsesExclusivePanels(shellSize);

  useEffect(() => {
    if (usesExclusivePanels && leftPanelOpen && rightPanelOpen) {
      setRightPanelOpen(false);
    }
  }, [leftPanelOpen, rightPanelOpen, setRightPanelOpen, usesExclusivePanels]);

  const closeFloatingChrome = () => {
    closeUiFloatingChrome();
    setCopiedFileId(null);
    setSelectionActionPosition(null);
  };

  const openFilesPanel = () => {
    openUiFilesPanel(usesExclusivePanels);
    setCopiedFileId(null);
    setSelectionActionPosition(null);
  };

  const openLeftPanel = (view: LeftPanelView) => {
    openUiSidePanel({ side: "left", view }, usesExclusivePanels);
    setCopiedFileId(null);
    setSelectionActionPosition(null);
  };

  const openRightPanel = (view: RightPanelView) => {
    openUiSidePanel({ side: "right", view }, usesExclusivePanels);
    setCopiedFileId(null);
    setSelectionActionPosition(null);
  };

  const toggleLeftPanel = () => {
    const willOpen = !leftPanelOpen;
    toggleUiSidePanel({ side: "left", view: leftPanelView }, usesExclusivePanels);
    if (!willOpen) {
      setPreferencesOpen(false);
      setWorkspaceMenuOpen(false);
    }
  };

  const toggleRightPanel = () => {
    const willOpen = !rightPanelOpen;
    toggleUiRightPanel(usesExclusivePanels);
    if (willOpen && usesExclusivePanels) {
      setPreferencesOpen(false);
      setWorkspaceMenuOpen(false);
    }
  };

  const toggleWorkspaceMenu = () => {
    const willOpen = !workspaceMenuOpen;
    toggleUiWorkspaceMenu();
    if (!willOpen) setPreferencesOpen(false);
    if (willOpen && usesExclusivePanels) {
      setLeftPanelOpen(true);
      setRightPanelOpen(false);
    }
  };

  const openWorkspaceMenu = () => {
    setWorkspaceMenuOpen(true);
    if (usesExclusivePanels) {
      setLeftPanelOpen(true);
      setRightPanelOpen(false);
    }
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      if (selectionActionPosition) {
        event.preventDefault();
        setSelectionActionPosition(null);
        return;
      }

      if (topPopover || centerPopover || searchOpen || launcherOpen) {
        event.preventDefault();
        setTopPopover(null);
        setCenterPopover(null);
        setSearchOpen(false);
        setLauncherOpen(false);
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const isInsideWorkspaceMenu = Boolean(target?.closest(".workspace-menu-popover"));
      const isInsideLeftPanel = Boolean(target?.closest(".left-panel"));
      const isInsideRightPanel = Boolean(target?.closest(".right-panel"));

      if (workspaceMenuOpen && (isInsideWorkspaceMenu || !isInsideRightPanel)) {
        event.preventDefault();
        if (preferencesOpen) {
          setPreferencesOpen(false);
          return;
        }

        setWorkspaceMenuOpen(false);
        return;
      }

      if (rightPanelOpen && (isInsideRightPanel || !isInsideLeftPanel)) {
        event.preventDefault();
        setRightPanelOpen(false);
        return;
      }

      if (leftPanelOpen) {
        event.preventDefault();
        setLeftPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    centerPopover,
    preferencesOpen,
    leftPanelOpen,
    rightPanelOpen,
    searchOpen,
    launcherOpen,
    selectionActionPosition,
    setSearchOpen,
    setSelectionActionPosition,
    topPopover,
    workspaceMenuOpen,
  ]);

  useEffect(() => {
    if (!workspaceMenuOpen && !preferencesOpen && !centerPopover && !selectionActionPosition) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }

      const isInsideWorkspaceMenu = Boolean(target.closest(".workspace-menu-popover"));
      const isWorkspaceMenuTrigger = Boolean(target.closest(".left-panel-status-button"));
      const isInsideEditorControls = Boolean(target.closest(".document-controls-wrap, .document-controls-popover"));
      const isInsideSelectionPopover = Boolean(target.closest(".selection-comment-popover"));

      if (selectionActionPosition && !isInsideSelectionPopover) {
        setSelectionActionPosition(null);
      }

      if (workspaceMenuOpen && !isInsideWorkspaceMenu && !isWorkspaceMenuTrigger) {
        setPreferencesOpen(false);
        setWorkspaceMenuOpen(false);
      }

      if (centerPopover && !isInsideEditorControls) {
        setCenterPopover(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [
    centerPopover,
    preferencesOpen,
    selectionActionPosition,
    setCenterPopover,
    setPreferencesOpen,
    setSelectionActionPosition,
    setWorkspaceMenuOpen,
    workspaceMenuOpen,
  ]);

  return {
    topPopover,
    setTopPopover,
    centerPopover,
    setCenterPopover,
    workspaceMenuOpen,
    setWorkspaceMenuOpen,
    preferencesOpen,
    setPreferencesOpen,
    leftPanelOpen,
    setLeftPanelOpen,
    leftPanelView,
    setLeftPanelView,
    rightPanelOpen,
    setRightPanelOpen,
    rightPanelView,
    launcherOpen,
    setLauncherOpen,
    setRightPanelView,
    closeFloatingChrome,
    openFilesPanel,
    openLeftPanel,
    openRightPanel,
    openWorkspaceMenu,
    openSharePanel,
    toggleWorkspaceMenu,
    toggleLeftPanel,
    toggleRightPanel,
  };
}
