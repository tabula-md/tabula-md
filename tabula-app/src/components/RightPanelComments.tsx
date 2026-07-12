import { useVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ListFilter, MessageSquarePlus, X } from "lucide-react";
import {
  getRightPanelCommentScopeModel,
  type CommentScope,
  type RightPanelCommentGroup as CoreRightPanelCommentGroup,
} from "@tabula-md/tabula";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";
import { CommentComposer } from "./right-panel/comments/CommentComposer";
import { CommentCard } from "./right-panel/comments/CommentCard";
import { getCommentVirtualRows } from "./right-panel/comments/commentVirtualRows";
import type { FormatCommentDate } from "./right-panel/comments/types";
import type { RightPanelCommentsCopy } from "./right-panel/comments/types";
import { stripMarkdownExtension } from "@tabula-md/tabula";
import { MenuContent, MenuRadioGroup, MenuRadioItem, MenuRoot, MenuTrigger } from "./ui/Menu";

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
  const commentScrollRef = useRef<HTMLDivElement | null>(null);
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
  const virtualRows = useMemo(
    () => getCommentVirtualRows({
      activeFileId,
      openCommentGroups: scopedOpenCommentGroups,
      resolvedCommentGroups: scopedResolvedCommentGroups,
      hideSingleActiveFileHeader,
      collapsedCommentFileIds,
      showResolved,
    }),
    [
      activeFileId,
      collapsedCommentFileIds,
      hideSingleActiveFileHeader,
      scopedOpenCommentGroups,
      scopedResolvedCommentGroups,
      showResolved,
    ],
  );
  const commentVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => commentScrollRef.current,
    estimateSize: (index) => virtualRows[index]?.type === "comment" ? 128 : 36,
    getItemKey: (index) => virtualRows[index]?.key ?? index,
    overscan: 6,
  });

  useEffect(() => {
    if (!activeCommentId) {
      return;
    }

    setCommentScope("current");
    setComposerMode(null);
  }, [activeCommentId, activeFileId]);

  useEffect(() => {
    if (!activeCommentId) return;
    const activeRowIndex = virtualRows.findIndex(
      (row) => row.type === "comment" && row.comment.id === activeCommentId,
    );
    if (activeRowIndex >= 0) {
      commentVirtualizer.scrollToIndex(activeRowIndex, { align: "center" });
    }
  }, [activeCommentId, commentVirtualizer, virtualRows]);

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

  const toggleDocumentComposer = () => {
    if (composerMode === "document" && commentScope === "current") {
      cancelComment();
      return;
    }

    if (composerMode === "selection") {
      onCancelSelectionComment();
    }
    onCommentDraftChange("");
    setCommentScope("current");
    setComposerMode("document");
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
              aria-label={composerMode === "document" && commentScope === "current" ? copy.cancel : copy.filePlaceholder}
              data-tooltip={composerMode === "document" && commentScope === "current" ? copy.cancel : copy.filePlaceholder}
              aria-pressed={composerMode === "document" && commentScope === "current"}
              onClick={toggleDocumentComposer}
            >
              {composerMode === "document" && commentScope === "current" ? (
                <X size={14} aria-hidden="true" />
              ) : (
                <MessageSquarePlus size={14} aria-hidden="true" />
              )}
            </button>
            <MenuRoot open={scopeMenuOpen} onOpenChange={setScopeMenuOpen}>
              <span className="right-comments-scope-menu-wrap">
                <MenuTrigger asChild>
                  <button
                    className="right-comments-toolbar-action"
                    type="button"
                    aria-label={copy.title}
                    data-tooltip={copy.title}
                  >
                    <ListFilter size={14} aria-hidden="true" />
                  </button>
                </MenuTrigger>
              </span>
              <MenuContent className="right-comments-scope-menu" ariaLabel={copy.title}>
                <MenuRadioGroup value={commentScope} onValueChange={(value) => selectScope(value as CommentScope)}>
                  <MenuRadioItem value="current" label={copy.currentFile} />
                  <MenuRadioItem value="all" label={copy.all} />
                </MenuRadioGroup>
              </MenuContent>
            </MenuRoot>
          </span>
        )}
      </div>
      <div className="right-comments-scroll" ref={commentScrollRef}>
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
        {hasAnyComments && (
          <div
            className="right-comment-virtual-list"
            style={{ height: `${commentVirtualizer.getTotalSize()}px` }}
          >
            {commentVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = virtualRows[virtualRow.index];
              if (!row) return null;
              const virtualStyle = {
                transform: `translateY(${virtualRow.start}px)`,
              };
              if (row.type === "resolved-header") {
                return (
                  <div
                    ref={commentVirtualizer.measureElement}
                    className="right-comment-virtual-row header"
                    data-index={virtualRow.index}
                    key={row.key}
                    style={virtualStyle}
                  >
                    <button
                      className="right-row right-resolved-comments-header"
                      type="button"
                      aria-label={showResolved ? copy.hideResolved : copy.showResolved}
                      onClick={onToggleResolvedSection}
                    >
                      {showResolved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>{copy.resolved(row.count)}</span>
                    </button>
                  </div>
                );
              }
              if (row.type === "group-header") {
                const collapsed = collapsedCommentFileIds.has(row.group.file.id);
                return (
                  <div
                    ref={commentVirtualizer.measureElement}
                    className="right-comment-virtual-row header"
                    data-index={virtualRow.index}
                    key={row.key}
                    style={virtualStyle}
                  >
                    <button
                      className={`right-row right-comment-file ${row.group.file.id === activeFileId ? "active" : ""}`}
                      type="button"
                      title={row.group.file.title}
                      aria-expanded={!collapsed}
                      onClick={() => onToggleCommentFileCollapsed(row.group.file.id)}
                    >
                      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span className="right-row-label">{stripMarkdownExtension(row.group.file.title)}</span>
                    </button>
                  </div>
                );
              }
              return (
                <div
                  ref={commentVirtualizer.measureElement}
                  className={`right-comment-virtual-row comment right-comment-group ${row.variant}`}
                  data-index={virtualRow.index}
                  key={row.key}
                  style={virtualStyle}
                >
                  <CommentCard
                    fileId={row.file.id}
                    comment={row.comment}
                    copy={copy}
                    isActive={row.comment.id === activeCommentId}
                    isReplying={activeReplyCommentId === row.comment.id}
                    repliesCollapsed={collapsedReplyIds.has(row.comment.id)}
                    replyDraft={replyDraftByCommentId[row.comment.id] ?? ""}
                    onToggleRepliesCollapsed={onToggleRepliesCollapsed}
                    onGoToComment={onGoToComment}
                    onStartCommentReply={onStartCommentReply}
                    onCancelCommentReply={onCancelCommentReply}
                    onReplyDraftChange={onReplyDraftChange}
                    onAddCommentReply={onAddCommentReply}
                    onToggleCommentResolved={onToggleCommentResolved}
                    onDeleteComment={onDeleteComment}
                    formatCommentDate={formatCommentDate}
                  />
                </div>
              );
            })}
          </div>
        )}
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
