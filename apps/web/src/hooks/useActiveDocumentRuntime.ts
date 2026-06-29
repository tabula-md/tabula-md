import { useMemo } from "react";
import {
  getLineStartOffset,
  getOutlineHeadings,
  getPreviewBody,
  parseFrontmatter,
} from "../markdown";
import {
  clampSplitEditorRatio,
  DEFAULT_SPLIT_EDITOR_RATIO,
  type WorkspaceFile,
} from "../workspaceStorage";
import { getMarkdownWordCount } from "../workspaceViewModel";

export const useActiveDocumentRuntime = (activeFile?: WorkspaceFile) => {
  const text = activeFile?.text ?? "";
  const viewMode = activeFile?.viewMode ?? "edit";
  const readingWidth = activeFile?.readingWidth ?? "wide";
  const splitRatio = clampSplitEditorRatio(
    activeFile?.splitRatio ?? DEFAULT_SPLIT_EDITOR_RATIO,
  );
  const lineWrapping = activeFile?.lineWrapping ?? true;
  const lineNumbers = activeFile?.lineNumbers ?? true;
  const bookmarks = activeFile?.bookmarks ?? [];
  const title = activeFile?.title ?? "No file open";
  const parsedMarkdown = useMemo(() => parseFrontmatter(text), [text]);
  const renderedPreview = useMemo(
    () => getPreviewBody(parsedMarkdown.body),
    [parsedMarkdown.body],
  );
  const previewBodyStartOffset = useMemo(() => {
    const parsedBodyStartOffset = text.indexOf(parsedMarkdown.body);
    return (
      (parsedBodyStartOffset === -1 ? 0 : parsedBodyStartOffset) +
      getLineStartOffset(parsedMarkdown.body, renderedPreview.sourceLineOffset)
    );
  }, [parsedMarkdown.body, renderedPreview.sourceLineOffset, text]);
  const outlineHeadings = useMemo(
    () => getOutlineHeadings(renderedPreview),
    [renderedPreview],
  );
  const wordCount = useMemo(() => getMarkdownWordCount(text), [text]);

  return {
    bookmarks,
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
