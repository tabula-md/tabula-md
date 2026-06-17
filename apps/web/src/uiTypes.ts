export type CenterPopover = "search" | "view" | null;
export type TopPopover = "share" | null;
export type LeftPanelView = "menu" | "templates" | "settings" | "shortcuts";
export type RightPanelView = "outline" | "comments" | "files";

export type KeyboardShortcut = {
  keys: string;
  action: string;
};

export type LibraryItem = {
  title: string;
  description: string;
  content: string;
};
