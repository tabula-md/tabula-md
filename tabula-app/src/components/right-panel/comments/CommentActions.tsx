import type { FileComment } from "../../../workspaceStorage";

type CommentActionsProps = {
  fileId: string;
  comment: FileComment;
  isReplying: boolean;
  onStartCommentReply: (fileId: string, commentId: string) => void;
  onToggleCommentResolved: (fileId: string, commentId: string) => void;
  onDeleteComment: (fileId: string, commentId: string) => void;
};

export function CommentActions({
  fileId,
  comment,
  isReplying,
  onStartCommentReply,
  onToggleCommentResolved,
  onDeleteComment,
}: CommentActionsProps) {
  return (
    <div className="right-comment-actions" aria-label="Comment actions">
      {!comment.resolved && !isReplying && (
        <button
          className="right-comment-action text"
          type="button"
          onClick={() => onStartCommentReply(fileId, comment.id)}
        >
          Reply
        </button>
      )}
      <button
        className="right-comment-action text quiet"
        type="button"
        onClick={() => onToggleCommentResolved(fileId, comment.id)}
      >
        {comment.resolved ? "Reopen" : "Resolve"}
      </button>
      <button
        className="right-comment-action text danger"
        type="button"
        onClick={() => onDeleteComment(fileId, comment.id)}
      >
        Delete
      </button>
    </div>
  );
}
