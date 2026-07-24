export type CenterPopover = "view" | null;
export type TopPopover = "plus" | "share" | null;
export type LeftPanelView = "new" | "templates" | "agent";
export type RightPanelView = "outline" | "links" | "graph" | "comments" | "files" | "search";

export type KeyboardShortcut = {
  keys: string;
  action: string;
};
