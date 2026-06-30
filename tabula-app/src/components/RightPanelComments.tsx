import { type RefObject, useEffect, useState } from "react";
import {
  getRightPanelCommentScopeModel,
  type CommentScope,
  type RightPanelCommentGroup as CoreRightPanelCommentGroup,
} from "@tabula-md/tabula";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";
import { CommentComposer } from "./right-panel/comments/CommentComposer";
import { CommentGroup } from "./right-panel/comments/CommentGroup";
import { ResolvedCommentsSection } from "./right-panel/comments/ResolvedCommentsSection";
import type { FormatCommentDate } from "./right-panel/comments/types";

export type RightPanelCommentGroup = CoreRightPanelCommentGroup<WorkspaceFile, FileComment>;

type RightPanelCommentsProps = {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  activeFileTitle: string;
  openCommentGroups: RightPanelCommentGroup[];
  resolvedCommentGroups: RightPanelCommentGroup[];
  showResolved: boolean;
  commentDraft: string;
  identityName: string;
  selectedText: string;
  selectedCharacterCount: number;
  commentInputRef?: RefObject<HTMLTextAreaElement | null>;
  activeCommentId?: string | null;
  activeReplyCommentId?: string | null;
  collapsedReplyIds: Set<string>;
  collapsedCommentFileIds: Set<string>;
  replyDraftByCommentId: Record<string, string>;
  onToggleResolvedSection: () => void;
  onToggleRepliesCollapsed: (commentId: string) => void;
  onToggleCommentFileCollapsed: (fileId: string) => void;
  onCommentDraftChange: (draft: string) => void;
  onIdentityNameChange: (name: string) => void;
  onIdentityNameCommit: () => void;
  onAddComment: () => void;
  onGoToComment: (fileId: string, comment: FileComment) => void;
  onStartCommentReply: (fileId: string, commentId: string) => void;
  onCancelCommentReply: () => void;
  onReplyDraftChange: (commentId: string, draft: string) => void;
  onAddCommentReply: (fileId: string, commentId: string) => void;
  onToggleCommentResolved: (fileId: string, commentId: string) => void;
  onDeleteComment: (fileId: string, commentId: string) => void;
  formatCommentDate: FormatCommentDate;
};

export function RightPanelComments({
  activeFile,
  activeFileId,
  activeFileTitle,
  openCommentGroups,
  resolvedCommentGroups,
  showResolved,
  commentDraft,
  identityName,
  selectedText,
  selectedCharacterCount,
  commentInputRef,
  activeCommentId,
  activeReplyCommentId,
  collapsedReplyIds,
  collapsedCommentFileIds,
  replyDraftByCommentId,
  onToggleResolvedSection,
  onToggleRepliesCollapsed,
  onToggleCommentFileCollapsed,
  onCommentDraftChange,
  onIdentityNameChange,
  onIdentityNameCommit,
  onAddComment,
  onGoToComment,
  onStartCommentReply,
  onCancelCommentReply,
  onReplyDraftChange,
  onAddCommentReply,
  onToggleCommentResolved,
  onDeleteComment,
  formatCommentDate,
}: RightPanelCommentsProps) {
  const [commentScope, setCommentScope] = useState<CommentScope>("current");
  const {
    scopedOpenCommentGroups,
    scopedResolvedCommentGroups,
    hasAnyComments,
    hideSingleActiveFileHeader,
    commentsTitle,
    switchLabel,
    switchCount,
  } = getRightPanelCommentScopeModel({
    activeFile,
    activeFileId,
    activeFileTitle,
    openCommentGroups,
    resolvedCommentGroups,
    commentScope,
  });

  useEffect(() => {
    if (selectedCharacterCount <= 0) {
      return undefined;
    }

    setCommentScope("current");

    const frame = window.requestAnimationFrame(() => {
      commentInputRef?.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [commentInputRef, selectedCharacterCount]);

  useEffect(() => {
    if (!activeCommentId) {
      return;
    }

    setCommentScope("current");
  }, [activeCommentId, activeFileId]);

  const cancelComment = () => {
    onCommentDraftChange("");
  };

  const addComment = () => {
    if (!commentDraft.trim()) {
      return;
    }

    onAddComment();
  };

  const commentGroupProps = {
    activeFileId,
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
  };

  return (
    <section className={`right-panel-content right-comments-panel ${commentScope === "all" ? "all-scope" : "current-scope"}`}>
      <div className="right-comments-context" aria-label="Comments title">
        <span className="right-comments-title" title={commentScope === "all" ? undefined : activeFileTitle}>
          {commentsTitle}
        </span>
        {activeFile && (
          <button
            className="right-comments-switch"
            type="button"
            aria-label={commentScope === "all" ? "Show current file comments" : "Show all comments"}
            aria-pressed={commentScope === "all"}
            onClick={() => setCommentScope((scope) => (scope === "all" ? "current" : "all"))}
          >
            <span>{switchLabel}</span>
            <small>{switchCount}</small>
          </button>
        )}
      </div>
      <div className="right-comments-scroll">
        {!hasAnyComments && (
          <div className="right-comments-empty" aria-label="No comments">
            <span>{activeFile ? "No comments yet" : "No file open"}</span>
            <p>
              {activeFile
                ? commentScope === "current"
                  ? "Select text to anchor a note."
                  : "Comments from every file appear here."
                : "Open a file to add or review comments."}
            </p>
          </div>
        )}
        {scopedOpenCommentGroups.map((group) => (
          <CommentGroup
            group={group}
            hideFileHeader={hideSingleActiveFileHeader}
            variant="open"
            {...commentGroupProps}
            key={group.file.id}
          />
        ))}
        <ResolvedCommentsSection
          resolvedCommentGroups={scopedResolvedCommentGroups}
          hideSingleActiveFileHeader={hideSingleActiveFileHeader}
          showResolved={showResolved}
          onToggleResolvedSection={onToggleResolvedSection}
          {...commentGroupProps}
        />
      </div>
      {activeFile && commentScope === "current" && (
        <div className="right-comments-composer">
          <CommentComposer
            activeFileTitle={activeFileTitle}
            commentDraft={commentDraft}
            identityName={identityName}
            selectedText={selectedText}
            selectedCharacterCount={selectedCharacterCount}
            commentInputRef={commentInputRef}
            onCancel={cancelComment}
            onCommentDraftChange={onCommentDraftChange}
            onIdentityNameChange={onIdentityNameChange}
            onIdentityNameCommit={onIdentityNameCommit}
            onAddComment={addComment}
          />
        </div>
      )}
    </section>
  );
}
