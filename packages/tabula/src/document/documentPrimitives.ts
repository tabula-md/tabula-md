export const READING_WIDTHS = ["narrow", "standard", "wide"] as const;
export const FILE_VIEW_MODES = ["edit", "split", "preview"] as const;

export type ReadingWidth = (typeof READING_WIDTHS)[number];
export type FileViewMode = (typeof FILE_VIEW_MODES)[number];

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
