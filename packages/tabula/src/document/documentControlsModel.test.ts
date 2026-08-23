import { describe, expect, it } from "vitest";
import {
  buildDocumentControlsModel,
  type DocumentControlsCopy,
} from "./documentControlsModel";

const copy: DocumentControlsCopy = {
  documentControlsLabel: "Document controls",
  editingMode: "Editing mode",
  editor: "Editor",
  editorControls: "Editor controls",
  fillWidth: "Fill",
  focusWidth: "Focus",
  lineNumbers: "Line Numbers",
  lineWrapping: "Line Wrapping",
  layoutControls: "Layout",
  preview: "Read",
  search: "Search",
  source: "Source",
  split: "Split",
  standardWidth: "Standard",
  syncScrolling: "Sync Scrolling",
  sourceOptions: "Source options",
  sourcePreview: "Preview alongside source",
  textWidth: "Text Width",
  viewControls: "View",
  visual: "Write",
};

const buildModel = (
  activeEditingMode: "visual" | "source",
  activeViewMode: "visual" | "edit" | "split" | "preview",
) =>
  buildDocumentControlsModel({
    activeEditingMode,
    activeLineNumbers: true,
    activeLineWrapping: true,
    activeReadingWidth: "wide",
    activeSyncScrolling: true,
    activeViewMode,
    copy,
  });

describe("document controls model", () => {
  it("offers Write, Source, and Read as task-level modes", () => {
    const model = buildModel("visual", "visual");

    expect(model.controlsLabel).toBe("Editor controls");
    expect(model.viewModeLabel).toBe("View");
    expect(model.sourceOptionsLabel).toBe("Source options");
    expect(model.layoutLabel).toBe("Layout");
    expect(model.viewModeOptions).toEqual([
      {
        active: true,
        icon: "visual",
        label: "Write",
        viewMode: "visual",
      },
      {
        active: false,
        icon: "edit",
        label: "Source",
        viewMode: "edit",
      },
      {
        active: false,
        icon: "preview",
        label: "Read",
        viewMode: "preview",
      },
    ]);
    expect(model.showEditorToggles).toBe(false);
  });

  it("marks Read as the active task without exposing a split mode", () => {
    const model = buildModel("visual", "preview");

    expect(model.viewModeOptions.map(({ active, viewMode }) => ({ active, viewMode }))).toEqual([
      { active: false, viewMode: "visual" },
      { active: false, viewMode: "edit" },
      { active: true, viewMode: "preview" },
    ]);
    expect(model.showEditorToggles).toBe(false);
  });

  it("marks Source as the active task", () => {
    const model = buildModel("source", "edit");

    expect(model.viewModeOptions.map(({ active, viewMode }) => ({ active, viewMode }))).toEqual([
      { active: false, viewMode: "visual" },
      { active: true, viewMode: "edit" },
      { active: false, viewMode: "preview" },
    ]);
  });

  it("keeps Source active while its alongside preview is enabled", () => {
    const model = buildModel("source", "split");

    expect(model.viewModeOptions.map(({ active, viewMode }) => ({ active, viewMode }))).toEqual([
      { active: false, viewMode: "visual" },
      { active: true, viewMode: "edit" },
      { active: false, viewMode: "preview" },
    ]);
    expect(model.showSplitToggles).toBe(true);
    expect(model.sourcePreview).toEqual({
      active: true,
      label: "Preview alongside source",
    });
  });

  it("marks exactly one reading width option as active", () => {
    const model = buildDocumentControlsModel({
      activeEditingMode: "source",
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
