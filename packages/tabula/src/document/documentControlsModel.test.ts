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
  preview: "Preview",
  search: "Search",
  source: "Source edit",
  split: "Split",
  standardWidth: "Standard",
  syncScrolling: "Sync Scrolling",
  sourceOptions: "Source options",
  textWidth: "Text Width",
  viewControls: "View",
  visual: "Visual edit",
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
  it("offers Visual edit and Preview for visual editing", () => {
    const model = buildModel("visual", "visual");

    expect(model.controlsLabel).toBe("Editor controls");
    expect(model.editingModeLabel).toBe("Editing mode");
    expect(model.viewModeLabel).toBe("View");
    expect(model.sourceOptionsLabel).toBe("Source options");
    expect(model.layoutLabel).toBe("Layout");
    expect(model.editingModeOptions).toEqual([
      {
        active: true,
        editingMode: "visual",
        icon: "visual",
        label: "Visual edit",
        viewMode: "visual",
      },
      {
        active: false,
        editingMode: "source",
        icon: "edit",
        label: "Source edit",
        viewMode: "edit",
      },
    ]);
    expect(model.viewModeOptions).toEqual([
      {
        active: true,
        icon: "visual",
        label: "Editor",
        viewMode: "visual",
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
    expect(model.showEditorToggles).toBe(false);
  });

  it("keeps Visual as the return editor while Preview is active", () => {
    const model = buildModel("visual", "preview");

    expect(model.editingModeOptions[0]?.active).toBe(true);
    expect(model.viewModeOptions.map(({ active, viewMode }) => ({ active, viewMode }))).toEqual([
      { active: false, viewMode: "visual" },
      { active: false, viewMode: "split" },
      { active: true, viewMode: "preview" },
    ]);
    expect(model.showEditorToggles).toBe(false);
  });

  it("offers Source edit, Split, and Preview for source editing", () => {
    const model = buildModel("source", "edit");

    expect(model.viewModeOptions.map(({ active, viewMode }) => ({ active, viewMode }))).toEqual([
      { active: true, viewMode: "edit" },
      { active: false, viewMode: "split" },
      { active: false, viewMode: "preview" },
    ]);
  });

  it("marks Split active and exposes sync scrolling", () => {
    const model = buildModel("source", "split");

    expect(model.viewModeOptions.map(({ active, viewMode }) => ({ active, viewMode }))).toEqual([
      { active: false, viewMode: "edit" },
      { active: true, viewMode: "split" },
      { active: false, viewMode: "preview" },
    ]);
    expect(model.showSplitToggles).toBe(true);
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
