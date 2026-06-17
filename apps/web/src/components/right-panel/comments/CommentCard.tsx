import type { FileComment } from "../../../workspaceStorage";
import { CommentActions } from "./CommentActions";
import { CommentAuthor } from "./CommentAuthor";
import { CommentReplyForm } from "./CommentReplyForm";
import { CommentThread } from "./CommentThread";
import type { FormatCommentDate } from "./types";

type CommentCardProps = {
  fileId: string;
  comment: FileComment;
  isActive: boolean;
  isReplying: boolean;
  repliesCollapsed: boolean;
  replyDraft: string;
  onToggleRepliesCollapsed: (commentId: string) => void;
  onGoToComment: (fileId: string, comment: FileComment) => void;
  onStartCommentReply: (fileId: string, commentId: string) => void;
  onCancelCommentReply: () => void;
  onReplyDraftChange: (commentId: string, draft: string) => void;
  onAddCommentReply: (fileId: string, commentId: string) => void;
  onToggleCommentResolved: (fileId: string, commentId: string) => void;
  onDeleteComment: (fileId: string, commentId: string) => void;
  formatCommentDate: FormatCommentDate;
};

export function CommentCard({
  fileId,
  comment,
  isActive,
  isReplying,
  repliesCollapsed,
  replyDraft,
  onToggleRepliesCollapsed,
  onGoToComment,
  onStartCommentReply,
  onCancelCommentReply,
  onReplyDraftChange,
  onAddCommentReply,
  onToggleCommentResolved,
  onDeleteComment,
  formatCommentDate,
}: CommentCardProps) {
  const replies = comment.replies ?? [];

  return (
    <article
      className={`right-comment-card ${isActive ? "active" : ""} ${comment.resolved ? "resolved" : ""}`}
      data-comment-id={comment.id}
    >
      <div className="right-comment-content">
        {comment.quote && (
          <button
            className="right-comment-quote"
            type="button"
            title="Show quoted text"
            aria-label="Show quoted text"
            onClick={() => onGoToComment(fileId, comment)}
          >
            {comment.quote}
          </button>
        )}
        <p className="right-comment-body">{comment.body}</p>
        <div className="right-comment-meta">
          <CommentAuthor
            authorName={comment.authorName}
            authorColor={comment.authorColor}
            createdAt={comment.createdAt}
            formatCommentDate={formatCommentDate}
          />
        </div>
        <CommentActions
          fileId={fileId}
          comment={comment}
          isReplying={isReplying}
          onStartCommentReply={onStartCommentReply}
          onToggleCommentResolved={onToggleCommentResolved}
          onDeleteComment={onDeleteComment}
        />
        {!comment.resolved && isReplying && (
          <CommentReplyForm
            fileId={fileId}
            commentId={comment.id}
            draft={replyDraft}
            onCancelCommentReply={onCancelCommentReply}
            onReplyDraftChange={onReplyDraftChange}
            onAddCommentReply={onAddCommentReply}
          />
        )}
        {replies.length > 0 && (
          <CommentThread
            commentId={comment.id}
            replies={replies}
            repliesCollapsed={repliesCollapsed}
            onToggleRepliesCollapsed={onToggleRepliesCollapsed}
            formatCommentDate={formatCommentDate}
          />
        )}
      </div>
    </article>
  );
}
