export type OverlayAccessibilityPolicy = {
  ariaModal: boolean;
  inertScope: "application" | "workbench";
  role: "dialog";
  trapFocus: boolean;
};

export const MODAL_ACCESSIBILITY: OverlayAccessibilityPolicy = {
  ariaModal: true,
  inertScope: "application",
  role: "dialog",
  trapFocus: true,
};

// Compact side panels cover and disable the document, but the persistent app
// bar remains operable so users can switch or close panels in one step.
export const SIDE_PANEL_OVERLAY_ACCESSIBILITY: OverlayAccessibilityPolicy = {
  ariaModal: false,
  inertScope: "workbench",
  role: "dialog",
  trapFocus: false,
};
