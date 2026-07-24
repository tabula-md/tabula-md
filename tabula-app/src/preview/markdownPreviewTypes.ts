import type {
  DocumentHeadingAnalysis,
  DocumentLinkRelation,
  DocumentLinkSyntax,
  LineSurfaceAnnotation,
  TextChange,
} from "@tabula-md/tabula";
import type { SearchOptions } from "../editor/editorSearchModel";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";

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

export type MarkdownPreviewWorkspaceLink =
  | {
      status: "resolved";
      relation: DocumentLinkRelation;
      syntax: DocumentLinkSyntax;
      targetDocumentId: string;
      targetPath?: string;
      fragment?: string;
      sourceLineNumber?: number;
    }
  | {
      status: "broken" | "ambiguous";
      relation: DocumentLinkRelation;
      syntax: DocumentLinkSyntax;
      targetPath?: string;
    };

export type MarkdownPreviewWorkspaceDocument = {
  id: string;
  path: string;
  markdown: string;
  headings: readonly DocumentHeadingAnalysis[];
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
  onOpenWorkspaceLink?: (
    link: Extract<MarkdownPreviewWorkspaceLink, { status: "resolved" }>,
  ) => void;
  sourceDocumentId?: string;
  resolveWorkspaceDocument?: (
    documentId: string,
  ) => MarkdownPreviewWorkspaceDocument | undefined;
  resolveWorkspaceLink?: (
    target: string,
    syntax?: DocumentLinkSyntax,
    context?: {
      relation?: DocumentLinkRelation;
      sourceDocumentId?: string;
    },
  ) => MarkdownPreviewWorkspaceLink | undefined;
  onToggleTaskLine?: (sourceLineIndex: number) => void;
};
