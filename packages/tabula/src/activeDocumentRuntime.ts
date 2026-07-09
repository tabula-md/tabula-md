import {
  clampSplitEditorRatio,
  DEFAULT_SPLIT_EDITOR_RATIO,
  type FileViewMode,
  type ReadingWidth,
} from "./documentPrimitives";
import {
  getLineStartOffset,
  getOutlineHeadingsFromMarkdown,
  getPreviewBody,
  parseFrontmatter,
  type MarkdownHeading,
  type ParsedFrontmatter,
  type PreviewBody,
} from "./markdown";
import { getMarkdownWordCount } from "./documentMetrics";
import { isLargeMarkdownDocument } from "./previewBlockModel";

export type DocumentBookmark = {
  id: string;
  position: number;
  createdAt: string;
};

export type ActiveDocumentFile = {
  title: string;
  text: string;
  viewMode: FileViewMode;
  readingWidth: ReadingWidth;
  splitRatio?: number;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks?: DocumentBookmark[];
};

export type ActiveDocumentRuntime = {
  bookmarks: DocumentBookmark[];
  canCopy: boolean;
  canFormat: boolean;
  hasFile: boolean;
  lineNumbers: boolean;
  lineWrapping: boolean;
  outlineHeadings: MarkdownHeading[];
  parsedMarkdown: ParsedFrontmatter;
  previewBodyStartOffset: number;
  readingWidth: ReadingWidth;
  renderedPreview: PreviewBody;
  largeDocumentMode: boolean;
  splitRatio: number;
  text: string;
  title: string;
  viewMode: FileViewMode;
  wordCount: number;
};

export type ActiveDocumentEditorRuntime = Omit<
  ActiveDocumentRuntime,
  "outlineHeadings" | "parsedMarkdown" | "previewBodyStartOffset" | "renderedPreview"
>;

export type ActiveDocumentPreviewRuntime = Pick<
  ActiveDocumentRuntime,
  "outlineHeadings" | "parsedMarkdown" | "previewBodyStartOffset" | "renderedPreview"
>;

export type ActiveDocumentRuntimeOptions = {
  text?: string;
  wordCount?: number;
};

const EMPTY_PARSED_MARKDOWN: ParsedFrontmatter = {
  attributes: [],
  body: "",
};

const EMPTY_PREVIEW_BODY: PreviewBody = {
  body: "",
  sourceLineOffset: 0,
};

export const createActiveDocumentEditorRuntime = (
  activeFile?: ActiveDocumentFile,
  options: ActiveDocumentRuntimeOptions = {},
): ActiveDocumentEditorRuntime => {
  const text = options.text ?? activeFile?.text ?? "";
  const viewMode = activeFile?.viewMode ?? "edit";
  const readingWidth = activeFile?.readingWidth ?? "wide";
  const splitRatio = clampSplitEditorRatio(activeFile?.splitRatio ?? DEFAULT_SPLIT_EDITOR_RATIO);
  const lineWrapping = activeFile?.lineWrapping ?? true;
  const lineNumbers = activeFile?.lineNumbers ?? true;
  const bookmarks = activeFile?.bookmarks ?? [];
  const title = activeFile?.title ?? "No file open";
  const wordCount = options.wordCount ?? getMarkdownWordCount(text);
  const hasFile = Boolean(activeFile);
  const largeDocumentMode = isLargeMarkdownDocument(text);

  return {
    bookmarks,
    canCopy: text.trim().length > 0,
    canFormat: hasFile && viewMode !== "preview",
    hasFile,
    largeDocumentMode,
    lineNumbers,
    lineWrapping,
    readingWidth,
    splitRatio,
    text,
    title,
    viewMode,
    wordCount,
  };
};

export const createActiveDocumentPreviewRuntime = (
  activeFile?: Pick<ActiveDocumentFile, "text">,
  options: Pick<ActiveDocumentRuntimeOptions, "text"> = {},
): ActiveDocumentPreviewRuntime => {
  const text = options.text ?? activeFile?.text ?? "";

  if (!activeFile) {
    return {
      outlineHeadings: [],
      parsedMarkdown: EMPTY_PARSED_MARKDOWN,
      previewBodyStartOffset: 0,
      renderedPreview: EMPTY_PREVIEW_BODY,
    };
  }

  const parsedMarkdown = parseFrontmatter(text);
  const renderedPreview = getPreviewBody(parsedMarkdown.body);
  const parsedBodyStartOffset = text.indexOf(parsedMarkdown.body);
  const previewBodyStartOffset =
    (parsedBodyStartOffset === -1 ? 0 : parsedBodyStartOffset) +
    getLineStartOffset(parsedMarkdown.body, renderedPreview.sourceLineOffset);
  const outlineHeadings = getOutlineHeadingsFromMarkdown(parsedMarkdown.body);

  return {
    outlineHeadings,
    parsedMarkdown,
    previewBodyStartOffset,
    renderedPreview,
  };
};

export const createActiveDocumentRuntime = (
  activeFile?: ActiveDocumentFile,
  options: ActiveDocumentRuntimeOptions = {},
): ActiveDocumentRuntime => ({
  ...createActiveDocumentEditorRuntime(activeFile, options),
  ...createActiveDocumentPreviewRuntime(activeFile, options),
});
