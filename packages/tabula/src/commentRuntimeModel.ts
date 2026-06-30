import {
  positionInSourceLine,
  sourceRangeIntersectsLine,
  type LineSurfaceSourceRange,
} from "./lineSurfaceModel";

export type CommentRuntimeAnchor = {
  id: string;
  start: number;
  end: number;
};

export type CommentRuntimeBookmark = {
  id: string;
  position: number;
  createdAt: string;
};

export type PreviewCommentAnchor = {
  id: string;
  start: number;
  end: number;
};

export type PreviewLineAnnotation = {
  lineNumber: number;
  start: number;
  end: number;
  hasBookmark: boolean;
  hasComment: boolean;
  hasActiveComment: boolean;
};

export const isPositionInLineRange = (
  position: number,
  lineStart: number,
  lineEnd: number,
) => positionInSourceLine(position, lineStart, lineEnd);

export const toggleLineBookmarkInList = <
  TBookmark extends CommentRuntimeBookmark = CommentRuntimeBookmark,
>({
  bookmarks,
  createId,
  lineStart,
  lineEnd,
  nowIso,
}: {
  bookmarks: TBookmark[];
  createId: () => string;
  lineStart: number;
  lineEnd: number;
  nowIso: string;
}): CommentRuntimeBookmark[] => {
  const existingBookmark = bookmarks.find((bookmark) =>
    isPositionInLineRange(bookmark.position, lineStart, lineEnd),
  );

  if (existingBookmark) {
    return bookmarks.filter((bookmark) => bookmark.id !== existingBookmark.id);
  }

  return [
    ...bookmarks,
    {
      id: createId(),
      position: lineStart,
      createdAt: nowIso,
    },
  ];
};

export const getPreviewCommentAnchors = <
  TAnchor extends CommentRuntimeAnchor = CommentRuntimeAnchor,
>({
  commentAnchors,
  previewBody,
  previewBodyStartOffset,
}: {
  commentAnchors: TAnchor[];
  previewBody: string;
  previewBodyStartOffset: number;
}): PreviewCommentAnchor[] =>
  commentAnchors
    .map((anchor) => ({
      id: anchor.id,
      start: anchor.start - previewBodyStartOffset,
      end: anchor.end - previewBodyStartOffset,
    }))
    .filter((anchor) => anchor.end > 0 && anchor.start < previewBody.length)
    .map((anchor) => ({
      ...anchor,
      start: Math.max(0, anchor.start),
      end: Math.min(previewBody.length, anchor.end),
    }))
    .filter((anchor) => anchor.end > anchor.start);

export const getPreviewLineAnnotations = <
  TBookmark extends Pick<CommentRuntimeBookmark, "position"> = CommentRuntimeBookmark,
  TAnchor extends CommentRuntimeAnchor = CommentRuntimeAnchor,
>({
  body,
  bodyStartOffset,
  bookmarks,
  commentAnchors,
  activeCommentId,
}: {
  body: string;
  bodyStartOffset: number;
  bookmarks: TBookmark[];
  commentAnchors: TAnchor[];
  activeCommentId?: string | null;
}): PreviewLineAnnotation[] => {
  const lines = body.split("\n");
  let bodyOffset = 0;

  return lines.map((line, index) => {
    const start = bodyStartOffset + bodyOffset;
    const end = start + line.length;
    const sourceLine = { start, end };
    const hasBookmark = bookmarks.some((bookmark) =>
      positionInSourceLine(bookmark.position, start, end),
    );
    const lineComments = commentAnchors.filter((anchor) =>
      sourceRangeIntersectsLine(anchor, sourceLine),
    );
    bodyOffset += line.length + 1;

    return {
      lineNumber: index + 1,
      start,
      end,
      hasBookmark,
      hasComment: lineComments.length > 0,
      hasActiveComment: lineComments.some(
        (anchor) => anchor.id === activeCommentId,
      ),
    };
  });
};

export const getItemsInSourceLineRange = <TItem>({
  items,
  lineStart,
  lineEnd,
  resolveRange,
}: {
  items: TItem[];
  lineStart: number;
  lineEnd: number;
  resolveRange: (item: TItem) => LineSurfaceSourceRange | null | undefined;
}) =>
  items.filter((item) => {
    const range = resolveRange(item);
    return Boolean(
      range &&
        sourceRangeIntersectsLine(range, {
          start: lineStart,
          end: lineEnd,
        }),
    );
  });

export const formatCommentDate = (isoDate: string, now = Date.now()) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (elapsedSeconds < 45) {
    return "just now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
};
