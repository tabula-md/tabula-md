import type {
  MarkdownPreviewProps,
  MarkdownPreviewWorkspaceLink,
} from "../preview/markdownPreviewTypes";

export type EditorVisualModeCopy = {
  frontmatter: string;
  imageFailed: string;
  markTaskComplete: string;
  markTaskIncomplete: string;
};

export type EditorVisualModeOptions = {
  resolveWorkspaceLink?: MarkdownPreviewProps["resolveWorkspaceLink"];
  sourceDocumentId?: string;
};

export type EditorVisualWorkspaceLinkRange = {
  from: number;
  status: MarkdownPreviewWorkspaceLink["status"] | "external" | "heading";
  to: number;
};
