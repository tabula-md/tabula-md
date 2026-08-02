import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { getBrowserStorage, readBrowserStorage, writeBrowserStorage } from "../browserStorage";
import { useWorkspacePanelOverlay } from "../shared/useWorkspacePanelOverlay";
import { RightPanel } from "./RightPanel";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
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
  const panelRef = useRef<HTMLElement | null>(null);
  const copy = getWorkspaceInterfaceCopy(rightPanelProps.language).sidePanel;
  const overlayMode = useWorkspacePanelOverlay({
    isOpen: rightPanelProps.isOpen,
    panelRef,
    activeControlSelector: ".right-panel-trigger.active",
    restoreControlSelector: ".top-chrome .right-panel-trigger",
    onClose,
  });

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${width}px`);
    writeBrowserStorage(
      getBrowserStorage("localStorage"),
      RIGHT_PANEL_WIDTH_STORAGE_KEY,
      String(width),
    );
  }, [width]);

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
