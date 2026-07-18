import { CheckCircle2, Ellipsis, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FileComment } from "../../workspaceStorage";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "../../components/ui/Menu";
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
  const commentLabel = comment.body.trim().replace(/\s+/g, " ").slice(0, 48) || copy.untitled;

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
      <MenuRoot open={menuOpen} onOpenChange={setMenuOpen}>
        <MenuTrigger asChild>
          <button
            className="right-comment-more-trigger"
            type="button"
            aria-label={copy.moreActions(commentLabel)}
            data-tooltip={copy.moreActions(commentLabel)}
          >
            <Ellipsis size={14} aria-hidden="true" />
          </button>
        </MenuTrigger>
        <MenuContent className="right-comment-more-menu" ariaLabel={copy.menuActions(commentLabel)}>
          <MenuItem
            icon={comment.resolved ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
            label={comment.resolved ? copy.reopen : copy.resolve}
            onSelect={() => {
              onToggleCommentResolved(fileId, comment.id);
            }}
          />
          <MenuItem
            danger
            icon={<Trash2 size={14} />}
            label={copy.delete}
            onSelect={() => onDeleteComment(fileId, comment.id)}
          />
        </MenuContent>
      </MenuRoot>
    </div>
  );
}
