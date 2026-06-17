type CommentReplyFormProps = {
  fileId: string;
  commentId: string;
  draft: string;
  onCancelCommentReply: () => void;
  onReplyDraftChange: (commentId: string, draft: string) => void;
  onAddCommentReply: (fileId: string, commentId: string) => void;
};

export function CommentReplyForm({
  fileId,
  commentId,
  draft,
  onCancelCommentReply,
  onReplyDraftChange,
  onAddCommentReply,
}: CommentReplyFormProps) {
  return (
    <div className="right-comment-reply-form">
      <textarea
        autoFocus
        value={draft}
        onChange={(event) => onReplyDraftChange(commentId, event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onAddCommentReply(fileId, commentId);
          }
        }}
        placeholder="Reply"
        rows={2}
        aria-label="Reply"
      />
      <div className="right-comment-reply-actions">
        <button className="right-comment-text-button" type="button" onClick={onCancelCommentReply}>
          Cancel
        </button>
        <button
          className="right-comment-submit"
          type="button"
          disabled={!draft.trim()}
          onClick={() => onAddCommentReply(fileId, commentId)}
        >
          Reply
        </button>
      </div>
    </div>
  );
}
