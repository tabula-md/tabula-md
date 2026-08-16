export type CenterPopover = "view" | null;
export type TopPopover = "plus" | "share" | null;
export type LeftPanelView = "files" | "libraries";
export type RightPanelView =
  | "outline"
  | "links"
  | "comments"
  | "properties"
  | "knowledge";

export type KeyboardShortcut = {
  keys: string;
  action: string;
};
