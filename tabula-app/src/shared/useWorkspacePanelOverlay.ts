import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { keepFocusInside } from "../ui/ModalSurface";
import { useEventCallback } from "./useEventCallback";

export const WORKSPACE_PANEL_OVERLAY_MAX_WIDTH = 1160;

type UseWorkspacePanelOverlayOptions = {
  isOpen: boolean;
  panelRef: RefObject<HTMLElement | null>;
  activeControlSelector: string;
  restoreControlSelector: string;
  onClose: () => void;
};

export function useWorkspacePanelOverlay({
  isOpen,
  panelRef,
  activeControlSelector,
  restoreControlSelector,
  onClose,
}: UseWorkspacePanelOverlayOptions) {
  const [overlayMode, setOverlayMode] = useState(false);
  const panelWasOpenRef = useRef(isOpen);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const closePanel = useEventCallback(onClose);

  if (isOpen && !panelWasOpenRef.current && typeof document !== "undefined") {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  }
  panelWasOpenRef.current = isOpen;

  useLayoutEffect(() => {
    const updateOverlayMode = () => setOverlayMode(
      isOpen && window.innerWidth <= WORKSPACE_PANEL_OVERLAY_MAX_WIDTH,
    );
    updateOverlayMode();
    window.addEventListener("resize", updateOverlayMode);
    return () => window.removeEventListener("resize", updateOverlayMode);
  }, [isOpen]);

  useEffect(() => {
    if (!overlayMode || !isOpen) return undefined;

    const panel = panelRef.current;
    if (!panel) return undefined;

    const workbench = document.querySelector<HTMLElement>(".center-workbench");
    if (workbench) {
      workbench.inert = true;
      workbench.setAttribute("aria-hidden", "true");
    }
    panel.querySelector<HTMLElement>(activeControlSelector)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePanel();
        return;
      }
      keepFocusInside(event, panel);
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (workbench) {
        workbench.inert = false;
        workbench.removeAttribute("aria-hidden");
      }
      window.requestAnimationFrame(() => {
        const restoreTarget = restoreFocusRef.current?.isConnected
          ? restoreFocusRef.current
          : document.querySelector<HTMLElement>(restoreControlSelector);
        restoreTarget?.focus();
      });
    };
  }, [
    activeControlSelector,
    closePanel,
    isOpen,
    overlayMode,
    panelRef,
    restoreControlSelector,
  ]);

  return overlayMode;
}
