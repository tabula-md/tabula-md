import { WORKSPACE_ROOM_MAX_COMMENT_LENGTH } from "@tabula-md/tabula";
import type { RightPanelCommentsCopy } from "./types";

interface CommentReplyFormProps {
  fileId: string;
  commentId: string;
  copy: RightPanelCommentsCopy;
  draft: string;
  onCancelCommentReply: () => void;
  onReplyDraftChange: (commentId: string, draft: string) => void;
  onAddCommentReply: (fileId: string, commentId: string) => void;
}

export function CommentReplyForm({
  fileId,
  commentId,
  copy,
  draft,
  onCancelCommentReply,
  onReplyDraftChange,
  onAddCommentReply,
}: CommentReplyFormProps) {
  return (
    <div className="right-comment-reply-form">
      <textarea
        autoFocus
        maxLength={WORKSPACE_ROOM_MAX_COMMENT_LENGTH}
        value={draft}
        onChange={(event) => onReplyDraftChange(commentId, event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onAddCommentReply(fileId, commentId);
          }
        }}
        placeholder={copy.replyAction}
        rows={2}
        aria-label={copy.replyAction}
      />
      <div className="right-comment-reply-actions">
        <button className="right-comment-text-button" type="button" onClick={onCancelCommentReply}>
          {copy.cancel}
        </button>
        <button
          className="right-comment-submit"
          type="button"
          disabled={!draft.trim()}
          onClick={() => onAddCommentReply(fileId, commentId)}
        >
          {copy.replyAction}
        </button>
      </div>
    </div>
  );
}
