import {
  READING_WIDTHS,
  type FileViewMode,
  type ReadingWidth,
} from "./documentPrimitives";

export type DocumentControlsCopy = {
  copyCurrentFile: string;
  copyFile: string;
  documentControlsLabel: string;
  edit: string;
  editorControls: string;
  fillWidth: string;
  focusWidth: string;
  layoutControls: string;
  lineNumbers: string;
  lineWrapping: string;
  nothingToCopy: string;
  preview: string;
  search: string;
  split: string;
  standardWidth: string;
  syncScrolling: string;
  textWidth: string;
  viewControls: string;
};

export type DocumentViewModeSlot = "split" | "edit-preview";
export type DocumentViewModeIcon = "edit" | "preview" | "split";

export type DocumentViewModeAction = {
  icon: DocumentViewModeIcon;
  label: string;
  slot: DocumentViewModeSlot;
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
  copyButtonAriaLabel: string;
  copyButtonTitle: string;
  documentControlsLabel: string;
  lineNumbers: DocumentToggleControl;
  lineWrapping: DocumentToggleControl;
  readingWidthLabel: string;
  readingWidthOptions: DocumentReadingWidthOption[];
  searchLabel: string;
  showEditorToggles: boolean;
  showSplitToggles: boolean;
  syncScrolling: DocumentToggleControl;
  viewModeActions: DocumentViewModeAction[];
};

export type DocumentControlsModelInput = {
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activeReadingWidth: ReadingWidth;
  activeSyncScrolling: boolean;
  activeViewMode: FileViewMode;
  canCopyFile: boolean;
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

const getViewModeActions = (
  activeViewMode: FileViewMode,
  copy: DocumentControlsCopy,
): DocumentViewModeAction[] => [
  activeViewMode === "split"
    ? {
        icon: "edit",
        label: copy.edit,
        slot: "split",
        viewMode: "edit",
      }
    : {
        icon: "split",
        label: copy.split,
        slot: "split",
        viewMode: "split",
      },
  activeViewMode === "preview"
    ? {
        icon: "edit",
        label: copy.edit,
        slot: "edit-preview",
        viewMode: "edit",
      }
    : {
        icon: "preview",
        label: copy.preview,
        slot: "edit-preview",
        viewMode: "preview",
      },
];

export const buildDocumentControlsModel = ({
  activeLineNumbers,
  activeLineWrapping,
  activeReadingWidth,
  activeSyncScrolling,
  activeViewMode,
  canCopyFile,
  copy,
}: DocumentControlsModelInput): DocumentControlsModel => {
  const readingWidthLabels: Record<ReadingWidth, string> = {
    narrow: copy.focusWidth,
    standard: copy.standardWidth,
    wide: copy.fillWidth,
  };

  return {
    controlsLabel: getControlsLabel(activeViewMode, copy),
    copyButtonAriaLabel: copy.copyCurrentFile,
    copyButtonTitle: canCopyFile ? copy.copyFile : copy.nothingToCopy,
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
    viewModeActions: getViewModeActions(activeViewMode, copy),
  };
};
