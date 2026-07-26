import { describe, expect, it } from "vitest";
import {
  buildDocumentControlsModel,
  type DocumentControlsCopy,
} from "./documentControlsModel";

const copy: DocumentControlsCopy = {
  documentControlsLabel: "Document controls",
  edit: "Edit",
  editorControls: "Editor controls",
  fillWidth: "Fill",
  focusWidth: "Focus",
  layoutControls: "Layout controls",
  lineNumbers: "Line Numbers",
  lineWrapping: "Line Wrapping",
  preview: "Preview",
  search: "Search",
  split: "Split",
  standardWidth: "Standard",
  syncScrolling: "Sync Scrolling",
  textWidth: "Text Width",
  visual: "Visual",
  viewControls: "View controls",
};

describe("document controls model", () => {
  it("offers Visual before the source and reading modes", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: true,
      activeLineWrapping: true,
      activeReadingWidth: "wide",
      activeSyncScrolling: true,
      activeViewMode: "visual",
      copy,
    });

    expect(model.viewModeOptions.map((option) => option.viewMode)).toEqual([
      "visual",
      "edit",
      "preview",
      "split",
    ]);
    expect(model.viewModeOptions.map((option) => option.active)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("keeps all view modes stable and selects edit", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: true,
      activeLineWrapping: true,
      activeReadingWidth: "wide",
      activeSyncScrolling: true,
      activeViewMode: "edit",
      copy,
    });

    expect(model.controlsLabel).toBe("Editor controls");
    expect(model.showEditorToggles).toBe(true);
    expect(model.showSplitToggles).toBe(false);
    expect(model.viewModeOptions).toEqual([
      {
        active: false,
        icon: "visual",
        label: "Visual",
        viewMode: "visual",
      },
      {
        active: true,
        icon: "edit",
        label: "Edit",
        viewMode: "edit",
      },
      {
        active: false,
        icon: "preview",
        label: "Preview",
        viewMode: "preview",
      },
      {
        active: false,
        icon: "split",
        label: "Split",
        viewMode: "split",
      },
    ]);
  });

  it("selects split without changing the view-mode order", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: true,
      activeLineWrapping: true,
      activeReadingWidth: "standard",
      activeSyncScrolling: false,
      activeViewMode: "split",
      copy,
    });

    expect(model.controlsLabel).toBe("Layout controls");
    expect(model.showSplitToggles).toBe(true);
    expect(model.syncScrolling).toEqual({
      active: false,
      label: "Sync Scrolling",
    });
    expect(model.viewModeOptions.map((option) => option.viewMode)).toEqual([
      "visual",
      "edit",
      "preview",
      "split",
    ]);
    expect(model.viewModeOptions.map((option) => option.active)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("selects preview and hides editor toggles", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: false,
      activeLineWrapping: false,
      activeReadingWidth: "narrow",
      activeSyncScrolling: true,
      activeViewMode: "preview",
      copy,
    });

    expect(model.controlsLabel).toBe("View controls");
    expect(model.showEditorToggles).toBe(false);
    expect(model.showSplitToggles).toBe(false);
    expect(model.viewModeOptions.map((option) => option.viewMode)).toEqual([
      "visual",
      "edit",
      "preview",
      "split",
    ]);
    expect(model.viewModeOptions.map((option) => option.active)).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it("marks exactly one reading width option as active", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: true,
      activeLineWrapping: true,
      activeReadingWidth: "standard",
      activeSyncScrolling: true,
      activeViewMode: "edit",
      copy,
    });

    expect(model.readingWidthOptions).toEqual([
      { active: false, label: "Focus", readingWidth: "narrow" },
      { active: true, label: "Standard", readingWidth: "standard" },
      { active: false, label: "Fill", readingWidth: "wide" },
    ]);
  });
});
