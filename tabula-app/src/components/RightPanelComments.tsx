import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Check, ListFilter, MessageSquarePlus } from "lucide-react";
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
import type { RightPanelCommentsCopy } from "./right-panel/comments/types";
import { stripMarkdownExtension } from "@tabula-md/tabula";
import { useDismissibleMenu } from "../hooks/useDismissibleMenu";

export type RightPanelCommentGroup = CoreRightPanelCommentGroup<WorkspaceFile, FileComment>;

type RightPanelCommentsProps = {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  activeFileTitle: string;
  openCommentGroups: RightPanelCommentGroup[];
  resolvedCommentGroups: RightPanelCommentGroup[];
  showResolved: boolean;
  commentDraft: string;
  copy: RightPanelCommentsCopy;
  identityName: string;
  pendingSelectionText: string;
  selectedCharacterCount: number;
  selectionCommentPending: boolean;
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
  onAddComment: (options?: { includeSelection?: boolean }) => void;
  onGoToComment: (fileId: string, comment: FileComment) => void;
  onStartCommentReply: (fileId: string, commentId: string) => void;
  onCancelCommentReply: () => void;
  onReplyDraftChange: (commentId: string, draft: string) => void;
  onAddCommentReply: (fileId: string, commentId: string) => void;
  onToggleCommentResolved: (fileId: string, commentId: string) => void;
  onDeleteComment: (fileId: string, commentId: string) => void;
  onRequestTextSelection: () => void;
  onSelectionCommentRequestHandled: () => void;
  onCancelSelectionComment: () => void;
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
  copy,
  identityName,
  pendingSelectionText,
  selectedCharacterCount,
  selectionCommentPending,
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
  onRequestTextSelection,
  onSelectionCommentRequestHandled,
  onCancelSelectionComment,
  formatCommentDate,
}: RightPanelCommentsProps) {
  const [commentScope, setCommentScope] = useState<CommentScope>("current");
  const [composerMode, setComposerMode] = useState<"selection" | "document" | null>(null);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const scopeMenuRef = useRef<HTMLDivElement | null>(null);
  const scopeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeScopeMenu = useCallback(() => setScopeMenuOpen(false), []);
  const handleScopeMenuKeyDown = useDismissibleMenu({
    menuRef: scopeMenuRef,
    onClose: closeScopeMenu,
    open: scopeMenuOpen,
    triggerRef: scopeTriggerRef,
  });
  const {
    scopedOpenCommentGroups,
    scopedResolvedCommentGroups,
    hasAnyComments,
    hideSingleActiveFileHeader,
  } = getRightPanelCommentScopeModel({
    activeFileId,
    openCommentGroups,
    resolvedCommentGroups,
    commentScope,
  });
  const currentFileLabel = activeFile
    ? stripMarkdownExtension(activeFileTitle)
    : copy.currentFile;

  useEffect(() => {
    if (!activeCommentId) {
      return;
    }

    setCommentScope("current");
    setComposerMode(null);
  }, [activeCommentId, activeFileId]);

  useEffect(() => {
    setCommentScope("current");
    setComposerMode(null);
    setScopeMenuOpen(false);
  }, [activeFileId]);

  useEffect(() => {
    if (!selectionCommentPending) return;
    setCommentScope("current");
    setComposerMode("selection");
    onSelectionCommentRequestHandled();
  }, [onSelectionCommentRequestHandled, selectionCommentPending]);

  useEffect(() => {
    if (composerMode && commentScope === "current") {
      commentInputRef?.current?.focus();
    }
  }, [commentInputRef, commentScope, composerMode]);

  const cancelComment = () => {
    onCommentDraftChange("");
    if (composerMode === "selection") {
      onCancelSelectionComment();
    }
    setComposerMode(null);
  };

  const addComment = () => {
    if (!commentDraft.trim()) {
      return;
    }

    onAddComment({ includeSelection: composerMode === "selection" });
    setComposerMode(null);
  };

  const selectScope = (scope: CommentScope) => {
    setCommentScope(scope);
    setComposerMode(null);
    setScopeMenuOpen(false);
  };

  const openDocumentComposer = () => {
    setCommentScope("current");
    setComposerMode("document");
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
    copy,
  };

  return (
    <section className={`right-panel-content right-comments-panel ${commentScope === "all" ? "all-scope" : "current-scope"}`}>
      <div className="right-comments-toolbar">
        <span className="right-comments-context-label" title={commentScope === "current" ? activeFileTitle : copy.all}>
          {activeFile ? (commentScope === "current" ? currentFileLabel : copy.all) : copy.noFile}
        </span>
        {activeFile && (
          <span className="right-comments-toolbar-actions">
            <button
              className="right-comments-toolbar-action"
              type="button"
              aria-label={copy.filePlaceholder}
              data-tooltip={copy.filePlaceholder}
              aria-pressed={composerMode === "document" && commentScope === "current"}
              onClick={openDocumentComposer}
            >
              <MessageSquarePlus size={14} aria-hidden="true" />
            </button>
            <span className="right-comments-scope-menu-wrap">
              <button
                ref={scopeTriggerRef}
                className="right-comments-toolbar-action"
                type="button"
                aria-label={copy.title}
                data-tooltip={copy.title}
                aria-haspopup="menu"
                aria-expanded={scopeMenuOpen}
                onClick={() => setScopeMenuOpen((open) => !open)}
              >
                <ListFilter size={14} aria-hidden="true" />
              </button>
              {scopeMenuOpen && (
                <div
                  ref={scopeMenuRef}
                  className="right-comments-scope-menu ui-menu"
                  role="menu"
                  aria-label={copy.title}
                  onKeyDown={handleScopeMenuKeyDown}
                >
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={commentScope === "current"}
                    onClick={() => selectScope("current")}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>{copy.currentFile}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={commentScope === "all"}
                    onClick={() => selectScope("all")}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>{copy.all}</span>
                  </button>
                </div>
              )}
            </span>
          </span>
        )}
      </div>
      <div className="right-comments-scroll">
        {!hasAnyComments && (
          <div className="right-comments-empty" aria-label={copy.none}>
            <span>{activeFile ? copy.none : copy.noFile}</span>
            <p>
              {activeFile
                ? commentScope === "current"
                  ? copy.noneCurrentDescription
                  : copy.allDescription
                : copy.noFileDescription}
            </p>
            {activeFile && commentScope === "current" && selectedCharacterCount <= 0 && (
              <button
                className="right-comments-select-text"
                type="button"
                onClick={onRequestTextSelection}
              >
                {copy.selectText}
              </button>
            )}
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
      {activeFile && commentScope === "current" && composerMode && (
        <div className="right-comments-composer">
          <CommentComposer
            activeFileTitle={activeFileTitle}
            commentDraft={commentDraft}
            identityName={identityName}
            selectedText={composerMode === "selection" ? pendingSelectionText : ""}
            selectedCharacterCount={composerMode === "selection" ? pendingSelectionText.length : 0}
            copy={copy}
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
