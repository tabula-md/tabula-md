import { type ReactNode, type RefObject } from "react";
import {
  Folder,
  ListTree,
  MessageSquare,
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
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";

type RightPanelProps = {
  isOpen: boolean;
  view: RightPanelView;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  activeFileId: string;
  activeFileTitle: string;
  fileQuery: string;
  isLiveWorkspace: boolean;
  language: WorkspaceLanguage;
  activeOutlineHeadingIndex?: number;
  outlineHeadings: MarkdownHeading[];
  commentsByFileId: Record<string, FileComment[]>;
  commentDraft: string;
  identityName: string;
  pendingSelectionText: string;
  selectedCharacterCount: number;
  selectionCommentPending: boolean;
  commentInputRef?: RefObject<HTMLTextAreaElement | null>;
  activeCommentId?: string | null;
  activeReplyCommentId?: string | null;
  replyDraftByCommentId: Record<string, string>;
  getFileSearchText: (file: WorkspaceFile) => string;
  onSetView: (view: RightPanelView) => void;
  onFileQueryChange: (query: string) => void;
  onNewFile: () => void;
  onNewFolder: (parentId?: string) => WorkspaceFolder | undefined;
  onImportFile: () => void;
  onSelectFile: (fileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCopyFile: (fileId: string) => void;
  onMoveFileToFolder: (fileId: string, folderId: string) => void;
  onMoveFolder: (folderId: string, parentId: string) => void;
  onRenameFolder: (folderId: string, nextTitle: string) => boolean;
  onGoToOutlineHeading: (heading: MarkdownHeading, index: number) => void;
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
  formatCommentDate: (isoDate: string) => string;
};

export function RightPanel({
  isOpen,
  view,
  files,
  folders,
  activeFileId,
  activeFileTitle,
  fileQuery,
  isLiveWorkspace,
  language,
  activeOutlineHeadingIndex,
  outlineHeadings,
  commentsByFileId,
  commentDraft,
  identityName,
  pendingSelectionText,
  selectedCharacterCount,
  selectionCommentPending,
  commentInputRef,
  activeCommentId,
  activeReplyCommentId,
  replyDraftByCommentId,
  getFileSearchText,
  onSetView,
  onFileQueryChange,
  onNewFile,
  onNewFolder,
  onImportFile,
  onSelectFile,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onDeleteFolder,
  onCopyFile,
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
  onRequestTextSelection,
  onSelectionCommentRequestHandled,
  onCancelSelectionComment,
  formatCommentDate,
}: RightPanelProps) {
  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
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
    commentsByFileId,
  });

  if (!isOpen) {
    return null;
  }

  const activeFile = files.find((file) => file.id === activeFileId);
  const effectiveView = view;
  const { openCommentGroups, resolvedCommentGroups } = getRightPanelCommentGroups(
    files,
    commentsByFileId,
  );
  const hasLiveFiles = isLiveWorkspace;
  const renderTab = (
    tabView: RightPanelView,
    label: string,
    icon: ReactNode,
    live = false,
  ) => (
    <button
      className={`right-panel-tab ${effectiveView === tabView ? "active" : ""} ${live ? "live" : ""}`}
      type="button"
      aria-label={label}
      data-tooltip={label}
      aria-pressed={effectiveView === tabView}
      onClick={() => onSetView(tabView)}
    >
      {icon}
      {live && <span className="right-panel-tab-live-dot" aria-hidden="true" />}
    </button>
  );

  return (
    <aside className="right-panel" aria-label={copy.label}>
      <div className="right-panel-header">
        <nav className="right-panel-tabs" aria-label={copy.sections}>
          {renderTab("files", copy.tabs.files, <Folder size={14} />, hasLiveFiles)}
          {renderTab("outline", copy.tabs.outline, <ListTree size={14} />)}
          {renderTab("comments", copy.tabs.comments, <MessageSquare size={14} />)}
        </nav>
      </div>

      <div className={`right-panel-body ${effectiveView}`}>
        {effectiveView === "files" && (
          <RightPanelFiles
            files={files}
            folders={folders}
            activeFileId={activeFileId}
            fileQuery={fileQuery}
            isLiveWorkspace={isLiveWorkspace}
            copy={copy.files}
            collapsedFolderIds={collapsedFileTreeFolderIds}
            getFileSearchText={getFileSearchText}
            onFileQueryChange={onFileQueryChange}
            onNewFile={onNewFile}
            onNewFolder={onNewFolder}
            onImportFile={onImportFile}
            onToggleFolder={toggleFileTreeFolderCollapsed}
            onSelectFile={onSelectFile}
            onRenameFile={onRenameFile}
            onDuplicateFile={onDuplicateFile}
            onDeleteFile={onDeleteFile}
            onDeleteFolder={onDeleteFolder}
            onCopyFile={onCopyFile}
            onMoveFileToFolder={onMoveFileToFolder}
            onMoveFolder={onMoveFolder}
            onRenameFolder={onRenameFolder}
          />
        )}

        {effectiveView === "outline" && (
          <RightPanelOutline
            activeFileTitle={activeFileTitle}
            activeHeadingIndex={activeOutlineHeadingIndex}
            outlineHeadings={outlineHeadings}
            collapsedHeadingIds={collapsedOutlineHeadingIds}
            copy={copy.outline}
            onToggleHeadingCollapsed={toggleOutlineHeadingCollapsed}
            onGoToOutlineHeading={onGoToOutlineHeading}
          />
        )}

        {effectiveView === "comments" && (
          <RightPanelComments
            activeFile={activeFile}
            activeFileId={activeFileId}
            activeFileTitle={activeFileTitle}
            openCommentGroups={openCommentGroups}
            resolvedCommentGroups={resolvedCommentGroups}
            showResolved={showResolved}
            commentDraft={commentDraft}
            identityName={identityName}
            pendingSelectionText={pendingSelectionText}
            selectedCharacterCount={selectedCharacterCount}
            selectionCommentPending={selectionCommentPending}
            commentInputRef={commentInputRef}
            activeCommentId={activeCommentId}
            activeReplyCommentId={activeReplyCommentId}
            collapsedReplyIds={collapsedReplyIds}
            collapsedCommentFileIds={collapsedCommentFileIds}
            replyDraftByCommentId={replyDraftByCommentId}
            copy={copy.comments}
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
            onRequestTextSelection={onRequestTextSelection}
            onSelectionCommentRequestHandled={onSelectionCommentRequestHandled}
            onCancelSelectionComment={onCancelSelectionComment}
            formatCommentDate={formatCommentDate}
          />
        )}
      </div>
    </aside>
  );
}
