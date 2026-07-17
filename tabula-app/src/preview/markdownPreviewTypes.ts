import type {
  LineSurfaceAnnotation,
  TextChange,
} from "@tabula-md/tabula";
import type { SearchOptions } from "../editor/editorSearchModel";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";

export type MarkdownPreviewMetadata = {
  key: string;
  value: string;
};

export type MarkdownPreviewCommentAnchor = {
  id: string;
  start: number;
  end: number;
};

export type MarkdownPreviewLineAnnotation = LineSurfaceAnnotation;

export type MarkdownPreviewLineActionRequest = MarkdownPreviewLineAnnotation & {
  action: "bookmark";
};

export type MarkdownPreviewProps = {
  metadata: MarkdownPreviewMetadata[];
  body: string;
  sourceLineOffset?: number;
  bodyTextChange?: TextChange | null;
  largeDocumentMode?: boolean;
  commentAnchors?: MarkdownPreviewCommentAnchor[];
  lineAnnotations?: MarkdownPreviewLineAnnotation[];
  activeCommentId?: string | null;
  commentsEnabled?: boolean;
  searchQuery?: string;
  searchOptions?: SearchOptions;
  activeSearchMatchIndex?: number;
  suspendLineMeasurement?: boolean;
  uiLanguage?: WorkspaceLanguage;
  onSearchMatchCountChange?: (count: number, truncated?: boolean) => void;
  onLineAction?: (request: MarkdownPreviewLineActionRequest) => void;
  onOpenComment?: (commentId: string) => void;
  onToggleTaskLine?: (sourceLineIndex: number) => void;
};
