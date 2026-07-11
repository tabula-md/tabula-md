import type { FormatCommentDate, RightPanelCommentsCopy } from "./types";

type CommentAuthorProps = {
  authorName?: string;
  authorColor?: string;
  createdAt: string;
  copy: RightPanelCommentsCopy;
  variant?: "default" | "reply";
  showAvatar?: boolean;
  formatCommentDate: FormatCommentDate;
};

const getAuthorInitial = (name?: string) => (name?.trim().slice(0, 1) || "?").toUpperCase();
const getAuthorName = (name: string | undefined, guestLabel: string) => name?.trim() || guestLabel;
const getAuthorColor = (color?: string) => color || "#777777";

export function CommentAuthor({
  authorName,
  authorColor,
  createdAt,
  copy,
  variant = "default",
  showAvatar = true,
  formatCommentDate,
}: CommentAuthorProps) {
  return (
    <div className={`right-comment-author ${variant}`}>
      {showAvatar && (
        <span className="right-comment-avatar" style={{ background: getAuthorColor(authorColor) }}>
          {getAuthorInitial(authorName)}
        </span>
      )}
      <span className="right-comment-author-meta">
        <strong>{getAuthorName(authorName, copy.guest)}</strong>
        <span aria-hidden="true">·</span>
        <small>{formatCommentDate(createdAt)}</small>
      </span>
    </div>
  );
}
