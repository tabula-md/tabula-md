export const READING_WIDTHS = ["narrow", "standard", "wide"] as const;
export const FILE_VIEW_MODES = ["visual", "edit", "split", "preview"] as const;
export const FILE_EDITING_MODES = ["visual", "source"] as const;

export type ReadingWidth = (typeof READING_WIDTHS)[number];
export type FileViewMode = (typeof FILE_VIEW_MODES)[number];
export type FileEditingMode = (typeof FILE_EDITING_MODES)[number];

export const getFileEditingMode = ({
  editingMode,
  viewMode,
}: {
  editingMode?: FileEditingMode;
  viewMode: FileViewMode;
}): FileEditingMode => {
  if (editingMode && FILE_EDITING_MODES.includes(editingMode)) {
    return editingMode;
  }

  return viewMode === "visual" ? "visual" : "source";
};

export const getEditingModeViewMode = (
  editingMode: FileEditingMode,
): Extract<FileViewMode, "visual" | "edit"> =>
  editingMode === "visual" ? "visual" : "edit";

export const DEFAULT_SPLIT_EDITOR_RATIO = 0.5;
export const MIN_SPLIT_EDITOR_RATIO = 0.28;
export const MAX_SPLIT_EDITOR_RATIO = 0.72;

export const clampSplitEditorRatio = (value: unknown) => {
  const numericValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULT_SPLIT_EDITOR_RATIO;

  return Math.min(
    MAX_SPLIT_EDITOR_RATIO,
    Math.max(MIN_SPLIT_EDITOR_RATIO, numericValue),
  );
};
