import { describe, expect, it } from "vitest";
import { buildDocumentControlsModel } from "@tabula-md/tabula";
import { getWorkspaceChromeCopy } from "./workspaceLocale";

const copy = getWorkspaceChromeCopy("en").documentControls;

describe("document controls model", () => {
  it("switches edit mode actions to split and preview", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: true,
      activeLineWrapping: true,
      activeReadingWidth: "wide",
      activeViewMode: "edit",
      canCopyFile: true,
      copy,
    });

    expect(model.controlsLabel).toBe("Editor controls");
    expect(model.showEditorToggles).toBe(true);
    expect(model.viewModeActions).toEqual([
      {
        icon: "split",
        label: "Split",
        slot: "split",
        viewMode: "split",
      },
      {
        icon: "preview",
        label: "Preview",
        slot: "edit-preview",
        viewMode: "preview",
      },
    ]);
  });

  it("switches split mode back to edit while keeping preview available", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: true,
      activeLineWrapping: true,
      activeReadingWidth: "standard",
      activeViewMode: "split",
      canCopyFile: true,
      copy,
    });

    expect(model.controlsLabel).toBe("Layout controls");
    expect(model.viewModeActions.map((action) => action.viewMode)).toEqual([
      "edit",
      "preview",
    ]);
  });

  it("switches preview mode back to edit and hides editor toggles", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: false,
      activeLineWrapping: false,
      activeReadingWidth: "narrow",
      activeViewMode: "preview",
      canCopyFile: false,
      copy,
    });

    expect(model.controlsLabel).toBe("View controls");
    expect(model.copyButtonTitle).toBe("Add content to copy");
    expect(model.showEditorToggles).toBe(false);
    expect(model.viewModeActions.map((action) => action.viewMode)).toEqual([
      "split",
      "edit",
    ]);
  });

  it("marks exactly one reading width option as active", () => {
    const model = buildDocumentControlsModel({
      activeLineNumbers: true,
      activeLineWrapping: true,
      activeReadingWidth: "standard",
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
