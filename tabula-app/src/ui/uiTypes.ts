export type CenterPopover = "view" | null;
export type TopPopover = "plus" | "share" | null;
export type LeftPanelView = "files";
export type RightPanelView =
  | "outline"
  | "links"
  | "comments"
  | "properties";

export type KeyboardShortcut = {
  keys: string;
  action: string;
};
