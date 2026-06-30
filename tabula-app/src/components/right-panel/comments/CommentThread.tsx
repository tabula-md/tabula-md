import { ChevronDown, ChevronRight } from "lucide-react";
import type { FileCommentReply } from "../../../workspaceStorage";
import { CommentAuthor } from "./CommentAuthor";
import type { FormatCommentDate } from "./types";

type CommentThreadProps = {
  commentId: string;
  replies: FileCommentReply[];
  repliesCollapsed: boolean;
  onToggleRepliesCollapsed: (commentId: string) => void;
  formatCommentDate: FormatCommentDate;
};

export function CommentThread({
  commentId,
  replies,
  repliesCollapsed,
  onToggleRepliesCollapsed,
  formatCommentDate,
}: CommentThreadProps) {
  const replyLabel = `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`;

  return (
    <section className="right-comment-thread" aria-label={replyLabel}>
      <button className="right-comment-thread-toggle" type="button" onClick={() => onToggleRepliesCollapsed(commentId)}>
        {repliesCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        <span>{repliesCollapsed ? `Show ${replyLabel}` : `Hide ${replyLabel}`}</span>
      </button>
      {!repliesCollapsed && (
        <div className="right-comment-replies">
          {replies.map((reply) => (
            <article className="right-comment-reply" key={reply.id}>
              <CommentAuthor
                authorName={reply.authorName}
                authorColor={reply.authorColor}
                createdAt={reply.createdAt}
                variant="reply"
                showAvatar={false}
                formatCommentDate={formatCommentDate}
              />
              <p className="right-comment-body">{reply.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
