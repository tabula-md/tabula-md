import { type ReactNode, type RefObject } from "react";
import {
  Folder,
  ListTree,
  MessageSquare,
  PanelRight,
} from "lucide-react";
import type { ConnectionStatus } from "../collab";
import { useRightPanelCollapseState } from "../hooks/useRightPanelCollapseState";
import type { RenameFileResult } from "../hooks/useMarkdownFiles";
import type { MarkdownHeading } from "../markdown";
import { getRightPanelCommentGroups } from "../rightPanelCommentViewModel";
import type { RightPanelView } from "../uiTypes";
import type { FileComment, MarkdownFile } from "../workspaceStorage";
import { RightPanelComments } from "./RightPanelComments";
import { RightPanelFiles } from "./RightPanelFiles";
import { RightPanelOutline } from "./RightPanelOutline";

type RightPanelProps = {
  isOpen: boolean;
  view: RightPanelView;
  commentsEnabled: boolean;
  files: MarkdownFile[];
  openFileIds: string[];
  activeFileId: string;
  activeFileTitle: string;
  fileQuery: string;
  outlineHeadings: MarkdownHeading[];
  commentsByFileId: Record<string, FileComment[]>;
  commentDraft: string;
  identityName: string;
  selectedText: string;
  selectedCharacterCount: number;
  commentInputRef?: RefObject<HTMLTextAreaElement | null>;
  activeCommentId?: string | null;
  activeReplyCommentId?: string | null;
  replyDraftByCommentId: Record<string, string>;
  getFileStatus: (file: MarkdownFile) => ConnectionStatus;
  getFileSearchText: (file: MarkdownFile) => string;
  onSetView: (view: RightPanelView) => void;
  onClose: () => void;
  onFileQueryChange: (query: string) => void;
  onNewFile: () => void;
  onImportMarkdown: () => void;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onGoToOutlineHeading: (heading: MarkdownHeading, index: number) => void;
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
  formatCommentDate: (isoDate: string) => string;
};

export function RightPanel({
  isOpen,
  view,
  commentsEnabled,
  files,
  openFileIds,
  activeFileId,
  activeFileTitle,
  fileQuery,
  outlineHeadings,
  commentsByFileId,
  commentDraft,
  identityName,
  selectedText,
  selectedCharacterCount,
  commentInputRef,
  activeCommentId,
  activeReplyCommentId,
  replyDraftByCommentId,
  getFileStatus,
  getFileSearchText,
  onSetView,
  onClose,
  onFileQueryChange,
  onNewFile,
  onImportMarkdown,
  onSelectFile,
  onCloseFile,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onGoToOutlineHeading,
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
}: RightPanelProps) {
  const visibleCommentsByFileId = commentsEnabled ? commentsByFileId : {};
  const {
    showResolved,
    collapsedReplyIds,
    collapsedCommentFileIds,
    collapsedFileTreeFolderIds,
    collapsedOutlineHeadingIds,
    toggleResolvedSection,
    toggleRepliesCollapsed,
    toggleCommentFileCollapsed,
    toggleFileTreeFolderCollapsed,
    toggleOutlineHeadingCollapsed,
  } = useRightPanelCollapseState({
    activeFileId,
    activeCommentId,
    activeReplyCommentId,
    commentsByFileId: visibleCommentsByFileId,
  });

  if (!isOpen) {
    return null;
  }

  const activeFile = files.find((file) => file.id === activeFileId);
  const effectiveView = commentsEnabled || view !== "comments" ? view : "files";
  const { openCommentGroups, resolvedCommentGroups, openCommentCount } = getRightPanelCommentGroups(
    files,
    visibleCommentsByFileId,
  );
  const renderTab = (tabView: RightPanelView, label: string, icon: ReactNode, count?: number) => (
    <button
      className={`right-panel-tab ${effectiveView === tabView ? "active" : ""} ${
        typeof count === "number" && count > 0 ? "has-count" : ""
      }`}
      type="button"
      title={label}
      aria-label={label}
      onClick={() => onSetView(tabView)}
    >
      {icon}
      {typeof count === "number" && count > 0 && <small>{count}</small>}
    </button>
  );

  return (
    <aside className="right-panel" aria-label="Project Context">
      <div className="right-panel-header">
        <nav className="right-panel-tabs" aria-label="Project context sections">
          {renderTab("files", "Files", <Folder size={14} />)}
          {renderTab("outline", "Outline", <ListTree size={14} />)}
          {commentsEnabled && renderTab("comments", "Comments", <MessageSquare size={14} />, openCommentCount)}
        </nav>
        <button className="right-panel-close" type="button" aria-label="Close Project Context" onClick={onClose}>
          <PanelRight size={16} />
        </button>
      </div>

      <div className={`right-panel-body ${effectiveView === "comments" ? "comments" : ""}`}>
        {effectiveView === "files" && (
          <RightPanelFiles
            files={files}
            openFileIds={openFileIds}
            activeFileId={activeFileId}
            fileQuery={fileQuery}
            commentsByFileId={visibleCommentsByFileId}
            collapsedFolderIds={collapsedFileTreeFolderIds}
            getFileStatus={getFileStatus}
            getFileSearchText={getFileSearchText}
            onFileQueryChange={onFileQueryChange}
            onNewFile={onNewFile}
            onImportMarkdown={onImportMarkdown}
            onToggleFolder={toggleFileTreeFolderCollapsed}
            onSelectFile={onSelectFile}
            onCloseFile={onCloseFile}
            onRenameFile={onRenameFile}
            onDuplicateFile={onDuplicateFile}
            onDeleteFile={onDeleteFile}
          />
        )}

        {effectiveView === "outline" && (
          <RightPanelOutline
            activeFileTitle={activeFileTitle}
            outlineHeadings={outlineHeadings}
            collapsedHeadingIds={collapsedOutlineHeadingIds}
            onToggleHeadingCollapsed={toggleOutlineHeadingCollapsed}
            onGoToOutlineHeading={onGoToOutlineHeading}
          />
        )}

        {effectiveView === "comments" && commentsEnabled && (
          <RightPanelComments
            activeFile={activeFile}
            activeFileId={activeFileId}
            activeFileTitle={activeFileTitle}
            openCommentGroups={openCommentGroups}
            resolvedCommentGroups={resolvedCommentGroups}
            showResolved={showResolved}
            commentDraft={commentDraft}
            identityName={identityName}
            selectedText={selectedText}
            selectedCharacterCount={selectedCharacterCount}
            commentInputRef={commentInputRef}
            activeCommentId={activeCommentId}
            activeReplyCommentId={activeReplyCommentId}
            collapsedReplyIds={collapsedReplyIds}
            collapsedCommentFileIds={collapsedCommentFileIds}
            replyDraftByCommentId={replyDraftByCommentId}
            onToggleResolvedSection={toggleResolvedSection}
            onToggleRepliesCollapsed={toggleRepliesCollapsed}
            onToggleCommentFileCollapsed={toggleCommentFileCollapsed}
            onCommentDraftChange={onCommentDraftChange}
            onIdentityNameChange={onIdentityNameChange}
            onIdentityNameCommit={onIdentityNameCommit}
            onAddComment={onAddComment}
            onGoToComment={onGoToComment}
            onStartCommentReply={onStartCommentReply}
            onCancelCommentReply={onCancelCommentReply}
            onReplyDraftChange={onReplyDraftChange}
            onAddCommentReply={onAddCommentReply}
            onToggleCommentResolved={onToggleCommentResolved}
            onDeleteComment={onDeleteComment}
            formatCommentDate={formatCommentDate}
          />
        )}
      </div>
    </aside>
  );
}
