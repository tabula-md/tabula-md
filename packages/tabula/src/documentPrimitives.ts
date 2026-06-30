export const READING_WIDTHS = ["narrow", "standard", "wide"] as const;
export const FILE_VIEW_MODES = ["edit", "split", "preview"] as const;

export type ReadingWidth = (typeof READING_WIDTHS)[number];
export type FileViewMode = (typeof FILE_VIEW_MODES)[number];
