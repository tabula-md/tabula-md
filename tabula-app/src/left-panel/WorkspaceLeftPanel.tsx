import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { getBrowserStorage, readBrowserStorage, writeBrowserStorage } from "../browserStorage";
import { keepFocusInside } from "../ui/ModalSurface";
import { useEventCallback } from "../shared/useEventCallback";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import {
  clampRightPanelWidth,
  DEFAULT_RIGHT_PANEL_WIDTH,
} from "../right-panel/RightPanelDivider";
import { LeftPanel } from "./LeftPanel";
import { LeftPanelDivider } from "./LeftPanelDivider";

type LeftPanelProps = ComponentProps<typeof LeftPanel>;

const LEFT_PANEL_WIDTH_STORAGE_KEY = "tabula-left-panel-width-v1";
const readLeftPanelWidth = () => {
  if (typeof window === "undefined") return DEFAULT_RIGHT_PANEL_WIDTH;
  const storedWidth = Number(readBrowserStorage(
    getBrowserStorage("localStorage"),
    LEFT_PANEL_WIDTH_STORAGE_KEY,
  ));
  return Number.isFinite(storedWidth) && storedWidth > 0
    ? clampRightPanelWidth(storedWidth, window.innerWidth)
    : DEFAULT_RIGHT_PANEL_WIDTH;
};

export type WorkspaceLeftPanelProps = Omit<
  LeftPanelProps,
  "activeFileId" | "isLiveWorkspace" | "overlayMode" | "panelRef"
> & {
  activeFileId?: string;
  isLive: boolean;
};

export function WorkspaceLeftPanel({
  activeFileId,
  isLive,
  onClose,
  ...leftPanelProps
}: WorkspaceLeftPanelProps) {
  const [width, setWidth] = useState(readLeftPanelWidth);
  const [overlayMode, setOverlayMode] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const closePanel = useEventCallback(onClose);
  const copy = getWorkspaceInterfaceCopy(leftPanelProps.language).sidePanel;

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--left-panel-width", `${width}px`);
    writeBrowserStorage(
      getBrowserStorage("localStorage"),
      LEFT_PANEL_WIDTH_STORAGE_KEY,
      String(width),
    );
  }, [width]);

  useLayoutEffect(() => {
    const updateOverlayMode = () => setOverlayMode(
      leftPanelProps.isOpen && window.innerWidth <= 1160,
    );
    updateOverlayMode();
    window.addEventListener("resize", updateOverlayMode);
    return () => window.removeEventListener("resize", updateOverlayMode);
  }, [leftPanelProps.isOpen]);

  useEffect(() => {
    if (!overlayMode || !leftPanelProps.isOpen) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    const workbench = document.querySelector<HTMLElement>(".center-workbench");
    if (workbench) {
      workbench.inert = true;
      workbench.setAttribute("aria-hidden", "true");
    }
    panel.focus();
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
        document.querySelector<HTMLElement>(".left-panel-trigger.active")?.focus();
      });
    };
  }, [closePanel, leftPanelProps.isOpen, overlayMode]);

  return (
    <>
      {leftPanelProps.isOpen && (
        <>
          <button
            className="left-panel-backdrop"
            type="button"
            tabIndex={-1}
            aria-label={copy.dismiss}
            onClick={onClose}
          />
          <LeftPanelDivider
            label={copy.resize}
            width={width}
            onWidthChange={setWidth}
          />
        </>
      )}
      <LeftPanel
        {...leftPanelProps}
        activeFileId={activeFileId ?? ""}
        isLiveWorkspace={isLive}
        overlayMode={overlayMode}
        panelRef={panelRef}
        onClose={onClose}
      />
    </>
  );
}
