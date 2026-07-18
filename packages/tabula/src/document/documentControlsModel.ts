import {
  READING_WIDTHS,
  type FileViewMode,
  type ReadingWidth,
} from "./documentPrimitives";

export type DocumentControlsCopy = {
  documentControlsLabel: string;
  edit: string;
  editorControls: string;
  fillWidth: string;
  focusWidth: string;
  layoutControls: string;
  lineNumbers: string;
  lineWrapping: string;
  preview: string;
  search: string;
  split: string;
  standardWidth: string;
  syncScrolling: string;
  textWidth: string;
  viewControls: string;
};

export type DocumentViewModeIcon = "edit" | "preview" | "split";

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
  syncScrolling: DocumentToggleControl;
  viewModeLabel: string;
  viewModeOptions: DocumentViewModeOption[];
};

export type DocumentControlsModelInput = {
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activeReadingWidth: ReadingWidth;
  activeSyncScrolling: boolean;
  activeViewMode: FileViewMode;
  copy: DocumentControlsCopy;
};

const getControlsLabel = (
  activeViewMode: FileViewMode,
  copy: DocumentControlsCopy,
) => {
  if (activeViewMode === "preview") {
    return copy.viewControls;
  }

  if (activeViewMode === "split") {
    return copy.layoutControls;
  }

  return copy.editorControls;
};

const getViewModeOptions = (
  activeViewMode: FileViewMode,
  copy: DocumentControlsCopy,
): DocumentViewModeOption[] => [
  { active: activeViewMode === "edit", icon: "edit", label: copy.edit, viewMode: "edit" },
  { active: activeViewMode === "split", icon: "split", label: copy.split, viewMode: "split" },
  { active: activeViewMode === "preview", icon: "preview", label: copy.preview, viewMode: "preview" },
];

export const buildDocumentControlsModel = ({
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
    controlsLabel: getControlsLabel(activeViewMode, copy),
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
    showEditorToggles: activeViewMode !== "preview",
    showSplitToggles: activeViewMode === "split",
    syncScrolling: {
      active: activeSyncScrolling,
      label: copy.syncScrolling,
    },
    viewModeLabel: `${copy.documentControlsLabel}: ${copy.edit}, ${copy.split}, ${copy.preview}`,
    viewModeOptions: getViewModeOptions(activeViewMode, copy),
  };
};
