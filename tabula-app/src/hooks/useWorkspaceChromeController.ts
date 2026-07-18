import { useEffect } from "react";
import type { MarkdownSelectionActionPosition } from "../document/markdownEditorTypes";
import { useWorkspaceUiStore } from "../stores/workspaceUiStore";

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
  const rightPanelOpen = useWorkspaceUiStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useWorkspaceUiStore((state) => state.setRightPanelOpen);
  const rightPanelView = useWorkspaceUiStore((state) => state.rightPanelView);
  const setRightPanelView = useWorkspaceUiStore((state) => state.setRightPanelView);
  const searchOpen = useWorkspaceUiStore((state) => state.searchOpen);
  const setSearchOpen = useWorkspaceUiStore((state) => state.setSearchOpen);
  const closeUiFloatingChrome = useWorkspaceUiStore((state) => state.closeFloatingChrome);
  const openUiFilesPanel = useWorkspaceUiStore((state) => state.openFilesPanel);
  const openSharePanel = useWorkspaceUiStore((state) => state.openSharePanel);
  const toggleWorkspaceMenu = useWorkspaceUiStore((state) => state.toggleWorkspaceMenu);
  const toggleRightPanel = useWorkspaceUiStore((state) => state.toggleRightPanel);

  const closeFloatingChrome = () => {
    closeUiFloatingChrome();
    setCopiedFileId(null);
    setSelectionActionPosition(null);
  };

  const openFilesPanel = () => {
    openUiFilesPanel();
    setCopiedFileId(null);
    setSelectionActionPosition(null);
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

      if (topPopover || centerPopover || searchOpen) {
        event.preventDefault();
        setTopPopover(null);
        setCenterPopover(null);
        setSearchOpen(false);
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const isInsideWorkspaceMenu = Boolean(target?.closest(".workspace-menu-popover"));
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

      if (rightPanelOpen) {
        event.preventDefault();
        setRightPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    centerPopover,
    preferencesOpen,
    rightPanelOpen,
    searchOpen,
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
    rightPanelOpen,
    setRightPanelOpen,
    rightPanelView,
    setRightPanelView,
    closeFloatingChrome,
    openFilesPanel,
    openSharePanel,
    toggleWorkspaceMenu,
    toggleRightPanel,
  };
}
