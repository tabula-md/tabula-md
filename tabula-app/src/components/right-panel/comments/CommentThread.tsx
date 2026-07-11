import { ChevronDown, ChevronRight } from "lucide-react";
import type { FileCommentReply } from "../../../workspaceStorage";
import { CommentAuthor } from "./CommentAuthor";
import type { FormatCommentDate, RightPanelCommentsCopy } from "./types";

type CommentThreadProps = {
  commentId: string;
  copy: RightPanelCommentsCopy;
  replies: FileCommentReply[];
  repliesCollapsed: boolean;
  onToggleRepliesCollapsed: (commentId: string) => void;
  formatCommentDate: FormatCommentDate;
};

export function CommentThread({
  commentId,
  copy,
  replies,
  repliesCollapsed,
  onToggleRepliesCollapsed,
  formatCommentDate,
}: CommentThreadProps) {
  const replyLabel = copy.replyLabel(replies.length);

  return (
    <section className="right-comment-thread" aria-label={replyLabel}>
      <button className="right-comment-thread-toggle" type="button" onClick={() => onToggleRepliesCollapsed(commentId)}>
        {repliesCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span>{repliesCollapsed ? copy.showReplies(replyLabel) : copy.hideReplies(replyLabel)}</span>
      </button>
      {!repliesCollapsed && (
        <div className="right-comment-replies">
          {replies.map((reply) => (
            <article className="right-comment-reply" key={reply.id}>
              <CommentAuthor
                authorName={reply.authorName}
                authorColor={reply.authorColor}
                createdAt={reply.createdAt}
                copy={copy}
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
