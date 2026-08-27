import { describe, expect, it } from "vitest";
import {
  MODAL_ACCESSIBILITY,
  SIDE_PANEL_OVERLAY_ACCESSIBILITY,
} from "./overlayAccessibility";

describe("overlay accessibility policies", () => {
  it("makes true modals own the whole application focus boundary", () => {
    expect(MODAL_ACCESSIBILITY).toMatchObject({
      ariaModal: true,
      inertScope: "application",
      trapFocus: true,
    });
  });

  it("keeps the app bar available while a compact side panel covers the workbench", () => {
    expect(SIDE_PANEL_OVERLAY_ACCESSIBILITY).toMatchObject({
      ariaModal: false,
      inertScope: "workbench",
      trapFocus: false,
    });
  });
});
