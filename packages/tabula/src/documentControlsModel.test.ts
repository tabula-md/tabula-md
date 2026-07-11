import { describe, expect, it } from "vitest";
import {
  buildDocumentControlsModel,
  type DocumentControlsCopy,
} from "./documentControlsModel";

const copy: DocumentControlsCopy = {
  copyCurrentFile: "Copy current file",
  copyFile: "Copy file",
  documentControlsLabel: "Document controls",
  edit: "Edit",
  editorControls: "Editor controls",
  fillWidth: "Fill",
  focusWidth: "Focus",
  layoutControls: "Layout controls",
  lineNumbers: "Line Numbers",
  lineWrapping: "Line Wrapping",
  nothingToCopy: "Add content to copy",
  preview: "Preview",
  search: "Search",
  split: "Split",
  standardWidth: "Standard",
  syncScrolling: "Sync Scrolling",
  textWidth: "Text Width",
  viewControls: "View controls",
};

describe("document controls model", () => {
  it("keeps all view modes stable and selects edit", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: true,
      activeLineWrapping: true,
      activeReadingWidth: "wide",
      activeSyncScrolling: true,
      activeViewMode: "edit",
      canCopyFile: true,
      copy,
    });

    expect(model.controlsLabel).toBe("Editor controls");
    expect(model.showEditorToggles).toBe(true);
    expect(model.showSplitToggles).toBe(false);
    expect(model.viewModeOptions).toEqual([
      {
        active: true,
        icon: "edit",
        label: "Edit",
        viewMode: "edit",
      },
      {
        active: false,
        icon: "split",
        label: "Split",
        viewMode: "split",
      },
      {
        active: false,
        icon: "preview",
        label: "Preview",
        viewMode: "preview",
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
      canCopyFile: true,
      copy,
    });

    expect(model.controlsLabel).toBe("Layout controls");
    expect(model.showSplitToggles).toBe(true);
    expect(model.syncScrolling).toEqual({
      active: false,
      label: "Sync Scrolling",
    });
    expect(model.viewModeOptions.map((option) => option.viewMode)).toEqual(["edit", "split", "preview"]);
    expect(model.viewModeOptions.map((option) => option.active)).toEqual([false, true, false]);
  });

  it("selects preview and hides editor toggles", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: false,
      activeLineWrapping: false,
      activeReadingWidth: "narrow",
      activeSyncScrolling: true,
      activeViewMode: "preview",
      canCopyFile: false,
      copy,
    });

    expect(model.controlsLabel).toBe("View controls");
    expect(model.copyButtonTitle).toBe("Add content to copy");
    expect(model.showEditorToggles).toBe(false);
    expect(model.showSplitToggles).toBe(false);
    expect(model.viewModeOptions.map((option) => option.viewMode)).toEqual(["edit", "split", "preview"]);
    expect(model.viewModeOptions.map((option) => option.active)).toEqual([false, false, true]);
  });

  it("marks exactly one reading width option as active", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: true,
      activeLineWrapping: true,
      activeReadingWidth: "standard",
      activeSyncScrolling: true,
      activeViewMode: "edit",
      canCopyFile: true,
      copy,
    });

    expect(model.readingWidthOptions).toEqual([
      { active: false, label: "Focus", readingWidth: "narrow" },
      { active: true, label: "Standard", readingWidth: "standard" },
      { active: false, label: "Fill", readingWidth: "wide" },
    ]);
  });
});
