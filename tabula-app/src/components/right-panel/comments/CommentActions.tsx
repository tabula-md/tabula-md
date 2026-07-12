import { CheckCircle2, Ellipsis, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { FileComment } from "../../../workspaceStorage";
import { useDismissibleMenu } from "../../../hooks/useDismissibleMenu";
import { CommandMenu, CommandMenuItem } from "../../ui/CommandMenu";
import type { RightPanelCommentsCopy } from "./types";

type CommentActionsProps = {
  fileId: string;
  comment: FileComment;
  copy: RightPanelCommentsCopy;
  isReplying: boolean;
  onStartCommentReply: (fileId: string, commentId: string) => void;
  onToggleCommentResolved: (fileId: string, commentId: string) => void;
  onDeleteComment: (fileId: string, commentId: string) => void;
};

export function CommentActions({
  fileId,
  comment,
  copy,
  isReplying,
  onStartCommentReply,
  onToggleCommentResolved,
  onDeleteComment,
}: CommentActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const commentLabel = comment.body.trim().replace(/\s+/g, " ").slice(0, 48) || copy.untitled;
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const handleMenuKeyDown = useDismissibleMenu({
    menuRef,
    onClose: closeMenu,
    open: menuOpen,
    triggerRef,
  });

  const deleteComment = () => {
    setMenuOpen(false);
    onDeleteComment(fileId, comment.id);
  };

  return (
    <div
      className="right-comment-actions"
      aria-label={copy.actions}
    >
      {!comment.resolved && !isReplying && (
        <button
          className="right-comment-action text"
          type="button"
          onClick={() => onStartCommentReply(fileId, comment.id)}
        >
          {copy.replyAction}
        </button>
      )}
      <button
        ref={triggerRef}
        className="right-comment-more-trigger"
        type="button"
        aria-label={copy.moreActions(commentLabel)}
        data-tooltip={copy.moreActions(commentLabel)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Ellipsis size={14} aria-hidden="true" />
      </button>
      {menuOpen && (
        <CommandMenu
          ref={menuRef}
          className="right-comment-more-menu"
          ariaLabel={copy.menuActions(commentLabel)}
          onKeyDown={handleMenuKeyDown}
        >
          <CommandMenuItem
            icon={comment.resolved ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
            label={comment.resolved ? copy.reopen : copy.resolve}
            onClick={() => {
              setMenuOpen(false);
              onToggleCommentResolved(fileId, comment.id);
            }}
          />
          <CommandMenuItem
            danger
            icon={<Trash2 size={14} />}
            label={copy.delete}
            onClick={deleteComment}
          />
        </CommandMenu>
      )}
    </div>
  );
}
