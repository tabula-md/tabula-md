import {
  READING_WIDTHS,
  type FileEditingMode,
  type FileViewMode,
  type ReadingWidth,
} from "./documentPrimitives";

export type DocumentControlsCopy = {
  documentControlsLabel: string;
  editingMode: string;
  editor: string;
  editorControls: string;
  fillWidth: string;
  focusWidth: string;
  lineNumbers: string;
  lineWrapping: string;
  layoutControls: string;
  preview: string;
  search: string;
  source: string;
  split: string;
  standardWidth: string;
  syncScrolling: string;
  sourceOptions: string;
  sourcePreview: string;
  textWidth: string;
  viewControls: string;
  visual: string;
};

export type DocumentViewModeIcon = "edit" | "preview" | "split" | "visual";

export type DocumentViewModeOption = {
  active: boolean;
  icon: DocumentViewModeIcon;
  label: string;
  viewMode: FileViewMode;
};

export type DocumentToggleControl = {
  active: boolean;
  label: string;
};

export type DocumentReadingWidthOption = {
  active: boolean;
  label: string;
  readingWidth: ReadingWidth;
};

export type DocumentControlsModel = {
  controlsLabel: string;
  documentControlsLabel: string;
  lineNumbers: DocumentToggleControl;
  lineWrapping: DocumentToggleControl;
  readingWidthLabel: string;
  readingWidthOptions: DocumentReadingWidthOption[];
  searchLabel: string;
  showEditorToggles: boolean;
  showSplitToggles: boolean;
  sourceOptionsLabel: string;
  sourcePreview: DocumentToggleControl;
  syncScrolling: DocumentToggleControl;
  viewModeLabel: string;
  layoutLabel: string;
  viewModeOptions: DocumentViewModeOption[];
};

export type DocumentControlsModelInput = {
  activeEditingMode: FileEditingMode;
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activeReadingWidth: ReadingWidth;
  activeSyncScrolling: boolean;
  activeViewMode: FileViewMode;
  copy: DocumentControlsCopy;
};

const getViewModeOptions = (
  activeViewMode: FileViewMode,
  copy: DocumentControlsCopy,
): DocumentViewModeOption[] => [
  { active: activeViewMode === "visual", icon: "visual", label: copy.visual, viewMode: "visual" },
  {
    active: activeViewMode === "edit" || activeViewMode === "split",
    icon: "edit",
    label: copy.source,
    viewMode: "edit",
  },
  {
    active: activeViewMode === "preview",
    icon: "preview",
    label: copy.preview,
    viewMode: "preview",
  },
];

export const buildDocumentControlsModel = ({
  activeEditingMode,
  activeLineNumbers,
  activeLineWrapping,
  activeReadingWidth,
  activeSyncScrolling,
  activeViewMode,
  copy,
}: DocumentControlsModelInput): DocumentControlsModel => {
  const readingWidthLabels: Record<ReadingWidth, string> = {
    narrow: copy.focusWidth,
    standard: copy.standardWidth,
    wide: copy.fillWidth,
  };

  return {
    controlsLabel: copy.editorControls,
    documentControlsLabel: copy.documentControlsLabel,
    lineNumbers: {
      active: activeLineNumbers,
      label: copy.lineNumbers,
    },
    lineWrapping: {
      active: activeLineWrapping,
      label: copy.lineWrapping,
    },
    readingWidthLabel: copy.textWidth,
    readingWidthOptions: READING_WIDTHS.map((readingWidth) => ({
      active: readingWidth === activeReadingWidth,
      label: readingWidthLabels[readingWidth],
      readingWidth,
    })),
    searchLabel: copy.search,
    showEditorToggles:
      activeEditingMode === "source" && activeViewMode !== "preview",
    showSplitToggles: activeViewMode === "split",
    sourceOptionsLabel: copy.sourceOptions,
    sourcePreview: { active: activeViewMode === "split", label: copy.sourcePreview },
    syncScrolling: {
      active: activeSyncScrolling,
      label: copy.syncScrolling,
    },
    viewModeLabel: copy.viewControls,
    layoutLabel: copy.layoutControls,
    viewModeOptions: getViewModeOptions(activeViewMode, copy),
  };
};
