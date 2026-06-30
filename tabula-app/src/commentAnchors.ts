import type { FileComment } from "./workspaceStorage";

export const COMMENT_ANCHOR_CONTEXT_LENGTH = 48;

export type CommentTextRange = {
  start: number;
  end: number;
};

const findRangeByContextInText = (
  sourceText: string,
  needle: string | undefined,
  prefix = "",
  suffix = "",
): CommentTextRange | null => {
  if (!needle) {
    return null;
  }

  const context = `${prefix}${needle}${suffix}`;
  if (context !== needle) {
    const contextIndex = sourceText.indexOf(context);
    if (contextIndex >= 0) {
      const quoteStart = contextIndex + prefix.length;
      return {
        start: quoteStart,
        end: quoteStart + needle.length,
      };
    }
  }

  let nextSearchIndex = 0;
  let bestRange: CommentTextRange | null = null;
  let bestScore = -1;
  while (nextSearchIndex <= sourceText.length) {
    const quoteIndex = sourceText.indexOf(needle, nextSearchIndex);
    if (quoteIndex < 0) {
      break;
    }

    const prefixStart = Math.max(0, quoteIndex - prefix.length);
    const prefixScore = prefix ? (sourceText.slice(prefixStart, quoteIndex) === prefix ? prefix.length : 0) : 0;
    const suffixScore = suffix
      ? sourceText.slice(quoteIndex + needle.length, quoteIndex + needle.length + suffix.length) === suffix
        ? suffix.length
        : 0
      : 0;
    const score = prefixScore + suffixScore;

    if (score > bestScore) {
      bestScore = score;
      bestRange = {
        start: quoteIndex,
        end: quoteIndex + needle.length,
      };
    }

    nextSearchIndex = quoteIndex + needle.length || quoteIndex + 1;
  }

  return bestRange;
};

export const findCommentRangeByContextInText = (
  sourceText: string,
  comment: FileComment,
): CommentTextRange | null =>
  findRangeByContextInText(sourceText, comment.sourceQuote, comment.prefix, comment.suffix) ??
  findRangeByContextInText(sourceText, comment.quote, comment.prefix, comment.suffix);

export const getCommentRangeInText = (sourceText: string, comment: FileComment): CommentTextRange | null => {
  const selectionStart = comment.selectionStart;
  const selectionEnd = comment.selectionEnd;
  const hasStoredRangeShape =
    typeof selectionStart === "number" &&
    typeof selectionEnd === "number" &&
    selectionStart >= 0 &&
    selectionEnd > selectionStart &&
    selectionEnd <= sourceText.length;
  const storedRangeSource = hasStoredRangeShape ? sourceText.slice(selectionStart, selectionEnd) : "";
  const hasStoredRange =
    hasStoredRangeShape && (!comment.quote || storedRangeSource === comment.quote || storedRangeSource === comment.sourceQuote);

  if (hasStoredRange) {
    return {
      start: selectionStart,
      end: selectionEnd,
    };
  }

  return findCommentRangeByContextInText(sourceText, comment);
};
