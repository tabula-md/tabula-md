import { describe, expect, it } from "vitest";
import {
  clampSidePanelWidth,
  getMaximumSidePanelWidth,
  MIN_SIDE_PANEL_WIDTH,
} from "../workspace/components/sidePanelModel";

describe("right panel divider width", () => {
  it("keeps the right panel within its desktop bounds", () => {
    expect(clampSidePanelWidth(100, 1440)).toBe(MIN_SIDE_PANEL_WIDTH);
    expect(getMaximumSidePanelWidth(1440)).toBe(1080);
    expect(clampSidePanelWidth(1200, 1440)).toBe(1080);
  });

  it("preserves workbench space on narrower desktop viewports", () => {
    expect(getMaximumSidePanelWidth(840)).toBe(480);
    expect(getMaximumSidePanelWidth(830)).toBe(470);
    expect(clampSidePanelWidth(480, 830)).toBe(470);
  });

  it("expands with large viewports instead of applying a fixed cap", () => {
    expect(getMaximumSidePanelWidth(1920)).toBe(1560);
    expect(getMaximumSidePanelWidth(2560)).toBe(2200);
  });
});
