import { useLayoutEffect, useState, type ComponentProps } from "react";
import { getBrowserStorage, readBrowserStorage, writeBrowserStorage } from "../browserStorage";
import { RightPanel } from "./RightPanel";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import {
  clampSidePanelWidth,
  DEFAULT_SIDE_PANEL_WIDTH,
  SidePanelDivider,
} from "./SidePanelDivider";

type RightPanelProps = ComponentProps<typeof RightPanel>;

const SIDE_PANEL_WIDTH_STORAGE_KEY = "tabula-side-panel-width-v1";

const readSidePanelWidth = () => {
  if (typeof window === "undefined") return DEFAULT_SIDE_PANEL_WIDTH;
  const storedWidth = Number(readBrowserStorage(
    getBrowserStorage("localStorage"),
    SIDE_PANEL_WIDTH_STORAGE_KEY,
  ));
  return Number.isFinite(storedWidth) && storedWidth > 0
    ? clampSidePanelWidth(storedWidth, window.innerWidth)
    : DEFAULT_SIDE_PANEL_WIDTH;
};

export type WorkspaceSidePanelProps = Omit<
  RightPanelProps,
  "activeFileId" | "isLiveWorkspace" | "onToggleSidePanel"
> & {
  activeFileId?: string;
  isLive: boolean;
  onClose: () => void;
};

export function WorkspaceSidePanel({
  activeFileId,
  isLive,
  onClose,
  ...rightPanelProps
}: WorkspaceSidePanelProps) {
  const [width, setWidth] = useState(readSidePanelWidth);
  const copy = getWorkspaceInterfaceCopy(rightPanelProps.language).sidePanel;

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--side-panel-width", `${width}px`);
    writeBrowserStorage(
      getBrowserStorage("localStorage"),
      SIDE_PANEL_WIDTH_STORAGE_KEY,
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
            aria-label={copy.dismiss}
            onClick={onClose}
          />
          <SidePanelDivider
            label={copy.resize}
            width={width}
            onWidthChange={setWidth}
          />
        </>
      )}
      <RightPanel
        {...rightPanelProps}
        activeFileId={activeFileId ?? ""}
        isLiveWorkspace={isLive}
        onToggleSidePanel={onClose}
      />
    </>
  );
}
