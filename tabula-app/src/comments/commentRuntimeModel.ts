import { getCommentRangeInText } from "./commentAnchors";
import type { MarkdownCommentAnchor } from "../document/markdownEditorTypes";
import {
  formatCommentDate,
  getPreviewCommentAnchors,
  getPreviewLineAnnotations,
  isPositionInLineRange,
  toggleLineBookmarkInList,
  type PreviewCommentAnchor,
  type PreviewLineAnnotation,
} from "@tabula-md/tabula";
import type { FileComment } from "../workspace/workspaceStorage";

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
