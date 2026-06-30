import {
  clampSplitEditorRatio,
  DEFAULT_SPLIT_EDITOR_RATIO,
  type FileViewMode,
  type ReadingWidth,
} from "./documentPrimitives";
import {
  getLineStartOffset,
  getOutlineHeadings,
  getPreviewBody,
  parseFrontmatter,
  type MarkdownHeading,
  type ParsedFrontmatter,
  type PreviewBody,
} from "./markdown";
import { getMarkdownWordCount } from "./documentMetrics";

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
  splitRatio: number;
  text: string;
  title: string;
  viewMode: FileViewMode;
  wordCount: number;
};

export const createActiveDocumentRuntime = (activeFile?: ActiveDocumentFile): ActiveDocumentRuntime => {
  const text = activeFile?.text ?? "";
  const viewMode = activeFile?.viewMode ?? "edit";
  const readingWidth = activeFile?.readingWidth ?? "wide";
  const splitRatio = clampSplitEditorRatio(activeFile?.splitRatio ?? DEFAULT_SPLIT_EDITOR_RATIO);
  const lineWrapping = activeFile?.lineWrapping ?? true;
  const lineNumbers = activeFile?.lineNumbers ?? true;
  const bookmarks = activeFile?.bookmarks ?? [];
  const title = activeFile?.title ?? "No file open";
  const parsedMarkdown = parseFrontmatter(text);
  const renderedPreview = getPreviewBody(parsedMarkdown.body);
  const parsedBodyStartOffset = text.indexOf(parsedMarkdown.body);
  const previewBodyStartOffset =
    (parsedBodyStartOffset === -1 ? 0 : parsedBodyStartOffset) +
    getLineStartOffset(parsedMarkdown.body, renderedPreview.sourceLineOffset);
  const outlineHeadings = getOutlineHeadings(renderedPreview);
  const wordCount = getMarkdownWordCount(text);
  const hasFile = Boolean(activeFile);

  return {
    bookmarks,
    canCopy: text.trim().length > 0,
    canFormat: hasFile && viewMode !== "preview",
    hasFile,
    lineNumbers,
    lineWrapping,
    outlineHeadings,
    parsedMarkdown,
    previewBodyStartOffset,
    readingWidth,
    renderedPreview,
    splitRatio,
    text,
    title,
    viewMode,
    wordCount,
  };
};
