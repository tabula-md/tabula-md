import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { getBrowserStorage, readBrowserStorage, writeBrowserStorage } from "../browserStorage";
import { useWorkspacePanelOverlay } from "../shared/useWorkspacePanelOverlay";
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
  onClose: () => void;
};

export function WorkspaceLeftPanel({
  activeFileId,
  isLive,
  onClose,
  ...leftPanelProps
}: WorkspaceLeftPanelProps) {
  const [width, setWidth] = useState(readLeftPanelWidth);
  const panelRef = useRef<HTMLElement | null>(null);
  const copy = getWorkspaceInterfaceCopy(leftPanelProps.language).sidePanel;
  const overlayMode = useWorkspacePanelOverlay({
    isOpen: leftPanelProps.isOpen,
    panelRef,
    activeControlSelector: ".left-panel-trigger.active",
    restoreControlSelector: ".top-chrome .left-panel-trigger",
    onClose,
  });

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--left-panel-width", `${width}px`);
    writeBrowserStorage(
      getBrowserStorage("localStorage"),
      LEFT_PANEL_WIDTH_STORAGE_KEY,
      String(width),
    );
  }, [width]);

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
            label={copy.resizeWorkspace}
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
