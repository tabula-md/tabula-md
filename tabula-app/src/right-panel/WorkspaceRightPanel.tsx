import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { getBrowserStorage, readBrowserStorage, writeBrowserStorage } from "../browserStorage";
import { useEventCallback } from "../shared/useEventCallback";
import { RightPanel } from "./RightPanel";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { keepFocusInside } from "../ui/ModalSurface";
import {
  clampRightPanelWidth,
  DEFAULT_RIGHT_PANEL_WIDTH,
  RightPanelDivider,
} from "./RightPanelDivider";

type RightPanelProps = ComponentProps<typeof RightPanel>;

const RIGHT_PANEL_WIDTH_STORAGE_KEY = "tabula-side-panel-width-v1";
const readRightPanelWidth = () => {
  if (typeof window === "undefined") return DEFAULT_RIGHT_PANEL_WIDTH;
  const storedWidth = Number(readBrowserStorage(
    getBrowserStorage("localStorage"),
    RIGHT_PANEL_WIDTH_STORAGE_KEY,
  ));
  return Number.isFinite(storedWidth) && storedWidth > 0
    ? clampRightPanelWidth(storedWidth, window.innerWidth)
    : DEFAULT_RIGHT_PANEL_WIDTH;
};

export type WorkspaceRightPanelProps = Omit<
  RightPanelProps,
  "activeFileId" | "onClose" | "overlayMode" | "panelRef"
> & {
  activeFileId?: string;
  onClose: () => void;
};

export function WorkspaceRightPanel({
  activeFileId,
  onClose,
  ...rightPanelProps
}: WorkspaceRightPanelProps) {
  const [width, setWidth] = useState(readRightPanelWidth);
  const [overlayMode, setOverlayMode] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const panelOpenRef = useRef(rightPanelProps.isOpen);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const copy = getWorkspaceInterfaceCopy(rightPanelProps.language).sidePanel;
  const panelOpen = rightPanelProps.isOpen;
  const closePanel = useEventCallback(onClose);
  if (panelOpen && !panelOpenRef.current && typeof document !== "undefined") {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  }
  panelOpenRef.current = panelOpen;

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${width}px`);
    writeBrowserStorage(
      getBrowserStorage("localStorage"),
      RIGHT_PANEL_WIDTH_STORAGE_KEY,
      String(width),
    );
  }, [width]);

  useLayoutEffect(() => {
    const mainPanel = document.querySelector(".main-panel");
    const updateOverlayMode = () => {
      const splitViewOpen = mainPanel?.classList.contains("split-view-open") ?? false;
      setOverlayMode(
        panelOpen
        && (window.innerWidth <= 820 || (window.innerWidth <= 1160 && splitViewOpen)),
      );
    };
    const splitViewObserver = mainPanel
      ? new MutationObserver(updateOverlayMode)
      : null;

    updateOverlayMode();
    window.addEventListener("resize", updateOverlayMode);
    if (mainPanel && splitViewObserver) {
      splitViewObserver.observe(mainPanel, {
        attributeFilter: ["class"],
        attributes: true,
      });
    }
    return () => {
      window.removeEventListener("resize", updateOverlayMode);
      splitViewObserver?.disconnect();
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!overlayMode || !rightPanelProps.isOpen) return undefined;

    const panel = panelRef.current;
    if (!panel) return undefined;

    const workbench = document.querySelector<HTMLElement>(".center-workbench");
    if (workbench) {
      workbench.inert = true;
      workbench.setAttribute("aria-hidden", "true");
    }
    panel.querySelector<HTMLElement>(".right-panel-tab.active")?.focus();
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

    // Nested menus and popovers get the first chance to consume Escape.
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
          : document.querySelector<HTMLElement>(".top-right-zone .top-panel-toggle");
        restoreTarget?.focus();
      });
    };
  }, [closePanel, overlayMode, rightPanelProps.isOpen]);

  return (
    <>
      {rightPanelProps.isOpen && (
        <>
          <button
            className="right-panel-backdrop"
            type="button"
            tabIndex={-1}
            aria-label={copy.dismiss}
            onClick={onClose}
          />
          <RightPanelDivider
            label={copy.resize}
            width={width}
            onWidthChange={setWidth}
          />
        </>
      )}
      <RightPanel
        {...rightPanelProps}
        activeFileId={activeFileId ?? ""}
        overlayMode={overlayMode}
        panelRef={panelRef}
        onClose={onClose}
      />
    </>
  );
}
