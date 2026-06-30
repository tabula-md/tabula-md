import { getCommentRangeInText } from "./commentAnchors";
import type { MarkdownCommentAnchor } from "./markdownEditorTypes";
import {
  formatCommentDate,
  getItemsInSourceLineRange,
  getPreviewCommentAnchors,
  getPreviewLineAnnotations,
  isPositionInLineRange,
  toggleLineBookmarkInList,
  type PreviewCommentAnchor,
  type PreviewLineAnnotation,
} from "@tabula-md/tabula";
import type { FileComment } from "./workspaceStorage";

export {
  formatCommentDate,
  getPreviewCommentAnchors,
  getPreviewLineAnnotations,
  isPositionInLineRange,
  toggleLineBookmarkInList,
};
export type { PreviewCommentAnchor, PreviewLineAnnotation };

export const getCommentAnchors = (
  comments: FileComment[],
  sourceText: string,
): MarkdownCommentAnchor[] =>
  comments
    .map((comment) => {
      const commentRange = getCommentRangeInText(sourceText, comment);
      return commentRange
        ? { id: comment.id, start: commentRange.start, end: commentRange.end }
        : null;
    })
    .filter((anchor): anchor is MarkdownCommentAnchor => Boolean(anchor));

export const getCommentsInLineRange = ({
  comments,
  lineStart,
  lineEnd,
  sourceText,
}: {
  comments: FileComment[];
  lineStart: number;
  lineEnd: number;
  sourceText: string;
}) =>
  getItemsInSourceLineRange({
    items: comments,
    lineStart,
    lineEnd,
    resolveRange: (comment) => getCommentRangeInText(sourceText, comment),
  });
