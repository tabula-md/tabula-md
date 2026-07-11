import { ChangeSet, MapMode } from "@codemirror/state";
import type { TextPatch } from "@tabula-md/tabula";
import type { FileComment } from "./workspaceStorage";

export type CommentTextRange = {
  start: number;
  end: number;
};

export const getCommentRangeInText = (sourceText: string, comment: FileComment): CommentTextRange | null => {
  if (comment.anchorDetached) {
    return null;
  }
  const selectionStart = comment.selectionStart;
  const selectionEnd = comment.selectionEnd;
  const hasStoredRange =
    typeof selectionStart === "number" &&
    typeof selectionEnd === "number" &&
    selectionStart >= 0 &&
    selectionEnd > selectionStart &&
    selectionEnd <= sourceText.length;

  if (!hasStoredRange) {
    return null;
  }

  return {
    start: selectionStart,
    end: selectionEnd,
  };
};

export const mapCommentAnchorThroughPatches = (
  comment: FileComment,
  patches: readonly TextPatch[],
  oldDocumentLength: number,
): FileComment => {
  const selectionStart = comment.selectionStart;
  const selectionEnd = comment.selectionEnd;
  if (
    comment.anchorDetached ||
    typeof selectionStart !== "number" ||
    typeof selectionEnd !== "number" ||
    selectionEnd <= selectionStart ||
    patches.length === 0
  ) {
    return comment;
  }

  const changes = ChangeSet.of(
    patches.map(({ from, to, insert }) => ({ from, to, insert })),
    oldDocumentLength,
  );
  const start = changes.mapPos(selectionStart, 1, MapMode.TrackDel);
  const end = changes.mapPos(selectionEnd, -1, MapMode.TrackDel);
  if (start === null || end === null || end <= start) {
    return {
      ...comment,
      anchorDetached: true,
      selectionStart: undefined,
      selectionEnd: undefined,
    };
  }

  if (start === selectionStart && end === selectionEnd) {
    return comment;
  }

  return {
    ...comment,
    anchorDetached: false,
    selectionStart: start,
    selectionEnd: end,
  };
};
