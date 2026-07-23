import { describe, expect, it } from "vitest";
import {
  clampRightPanelWidth,
  getMaximumRightPanelWidth,
  MIN_RIGHT_PANEL_WIDTH,
} from "./RightPanelDivider";

describe("right panel divider width", () => {
  it("keeps the right panel within its desktop bounds", () => {
    expect(clampRightPanelWidth(100, 1440)).toBe(MIN_RIGHT_PANEL_WIDTH);
    expect(getMaximumRightPanelWidth(1440)).toBe(1080);
    expect(clampRightPanelWidth(1200, 1440)).toBe(1080);
  });

  it("preserves workbench space on narrower desktop viewports", () => {
    expect(getMaximumRightPanelWidth(840)).toBe(480);
    expect(getMaximumRightPanelWidth(830)).toBe(470);
    expect(clampRightPanelWidth(480, 830)).toBe(470);
  });

  it("expands with large viewports instead of applying a fixed cap", () => {
    expect(getMaximumRightPanelWidth(1920)).toBe(1560);
    expect(getMaximumRightPanelWidth(2560)).toBe(2200);
  });
});
