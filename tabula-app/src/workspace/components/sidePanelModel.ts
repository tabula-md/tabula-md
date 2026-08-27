export const DEFAULT_SIDE_PANEL_WIDTH = 288;
export const MIN_SIDE_PANEL_WIDTH = 240;
export const MIN_WORKBENCH_WIDTH = 360;

export type SidePanelSide = "left" | "right";

export const getMaximumSidePanelWidth = (viewportWidth: number) =>
  Math.max(MIN_SIDE_PANEL_WIDTH, viewportWidth - MIN_WORKBENCH_WIDTH);

export const clampSidePanelWidth = (width: number, viewportWidth: number) =>
  Math.round(Math.min(
    getMaximumSidePanelWidth(viewportWidth),
    Math.max(MIN_SIDE_PANEL_WIDTH, width),
  ));
