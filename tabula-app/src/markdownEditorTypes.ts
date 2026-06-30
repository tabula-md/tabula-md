import type { Collaborator, LiveSelection } from "./collaboration";
import type {
  MarkdownFormatCommand,
  SearchMatch,
  TextChange,
  TextPatch,
} from "@tabula-md/tabula";

export type MarkdownEditorHandle = {
  canRedo: () => boolean;
  canUndo: () => boolean;
  format: (command: MarkdownFormatCommand) => boolean;
  focus: (options?: FocusOptions) => void;
  getScrollRatio: () => number;
  getSelectionRange: () => { from: number; to: number };
  getSelectedText: () => string;
  applyRemoteTextChange: (nextValue: string, patches?: TextPatch[]) => void;
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
  fileTitle?: string;
  roomId?: string;
  value: string;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks?: MarkdownBookmark[];
  commentAnchors?: MarkdownCommentAnchor[];
  commentsEnabled?: boolean;
  collaborators?: Collaborator[];
  activeCommentId?: string | null;
  searchMatches?: SearchMatch[];
  activeSearchMatchIndex?: number;
  onChange: (nextValue: string, change?: TextChange) => void;
  onBookmarksChange?: (bookmarks: MarkdownBookmark[]) => void;
  onHistoryStateChange?: (historyState: { canUndo: boolean; canRedo: boolean }) => void;
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void;
  onOpenComment?: (commentId: string) => void;
  onSelectionChange?: (selection: LiveSelection) => void;
  onSelectionActionPositionChange?: (position: MarkdownSelectionActionPosition | null) => void;
  onScrollRatioChange?: (ratio: number) => void;
};
