import { type ReactNode, type RefObject, useMemo } from "react";
import {
  Folder,
  Link2,
  ListTree,
  MessageSquare,
  Network,
  PanelRightClose,
  Search,
} from "lucide-react";
import {
  getRightPanelCommentGroups,
  getWorkspaceOkfCompatibility,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import { useRightPanelCollapseState } from "./useRightPanelCollapseState";
import type { RenameFileResult } from "../workspace/state/useWorkspaceFiles";
import type { MarkdownHeading } from "@tabula-md/tabula";
import type { RightPanelView } from "../ui/uiTypes";
import type { FileComment, WorkspaceFile, WorkspaceFolder } from "../workspace/workspaceStorage";
import { RightPanelComments } from "./RightPanelComments";
import { RightPanelFiles } from "./RightPanelFiles";
import { RightPanelOutline } from "./RightPanelOutline";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import { RightPanelSearch } from "./RightPanelSearch";
import { getWorkspaceFileTabLabels } from "../workspace/workspaceDisplayTitles";
import { PanelEmptyState } from "./PanelEmptyState";
import { RightPanelLinks } from "./RightPanelLinks";
import { RightPanelGraph } from "./RightPanelGraph";
import { getKnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";

type RightPanelProps = {
  isOpen: boolean;
  view: RightPanelView;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  knowledgeIndex?: WorkspaceKnowledgeIndex;
  activeFileId: string;
  activeFileTitle: string;
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
  onSetView: (view: RightPanelView) => void;
  onClose: () => void;
  onNewFile: (overrides?: Partial<WorkspaceFile>) => WorkspaceFile | undefined;
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
  onSelectionCommentRequestHandled: () => void;
  onCancelSelectionComment: () => void;
  formatCommentDate: (isoDate: string) => string;
};

export function RightPanel({
  isOpen,
  view,
  files,
  folders,
  knowledgeIndex,
  activeFileId,
  activeFileTitle,
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
  onSetView,
  onClose,
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
  onSelectionCommentRequestHandled,
  onCancelSelectionComment,
  formatCommentDate,
}: RightPanelProps) {
  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const closePanelLabel = getWorkspaceChromeCopy(language).topChrome.toggleSidePanel;
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
    collapseAllFileTreeFolders,
    expandAllFileTreeFolders,
    toggleOutlineHeadingCollapsed,
    collapseAllOutlineHeadings,
    expandAllOutlineHeadings,
  } = useRightPanelCollapseState({
    activeFileId,
    activeCommentId,
    activeReplyCommentId,
    commentsByFileId,
  });
  const fileLabels = useMemo(
    () => getWorkspaceFileTabLabels(files, folders),
    [files, folders],
  );
  const compatibilityCopy = getKnowledgeCompatibilityCopy(language);
  const compatibilityReport = useMemo(
    () => knowledgeIndex ? getWorkspaceOkfCompatibility(knowledgeIndex) : undefined,
    [knowledgeIndex],
  );

  if (!isOpen) {
    return null;
  }

  const activeFile = files.find((file) => file.id === activeFileId);
  const hasDocuments = files.length > 0;
  const effectiveView = view;
  const { openCommentGroups, resolvedCommentGroups } = getRightPanelCommentGroups(
    files,
    commentsByFileId,
  );
  const hasLiveFiles = isLiveWorkspace;
  const hasOpenComments = openCommentGroups.some((group) => group.comments.length > 0);
  const renderTab = (
    tabView: RightPanelView,
    label: string,
    icon: ReactNode,
    indicator?: "live" | "comments",
  ) => (
    <button
      className={`right-panel-tab ${effectiveView === tabView ? "active" : ""}`}
      type="button"
      aria-label={label}
      data-tooltip={label}
      aria-pressed={effectiveView === tabView}
      onClick={() => onSetView(tabView)}
    >
      {icon}
      {indicator && <span className={`right-panel-tab-status-dot ${indicator}`} aria-hidden="true" />}
    </button>
  );

  return (
    <aside className="right-panel" aria-label={copy.label}>
      <div className="right-panel-header">
        <nav className="right-panel-tabs" aria-label={copy.sections}>
          {renderTab("files", copy.tabs.files, <Folder size={14} />, hasLiveFiles ? "live" : undefined)}
          {renderTab("outline", copy.tabs.outline, <ListTree size={14} />)}
          {renderTab("links", copy.tabs.links, <Link2 size={14} />)}
          {renderTab("graph", copy.tabs.graph, <Network size={14} />)}
          {renderTab("comments", copy.tabs.comments, <MessageSquare size={14} />, hasOpenComments ? "comments" : undefined)}
          {renderTab("search", copy.tabs.search, <Search size={14} />)}
        </nav>
        <button
          className="right-panel-overlay-toggle"
          type="button"
          aria-label={closePanelLabel}
          data-tooltip={closePanelLabel}
          aria-pressed="true"
          onClick={onClose}
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      <div className={`right-panel-body ${effectiveView}`}>
        {effectiveView === "files" && (
          <RightPanelFiles
            files={files}
            folders={folders}
            activeFileId={activeFileId}
            copy={copy.files}
            compatibilityCopy={compatibilityCopy}
            compatibilityReport={compatibilityReport}
            collapsedFolderIds={collapsedFileTreeFolderIds}
            onNewFile={(parentId) => onNewFile(parentId ? { parentId } : undefined)}
            onNewFolder={onNewFolder}
            onImportFile={onImportFile}
            onToggleFolder={toggleFileTreeFolderCollapsed}
            onCollapseAllFolders={collapseAllFileTreeFolders}
            onExpandAllFolders={expandAllFileTreeFolders}
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

        {!activeFile && (
          effectiveView === "outline" ||
          effectiveView === "links" ||
          effectiveView === "graph" ||
          effectiveView === "comments"
        ) && (
          <section className="right-panel-content">
            <PanelEmptyState>{copy.noDocumentOpen}</PanelEmptyState>
          </section>
        )}

        {!hasDocuments && effectiveView === "search" && (
          <section className="right-panel-content">
            <PanelEmptyState>{copy.search.noDocuments}</PanelEmptyState>
          </section>
        )}

        {activeFile && effectiveView === "outline" && (
          <RightPanelOutline
            activeFileTitle={activeFileTitle}
            activeHeadingIndex={activeOutlineHeadingIndex}
            outlineHeadings={outlineHeadings}
            collapsedHeadingIds={collapsedOutlineHeadingIds}
            copy={copy.outline}
            onToggleHeadingCollapsed={toggleOutlineHeadingCollapsed}
            onCollapseAllHeadings={collapseAllOutlineHeadings}
            onExpandAllHeadings={expandAllOutlineHeadings}
            onGoToOutlineHeading={onGoToOutlineHeading}
          />
        )}

        {activeFile && effectiveView === "links" && (
          <RightPanelLinks
            activeFileId={activeFileId}
            activeFileTitle={activeFileTitle}
            copy={copy.links}
            fileLabels={fileLabels}
            index={knowledgeIndex}
            onSelectFile={onSelectFile}
          />
        )}

        {activeFile && effectiveView === "graph" && (
          <RightPanelGraph
            activeFileId={activeFileId}
            activeFileTitle={activeFileTitle}
            copy={copy.graph}
            fileLabels={fileLabels}
            index={knowledgeIndex}
            onSelectFile={onSelectFile}
          />
        )}

        {activeFile && effectiveView === "comments" && (
          <RightPanelComments
            activeFile={activeFile}
            activeFileId={activeFileId}
            activeFileTitle={activeFileTitle}
            fileLabels={fileLabels}
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
            onSelectionCommentRequestHandled={onSelectionCommentRequestHandled}
            onCancelSelectionComment={onCancelSelectionComment}
            formatCommentDate={formatCommentDate}
          />
        )}

        {hasDocuments && effectiveView === "search" && (
          <RightPanelSearch
            copy={copy.search}
            files={files}
            folders={folders}
            language={language}
            onSelectFile={onSelectFile}
          />
        )}
      </div>
    </aside>
  );
}
