export type CenterPopover = "view" | null;
export type TopPopover = "plus" | "share" | null;
export type LeftPanelView = "files" | "search" | "review";
export type RightPanelView =
  | "outline"
  | "links"
  | "comments"
  | "metadata";

export type KeyboardShortcut = {
  keys: string;
  action: string;
};
