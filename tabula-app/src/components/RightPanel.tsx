import { type ReactNode, type RefObject } from "react";
import {
  Folder,
  ListTree,
  MessageSquare,
  X,
} from "lucide-react";
import { getRightPanelCommentGroups } from "@tabula-md/tabula";
import { useRightPanelCollapseState } from "../hooks/useRightPanelCollapseState";
import type { RenameFileResult } from "../hooks/useWorkspaceFiles";
import type { MarkdownHeading } from "@tabula-md/tabula";
import type { RightPanelView } from "../uiTypes";
import type { FileComment, WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import { RightPanelComments } from "./RightPanelComments";
import { RightPanelFiles } from "./RightPanelFiles";
import { RightPanelOutline } from "./RightPanelOutline";

type RightPanelProps = {
  isOpen: boolean;
  view: RightPanelView;
  commentsEnabled: boolean;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  openFileIds: string[];
  activeFileId: string;
  activeFileTitle: string;
  fileQuery: string;
  isLiveWorkspace: boolean;
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
  getFileSearchText: (file: WorkspaceFile) => string;
  onSetView: (view: RightPanelView) => void;
  onClose: () => void;
  onFileQueryChange: (query: string) => void;
  onNewFile: () => void;
  onNewFolder: (parentId?: string) => WorkspaceFolder | undefined;
  onImportFile: () => void;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFileToFolder: (fileId: string, folderId: string) => void;
  onMoveFolder: (folderId: string, parentId: string) => void;
  onRenameFolder: (folderId: string, nextTitle: string) => boolean;
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
  folders,
  openFileIds,
  activeFileId,
  activeFileTitle,
  fileQuery,
  isLiveWorkspace,
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
  getFileSearchText,
  onSetView,
  onClose,
  onFileQueryChange,
  onNewFile,
  onNewFolder,
  onImportFile,
  onSelectFile,
  onCloseFile,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onDeleteFolder,
  onMoveFileToFolder,
  onMoveFolder,
  onRenameFolder,
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
  const effectiveView = !commentsEnabled && view === "comments" ? "files" : view;
  const { openCommentGroups, resolvedCommentGroups, openCommentCount } = getRightPanelCommentGroups(
    files,
    visibleCommentsByFileId,
  );
  const hasLiveFiles = isLiveWorkspace;
  const renderTab = (
    tabView: RightPanelView,
    label: string,
    icon: ReactNode,
    count?: number,
    live = false,
  ) => (
    <button
      className={`right-panel-tab ${effectiveView === tabView ? "active" : ""} ${
        typeof count === "number" && count > 0 ? "has-count" : ""
      } ${live ? "live" : ""}`}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={effectiveView === tabView}
      onClick={() => onSetView(tabView)}
    >
      {icon}
      <span className="right-panel-tab-label">{label}</span>
      {live && <span className="right-panel-tab-live-dot" aria-hidden="true" />}
      {typeof count === "number" && count > 0 && <small>{count}</small>}
    </button>
  );

  return (
    <aside className="right-panel" aria-label="Project Context">
      <div className="right-panel-header">
        <nav className="right-panel-tabs" aria-label="Project context sections">
          {renderTab("files", "Files", <Folder size={14} />, undefined, hasLiveFiles)}
          {renderTab("outline", "Outline", <ListTree size={14} />)}
          {commentsEnabled && renderTab("comments", "Comments", <MessageSquare size={14} />, openCommentCount)}
        </nav>
        <button className="right-panel-close" type="button" aria-label="Close Project Context" onClick={onClose}>
          <X size={17} />
        </button>
      </div>

      <div className={`right-panel-body ${effectiveView === "comments" ? "comments" : ""}`}>
        {effectiveView === "files" && (
          <RightPanelFiles
            files={files}
            folders={folders}
            openFileIds={openFileIds}
            activeFileId={activeFileId}
            fileQuery={fileQuery}
            isLiveWorkspace={isLiveWorkspace}
            commentsByFileId={visibleCommentsByFileId}
            collapsedFolderIds={collapsedFileTreeFolderIds}
            getFileSearchText={getFileSearchText}
            onFileQueryChange={onFileQueryChange}
            onNewFile={onNewFile}
            onNewFolder={onNewFolder}
            onImportFile={onImportFile}
            onToggleFolder={toggleFileTreeFolderCollapsed}
            onSelectFile={onSelectFile}
            onCloseFile={onCloseFile}
            onRenameFile={onRenameFile}
            onDuplicateFile={onDuplicateFile}
            onDeleteFile={onDeleteFile}
            onDeleteFolder={onDeleteFolder}
            onMoveFileToFolder={onMoveFileToFolder}
            onMoveFolder={onMoveFolder}
            onRenameFolder={onRenameFolder}
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
