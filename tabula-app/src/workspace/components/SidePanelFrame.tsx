import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { getBrowserStorage, readBrowserStorage, writeBrowserStorage } from "../../browserStorage";
import { useEventCallback } from "../../shared/useEventCallback";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { WorkspaceShellSize } from "../workspaceShellLayout";
import { SidePanelDivider } from "./SidePanelDivider";
import {
  clampSidePanelWidth,
  DEFAULT_SIDE_PANEL_WIDTH,
  type SidePanelSide,
} from "./sidePanelModel";

export type { SidePanelSide } from "./sidePanelModel";

type SidePanelFrameRenderState = {
  overlayMode: boolean;
  panelRef: RefObject<HTMLElement | null>;
};

type SidePanelFrameProps = {
  children: (state: SidePanelFrameRenderState) => ReactNode;
  isOpen: boolean;
  language: WorkspaceLanguage;
  onClose: () => void;
  shellSize: WorkspaceShellSize;
  side: SidePanelSide;
};

const getPanelWidthStorageKey = (side: SidePanelSide) =>
  side === "left" ? "tabula-left-panel-width-v1" : "tabula-side-panel-width-v1";

const readSidePanelWidth = (side: SidePanelSide) => {
  if (typeof window === "undefined") return DEFAULT_SIDE_PANEL_WIDTH;
  const storedWidth = Number(readBrowserStorage(
    getBrowserStorage("localStorage"),
    getPanelWidthStorageKey(side),
  ));
  return Number.isFinite(storedWidth) && storedWidth > 0
    ? clampSidePanelWidth(storedWidth, window.innerWidth)
    : DEFAULT_SIDE_PANEL_WIDTH;
};

const getInitialFocus = (panel: HTMLElement, side: SidePanelSide) =>
  panel.querySelector<HTMLElement>(
    side === "left"
      ? ".left-panel-tab.active, .left-panel-tab"
      : ".right-panel-tab.active, .right-panel-tab",
  ) ?? panel;

const getFallbackRestoreTarget = (side: SidePanelSide) => document.querySelector<HTMLElement>(
  side === "left"
    ? ".top-left-zone .left-panel-trigger"
    : ".top-right-zone .top-panel-toggle",
);

export function SidePanelFrame({
  children,
  isOpen,
  language,
  onClose,
  shellSize,
  side,
}: SidePanelFrameProps) {
  const [width, setWidth] = useState(() => readSidePanelWidth(side));
  const panelRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(isOpen);
  const closePanel = useEventCallback(onClose);
  const overlayMode = isOpen && shellSize === "narrow";
  const copy = getWorkspaceInterfaceCopy(language).sidePanel;

  useLayoutEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useLayoutEffect(() => {
    document.documentElement.style.setProperty(`--${side}-panel-width`, `${width}px`);
    writeBrowserStorage(
      getBrowserStorage("localStorage"),
      getPanelWidthStorageKey(side),
      String(width),
    );
  }, [side, width]);

  useLayoutEffect(() => {
    if (!overlayMode) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    const workbench = document.querySelector<HTMLElement>(".center-workbench");
    if (workbench) {
      workbench.inert = true;
      workbench.setAttribute("aria-hidden", "true");
    }
    getInitialFocus(panel, side).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePanel();
        return;
      }
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
          : getFallbackRestoreTarget(side);
        restoreTarget?.focus();
      });
    };
  }, [closePanel, overlayMode, side]);

  return (
    <>
      {isOpen && (
        <>
          {overlayMode && (
            <button
              className={`${side}-panel-backdrop side-panel-backdrop`}
              type="button"
              tabIndex={-1}
              aria-label={copy.dismiss}
              onClick={onClose}
            />
          )}
          {!overlayMode && (
            <SidePanelDivider
              label={copy.resize}
              side={side}
              width={width}
              onWidthChange={setWidth}
            />
          )}
        </>
      )}
      {children({ overlayMode, panelRef })}
    </>
  );
}
