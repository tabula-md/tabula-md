import { describe, expect, it } from "vitest";
import {
  clampRightPanelWidth,
  getMaximumRightPanelWidth,
  MAX_RIGHT_PANEL_WIDTH,
  MIN_RIGHT_PANEL_WIDTH,
} from "./RightPanelDivider";

describe("right panel width", () => {
  it("keeps the right panel within its desktop bounds", () => {
    expect(clampRightPanelWidth(100, 1440)).toBe(MIN_RIGHT_PANEL_WIDTH);
    expect(clampRightPanelWidth(900, 1440)).toBe(MAX_RIGHT_PANEL_WIDTH);
  });

  it("preserves workbench space on narrower desktop viewports", () => {
    expect(getMaximumRightPanelWidth(840)).toBe(480);
    expect(getMaximumRightPanelWidth(830)).toBe(470);
    expect(clampRightPanelWidth(480, 830)).toBe(470);
  });
});
