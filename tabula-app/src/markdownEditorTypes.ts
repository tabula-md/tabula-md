import type { LiveSelection } from "./collaboration";
import type { SearchMatch } from "./editor/editorSearchModel";
import type { EditorViewportAnchor } from "./preview/previewSyncTypes";
import type { Text } from "@codemirror/state";
import type { CollabEditorBinding } from "./collaboration/liveCollaboration";
import type {
  MarkdownFormatCommand,
  TextChange,
  TextPatch,
} from "@tabula-md/tabula";

export type MarkdownEditorHandle = {
  canRedo: () => boolean;
  canUndo: () => boolean;
  format: (command: MarkdownFormatCommand) => boolean;
  focus: (options?: FocusOptions) => void;
  getActiveFormats: () => MarkdownFormatCommand[];
  getLineCount: () => number;
  getScrollRatio: () => number;
  getViewportLineAnchor: () => EditorViewportAnchor | null;
  isScrolledToBottom: () => boolean;
  getSelectionRange: () => { from: number; to: number };
  getSearchDocument: () => Text | null;
  getSelectedText: () => string;
  getViewportLineNumber: () => number | null;
  getValue: () => string;
  applyLocalTextPatches: (
    patches: readonly TextPatch[],
    selection?: { from: number; to: number },
    options?: { focus?: boolean; isolateHistory?: boolean },
  ) => boolean;
  applyRemoteTextChange: (nextValue: string, patches?: TextPatch[]) => void;
  revealRange: (from: number, to?: number) => void;
  scrollToRatio: (ratio: number) => void;
  setSelectionRanges: (ranges: Array<{ from: number; to: number }>) => void;
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
  largeDocumentMode: boolean;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks?: MarkdownBookmark[];
  commentAnchors?: MarkdownCommentAnchor[];
  commentsEnabled?: boolean;
  collaborationBinding?: CollabEditorBinding | null;
  activeCommentId?: string | null;
  searchMatches?: SearchMatch[];
  activeSearchMatchIndex?: number;
  onChange: (nextValue: string | null, change?: TextChange) => void;
  onBookmarksChange?: (bookmarks: MarkdownBookmark[]) => void;
  onHistoryStateChange?: (historyState: { canUndo: boolean; canRedo: boolean }) => void;
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void;
  onOpenComment?: (commentId: string) => void;
  onSelectionChange?: (selection?: LiveSelection) => void;
  onSelectionActionPositionChange?: (position: MarkdownSelectionActionPosition | null) => void;
  onScrollRatioChange?: (ratio: number) => void;
};
