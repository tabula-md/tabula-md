import { describe, expect, it } from "vitest";
import {
  clampSidePanelWidth,
  getMaximumSidePanelWidth,
  MAX_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH,
} from "./SidePanelDivider";

describe("side panel width", () => {
  it("keeps the side panel within its desktop bounds", () => {
    expect(clampSidePanelWidth(100, 1440)).toBe(MIN_SIDE_PANEL_WIDTH);
    expect(clampSidePanelWidth(900, 1440)).toBe(MAX_SIDE_PANEL_WIDTH);
  });

  it("preserves workbench space on narrower desktop viewports", () => {
    expect(getMaximumSidePanelWidth(840)).toBe(480);
    expect(getMaximumSidePanelWidth(830)).toBe(470);
    expect(clampSidePanelWidth(480, 830)).toBe(470);
  });
});
