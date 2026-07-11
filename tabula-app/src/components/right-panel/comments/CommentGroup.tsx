import { ChevronDown, ChevronRight } from "lucide-react";
import { stripMarkdownExtension } from "@tabula-md/tabula";
import type { FileComment } from "../../../workspaceStorage";
import { CommentCard } from "./CommentCard";
import type { FormatCommentDate, RightPanelCommentGroup, RightPanelCommentsCopy } from "./types";

type CommentGroupProps = {
  group: RightPanelCommentGroup;
  activeFileId: string;
  copy: RightPanelCommentsCopy;
  hideFileHeader?: boolean;
  variant?: "open" | "resolved";
  activeCommentId?: string | null;
  activeReplyCommentId?: string | null;
  collapsedReplyIds: Set<string>;
  collapsedCommentFileIds: Set<string>;
  replyDraftByCommentId: Record<string, string>;
  onToggleRepliesCollapsed: (commentId: string) => void;
  onToggleCommentFileCollapsed: (fileId: string) => void;
  onGoToComment: (fileId: string, comment: FileComment) => void;
  onStartCommentReply: (fileId: string, commentId: string) => void;
  onCancelCommentReply: () => void;
  onReplyDraftChange: (commentId: string, draft: string) => void;
  onAddCommentReply: (fileId: string, commentId: string) => void;
  onToggleCommentResolved: (fileId: string, commentId: string) => void;
  onDeleteComment: (fileId: string, commentId: string) => void;
  formatCommentDate: FormatCommentDate;
};

export function CommentGroup({
  group,
  activeFileId,
  copy,
  hideFileHeader = false,
  variant = "open",
  activeCommentId,
  activeReplyCommentId,
  collapsedReplyIds,
  collapsedCommentFileIds,
  replyDraftByCommentId,
  onToggleRepliesCollapsed,
  onToggleCommentFileCollapsed,
  onGoToComment,
  onStartCommentReply,
  onCancelCommentReply,
  onReplyDraftChange,
  onAddCommentReply,
  onToggleCommentResolved,
  onDeleteComment,
  formatCommentDate,
}: CommentGroupProps) {
  const isActiveFile = group.file.id === activeFileId;
  const fileCommentsCollapsed = collapsedCommentFileIds.has(group.file.id);
  const commentsCollapsed = hideFileHeader ? false : fileCommentsCollapsed;
  const fileLabel = stripMarkdownExtension(group.file.title);

  return (
    <section className={`right-comment-group ${hideFileHeader ? "compact" : ""} ${variant}`}>
      {!hideFileHeader && (
        <button
          className={`right-row right-comment-file ${isActiveFile ? "active" : ""}`}
          type="button"
          title={group.file.title}
          aria-expanded={!fileCommentsCollapsed}
          onClick={() => onToggleCommentFileCollapsed(group.file.id)}
        >
          {fileCommentsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span className="right-row-label">{fileLabel}</span>
        </button>
      )}
      {!commentsCollapsed && (
        <div className="right-comment-list">
          {group.comments.map((comment) => (
            <CommentCard
              fileId={group.file.id}
              comment={comment}
              copy={copy}
              isActive={comment.id === activeCommentId}
              isReplying={activeReplyCommentId === comment.id}
              repliesCollapsed={collapsedReplyIds.has(comment.id)}
              replyDraft={replyDraftByCommentId[comment.id] ?? ""}
              onToggleRepliesCollapsed={onToggleRepliesCollapsed}
              onGoToComment={onGoToComment}
              onStartCommentReply={onStartCommentReply}
              onCancelCommentReply={onCancelCommentReply}
              onReplyDraftChange={onReplyDraftChange}
              onAddCommentReply={onAddCommentReply}
              onToggleCommentResolved={onToggleCommentResolved}
              onDeleteComment={onDeleteComment}
              formatCommentDate={formatCommentDate}
              key={comment.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
