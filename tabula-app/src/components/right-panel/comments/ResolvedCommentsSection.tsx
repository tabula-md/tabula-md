import { ChevronDown, ChevronRight } from "lucide-react";
import { CommentGroup } from "./CommentGroup";
import type { FormatCommentDate, RightPanelCommentGroup } from "./types";
import type { FileComment } from "../../../workspaceStorage";

type ResolvedCommentsSectionProps = {
  activeFileId: string;
  activeCommentId?: string | null;
  activeReplyCommentId?: string | null;
  collapsedReplyIds: Set<string>;
  collapsedCommentFileIds: Set<string>;
  replyDraftByCommentId: Record<string, string>;
  resolvedCommentGroups: RightPanelCommentGroup[];
  hideSingleActiveFileHeader?: boolean;
  showResolved: boolean;
  onToggleResolvedSection: () => void;
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

export function ResolvedCommentsSection({
  activeFileId,
  activeCommentId,
  activeReplyCommentId,
  collapsedReplyIds,
  collapsedCommentFileIds,
  replyDraftByCommentId,
  resolvedCommentGroups,
  hideSingleActiveFileHeader = false,
  showResolved,
  onToggleResolvedSection,
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
}: ResolvedCommentsSectionProps) {
  const resolvedCommentCount = resolvedCommentGroups.reduce((total, group) => total + group.comments.length, 0);
  const resolvedLabel = `Resolved · ${resolvedCommentCount}`;
  const shouldHideSingleActiveFileHeader =
    hideSingleActiveFileHeader && resolvedCommentGroups.length === 1 && resolvedCommentGroups[0]?.file.id === activeFileId;

  if (resolvedCommentGroups.length === 0) {
    return null;
  }

  return (
    <section className="right-resolved-comments" aria-label="Resolved comments">
      <button
        className="right-row right-resolved-comments-header"
        type="button"
        aria-label={showResolved ? "Hide resolved comments" : "Show resolved comments"}
        onClick={onToggleResolvedSection}
      >
        {showResolved ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>{resolvedLabel}</span>
      </button>
      {showResolved &&
        resolvedCommentGroups.map((group) => (
          <CommentGroup
            group={group}
            hideFileHeader={shouldHideSingleActiveFileHeader}
            variant="resolved"
            activeFileId={activeFileId}
            activeCommentId={activeCommentId}
            activeReplyCommentId={activeReplyCommentId}
            collapsedReplyIds={collapsedReplyIds}
            collapsedCommentFileIds={collapsedCommentFileIds}
            replyDraftByCommentId={replyDraftByCommentId}
            onToggleRepliesCollapsed={onToggleRepliesCollapsed}
            onToggleCommentFileCollapsed={onToggleCommentFileCollapsed}
            onGoToComment={onGoToComment}
            onStartCommentReply={onStartCommentReply}
            onCancelCommentReply={onCancelCommentReply}
            onReplyDraftChange={onReplyDraftChange}
            onAddCommentReply={onAddCommentReply}
            onToggleCommentResolved={onToggleCommentResolved}
            onDeleteComment={onDeleteComment}
            formatCommentDate={formatCommentDate}
            key={group.file.id}
          />
        ))}
    </section>
  );
}
