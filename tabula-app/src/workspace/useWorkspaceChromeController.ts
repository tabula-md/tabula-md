import { useEffect } from "react";
import type { MarkdownSelectionActionPosition } from "../document/markdownEditorTypes";
import type { LeftPanelView } from "../ui/uiTypes";
import { useWorkspaceUiStore } from "./state/workspaceUiStore";

type UseWorkspaceChromeControllerArgs = {
  selectionActionPosition: MarkdownSelectionActionPosition | null;
  setCopiedFileId: (fileId: string | null) => void;
  setSelectionActionPosition: (position: MarkdownSelectionActionPosition | null) => void;
};

export function useWorkspaceChromeController({
  selectionActionPosition,
  setCopiedFileId,
  setSelectionActionPosition,
}: UseWorkspaceChromeControllerArgs) {
  const topPopover = useWorkspaceUiStore((state) => state.topPopover);
  const setTopPopover = useWorkspaceUiStore((state) => state.setTopPopover);
  const centerPopover = useWorkspaceUiStore((state) => state.centerPopover);
  const setCenterPopover = useWorkspaceUiStore((state) => state.setCenterPopover);
  const workspaceMenuOpen = useWorkspaceUiStore((state) => state.workspaceMenuOpen);
  const setWorkspaceMenuOpen = useWorkspaceUiStore((state) => state.setWorkspaceMenuOpen);
  const preferencesOpen = useWorkspaceUiStore((state) => state.preferencesOpen);
  const setPreferencesOpen = useWorkspaceUiStore((state) => state.setPreferencesOpen);
  const leftPanelOpen = useWorkspaceUiStore((state) => state.leftPanelOpen);
  const setLeftPanelOpen = useWorkspaceUiStore((state) => state.setLeftPanelOpen);
  const leftPanelView = useWorkspaceUiStore((state) => state.leftPanelView);
  const setLeftPanelView = useWorkspaceUiStore((state) => state.setLeftPanelView);
  const rightPanelOpen = useWorkspaceUiStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useWorkspaceUiStore((state) => state.setRightPanelOpen);
  const rightPanelView = useWorkspaceUiStore((state) => state.rightPanelView);
  const setRightPanelView = useWorkspaceUiStore((state) => state.setRightPanelView);
  const searchOpen = useWorkspaceUiStore((state) => state.searchOpen);
  const setSearchOpen = useWorkspaceUiStore((state) => state.setSearchOpen);
  const launcherOpen = useWorkspaceUiStore((state) => state.launcherOpen);
  const setLauncherOpen = useWorkspaceUiStore((state) => state.setLauncherOpen);
  const closeUiFloatingChrome = useWorkspaceUiStore((state) => state.closeFloatingChrome);
  const openUiFilesPanel = useWorkspaceUiStore((state) => state.openFilesPanel);
  const openSharePanel = useWorkspaceUiStore((state) => state.openSharePanel);
  const toggleWorkspaceMenu = useWorkspaceUiStore((state) => state.toggleWorkspaceMenu);
  const toggleUiLeftPanel = useWorkspaceUiStore((state) => state.toggleLeftPanel);
  const toggleUiRightPanel = useWorkspaceUiStore((state) => state.toggleRightPanel);

  const usesOverlayPanels = () =>
    typeof window !== "undefined" && window.innerWidth <= 1160;

  const closeFloatingChrome = () => {
    closeUiFloatingChrome();
    setCopiedFileId(null);
    setSelectionActionPosition(null);
  };

  const openFilesPanel = () => {
    openUiFilesPanel();
    if (usesOverlayPanels()) setRightPanelOpen(false);
    setCopiedFileId(null);
    setSelectionActionPosition(null);
  };

  const toggleLeftPanel = (view: LeftPanelView) => {
    const willOpen = !leftPanelOpen || leftPanelView !== view;
    toggleUiLeftPanel(view);
    if (willOpen && usesOverlayPanels()) setRightPanelOpen(false);
  };

  const toggleRightPanel = () => {
    const willOpen = !rightPanelOpen;
    toggleUiRightPanel();
    if (willOpen && usesOverlayPanels()) setLeftPanelOpen(false);
  };

  useEffect(() => {
    if (!leftPanelOpen || !rightPanelOpen) return undefined;

    const keepSingleOverlayPanel = () => {
      if (usesOverlayPanels()) setRightPanelOpen(false);
    };

    keepSingleOverlayPanel();
    window.addEventListener("resize", keepSingleOverlayPanel);
    return () => window.removeEventListener("resize", keepSingleOverlayPanel);
  }, [leftPanelOpen, rightPanelOpen, setRightPanelOpen]);

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
      const isWorkspaceMenuTrigger = Boolean(target.closest(".workspace-menu-button"));
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
    openSharePanel,
    toggleWorkspaceMenu,
    toggleLeftPanel,
    toggleRightPanel,
  };
}
