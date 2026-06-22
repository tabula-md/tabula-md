export type CenterPopover = "view" | null;
export type TopPopover = "plus" | "share" | null;
export type LeftPanelView = "new" | "templates" | "agent";
export type RightPanelView = "outline" | "comments" | "files";
export type SharePanel = "collaborate" | "send" | "publish";

export type KeyboardShortcut = {
  keys: string;
  action: string;
};
