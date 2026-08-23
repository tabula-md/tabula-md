import {
  READING_WIDTHS,
  getEditingModeViewMode,
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

export type DocumentEditingModeOption = {
  active: boolean;
  editingMode: FileEditingMode;
  icon: Extract<DocumentViewModeIcon, "edit" | "visual">;
  label: string;
  viewMode: Extract<FileViewMode, "edit" | "visual">;
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
  editingModeLabel: string;
  editingModeOptions: DocumentEditingModeOption[];
  lineNumbers: DocumentToggleControl;
  lineWrapping: DocumentToggleControl;
  readingWidthLabel: string;
  readingWidthOptions: DocumentReadingWidthOption[];
  searchLabel: string;
  showEditorToggles: boolean;
  showSplitToggles: boolean;
  sourceOptionsLabel: string;
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

const getEditingModeOptions = (
  activeEditingMode: FileEditingMode,
  copy: DocumentControlsCopy,
): DocumentEditingModeOption[] => [
  {
    active: activeEditingMode === "visual",
    editingMode: "visual",
    icon: "visual",
    label: copy.visual,
    viewMode: "visual",
  },
  {
    active: activeEditingMode === "source",
    editingMode: "source",
    icon: "edit",
    label: copy.source,
    viewMode: "edit",
  },
];

const getViewModeOptions = (
  activeEditingMode: FileEditingMode,
  activeViewMode: FileViewMode,
  copy: DocumentControlsCopy,
): DocumentViewModeOption[] => {
  const editorViewMode = getEditingModeViewMode(activeEditingMode);
  const options: DocumentViewModeOption[] = [
    {
      active: activeViewMode === editorViewMode,
      icon: activeEditingMode === "visual" ? "visual" : "edit",
      label: copy.editor,
      viewMode: editorViewMode,
    },
  ];

  options.push({
    active: activeViewMode === "split",
    icon: "split",
    label: copy.split,
    viewMode: "split",
  });

  options.push({
    active: activeViewMode === "preview",
    icon: "preview",
    label: copy.preview,
    viewMode: "preview",
  });

  return options;
};

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
    editingModeLabel: copy.editingMode,
    editingModeOptions: getEditingModeOptions(activeEditingMode, copy),
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
    syncScrolling: {
      active: activeSyncScrolling,
      label: copy.syncScrolling,
    },
    viewModeLabel: copy.viewControls,
    layoutLabel: copy.layoutControls,
    viewModeOptions: getViewModeOptions(
      activeEditingMode,
      activeViewMode,
      copy,
    ),
  };
};
