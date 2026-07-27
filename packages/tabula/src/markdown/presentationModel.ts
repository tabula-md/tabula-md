export type SourceRange = {
  from: number;
  to: number;
};

export type PresentationBlockType =
  | "accordion"
  | "blank-line"
  | "blockquote"
  | "callout"
  | "code-block"
  | "diagram"
  | "display-math"
  | "footnote-definition"
  | "frontmatter"
  | "heading"
  | "html"
  | "image"
  | "list-item"
  | "ordered-list"
  | "paragraph"
  | "raw"
  | "reference-definition"
  | "tab"
  | "table"
  | "table-cell"
  | "table-row"
  | "tabs"
  | "thematic-break"
  | "unordered-list";

export type PresentationInlineType =
  | "emphasis"
  | "footnote-reference"
  | "html-inline"
  | "image"
  | "inline-code"
  | "inline-math"
  | "line-break"
  | "link"
  | "raw"
  | "strikethrough"
  | "strong"
  | "text";

export type PresentationNodeType =
  | PresentationBlockType
  | PresentationInlineType;

export type PresentationArrowNavigation =
  | "block"
  | "content"
  | "line";

export type BlockInteractionPolicy = {
  arrowNavigation: PresentationArrowNavigation;
  atomicWhenInactive: boolean;
  revealSourceWhenActive: boolean;
};

export type PresentationPlacement =
  | "document-end"
  | "source-position";

export type PresentationNodeData = {
  alignments?: ReadonlyArray<"center" | "left" | "right" | null>;
  alt?: string;
  attributes?: Readonly<Record<string, string>>;
  checked?: boolean | null;
  depth?: 1 | 2 | 3 | 4 | 5 | 6;
  identifier?: string;
  language?: string;
  linkKind?: PresentationLinkKind;
  ordered?: boolean;
  start?: number | null;
  text?: string;
  title?: string | null;
  url?: string;
};

export type PresentationNode = {
  children: readonly PresentationNode[];
  contentRange?: SourceRange;
  data?: PresentationNodeData;
  id: string;
  markerRanges: readonly SourceRange[];
  range: SourceRange;
  type: PresentationNodeType;
};

export type PresentationBlock = PresentationNode & {
  interaction: BlockInteractionPolicy;
  placement: PresentationPlacement;
  type: PresentationBlockType;
};

export type PresentationLinkKind =
  | "external"
  | "internal-document"
  | "internal-heading";

export type PresentationLinkReference = {
  definitionIdentifier?: string;
  kind: PresentationLinkKind;
  label: string;
  range: SourceRange;
  target: string;
};

export type PresentationReferenceDefinition = {
  identifier: string;
  range: SourceRange;
  title?: string | null;
  url: string;
};

export type PresentationFootnoteReference = {
  occurrence: number;
  range: SourceRange;
};

export type PresentationFootnoteStatus =
  | "missing"
  | "resolved"
  | "unused";

export type PresentationFootnote = {
  definitionBody?: string;
  definitionRange?: SourceRange;
  identifier: string;
  index: number;
  references: readonly PresentationFootnoteReference[];
  status: PresentationFootnoteStatus;
};

export type ReferenceIndex = {
  definitions: readonly PresentationReferenceDefinition[];
  footnotes: readonly PresentationFootnote[];
  links: readonly PresentationLinkReference[];
};

export type MarkdownPresentationDocument = {
  blocks: readonly PresentationBlock[];
  references: ReferenceIndex;
  source: string;
};
