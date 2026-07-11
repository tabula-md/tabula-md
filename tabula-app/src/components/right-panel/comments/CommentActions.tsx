import { Ellipsis, Trash2 } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const commentLabel = comment.body.trim().replace(/\s+/g, " ").slice(0, 48) || "Untitled comment";

  useEffect(() => {
    if (!menuOpen) return;

    const closeFromOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeFromOutside);
    return () => {
      window.removeEventListener("pointerdown", closeFromOutside);
    };
  }, [menuOpen]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!menuOpen || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(false);
  };

  const deleteComment = () => {
    const hasReplies = (comment.replies?.length ?? 0) > 0;
    const confirmed = window.confirm(
      hasReplies ? "Delete this comment and its replies?" : "Delete this comment?",
    );
    if (!confirmed) return;
    setMenuOpen(false);
    onDeleteComment(fileId, comment.id);
  };

  return (
    <div
      ref={menuRef}
      className="right-comment-actions"
      aria-label="Comment actions"
      onKeyDown={handleKeyDown}
    >
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
        className="right-comment-action text"
        type="button"
        onClick={() => onToggleCommentResolved(fileId, comment.id)}
      >
        {comment.resolved ? "Reopen" : "Resolve"}
      </button>
      <button
        className="right-comment-more-trigger"
        type="button"
        aria-label={`More actions for comment: ${commentLabel}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Ellipsis size={14} aria-hidden="true" />
      </button>
      {menuOpen && (
        <div className="right-comment-more-menu" role="menu" aria-label={`Actions for comment: ${commentLabel}`}>
          <button className="danger" type="button" role="menuitem" onClick={deleteComment}>
            <Trash2 size={14} aria-hidden="true" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
