import type { LiveSelection } from "./collab";
import type { SearchMatch } from "./markdown";
import type { MarkdownFormatCommand } from "./markdownFormatting";

export type MarkdownEditorHandle = {
  canRedo: () => boolean;
  canUndo: () => boolean;
  format: (command: MarkdownFormatCommand) => boolean;
  focus: () => void;
  getScrollRatio: () => number;
  getSelectionRange: () => { from: number; to: number };
  getSelectedText: () => string;
  revealRange: (from: number, to?: number) => void;
  scrollToRatio: (ratio: number) => void;
  setSelectionRange: (from: number, to?: number) => void;
  undo: () => boolean;
  redo: () => boolean;
};

export type MarkdownCommentAnchor = {
  id: string;
  start: number;
  end: number;
};

export type MarkdownBookmark = {
  id: string;
  position: number;
  createdAt?: string;
};

export type MarkdownLineActionRequest = {
  action: "bookmark" | "comment";
  lineNumber: number;
  start: number;
  end: number;
  hasBookmark: boolean;
  hasComment: boolean;
};

export type MarkdownSelectionActionPosition = {
  clientX: number;
  clientY: number;
};

export type MarkdownEditorProps = {
  fileId: string;
  value: string;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks?: MarkdownBookmark[];
  commentAnchors?: MarkdownCommentAnchor[];
  activeCommentId?: string | null;
  searchMatches?: SearchMatch[];
  activeSearchMatchIndex?: number;
  onChange: (nextValue: string) => void;
  onBookmarksChange?: (bookmarks: MarkdownBookmark[]) => void;
  onHistoryStateChange?: (historyState: { canUndo: boolean; canRedo: boolean }) => void;
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void;
  onOpenComment?: (commentId: string) => void;
  onSelectionChange?: (selection: LiveSelection) => void;
  onSelectionActionPositionChange?: (position: MarkdownSelectionActionPosition | null) => void;
  onScrollRatioChange?: (ratio: number) => void;
};
