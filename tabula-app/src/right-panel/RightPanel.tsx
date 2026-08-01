import {
  Suspense,
  lazy,
  type ReactNode,
  type RefObject,
  useMemo,
} from "react";
import {
  FileSliders,
  Link2,
  ListTree,
  MessageSquare,
  PanelRightClose,
} from "lucide-react";
import {
  getRightPanelCommentGroups,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceKnowledgeIndex,
  type WorkspaceKnowledgeLink,
} from "@tabula-md/tabula";
import { useRightPanelCollapseState } from "./useRightPanelCollapseState";
import type { MarkdownHeading } from "@tabula-md/tabula";
import type { RightPanelView } from "../ui/uiTypes";
import type { FileComment, WorkspaceFile, WorkspaceFolder } from "../workspace/workspaceStorage";
import { RightPanelOutline } from "./RightPanelOutline";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { getWorkspaceFileTabLabels } from "../workspace/workspaceDisplayTitles";
import { PanelEmptyState } from "./PanelEmptyState";

const RightPanelLinks = lazy(() => import("./RightPanelLinks").then((module) => ({
  default: module.RightPanelLinks,
})));
const RightPanelComments = lazy(() => import("./RightPanelComments").then((module) => ({
  default: module.RightPanelComments,
})));
const RightPanelProperties = lazy(() => import("./RightPanelProperties").then((module) => ({
  default: module.RightPanelProperties,
})));

const panelFallback = (
  <section className="right-panel-content" aria-busy="true" />
);

type RightPanelProps = {
  isOpen: boolean;
  view: RightPanelView;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  knowledgeIndex?: WorkspaceKnowledgeIndex;
  knowledgeIndexPending: boolean;
  knowledgeIndexSource: "none" | "worker" | "fallback";
  activeFileId: string;
  activeFileTitle: string;
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
  onSelectFile: (fileId: string) => void;
  onSelectKnowledgeHealthIssue: (issue: WorkspaceKnowledgeHealthIssue) => void;
  onFocusLinkSource: (link: WorkspaceKnowledgeLink) => void;
  onResolveAmbiguousLink: (
    link: WorkspaceKnowledgeLink,
    targetPath: string,
  ) => boolean;
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
  overlayMode?: boolean;
  panelRef?: RefObject<HTMLElement | null>;
};

export function RightPanel({
  isOpen,
  view,
  files,
  folders,
  knowledgeIndex,
  knowledgeIndexPending,
  knowledgeIndexSource,
  activeFileId,
  activeFileTitle,
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
  onSelectFile,
  onSelectKnowledgeHealthIssue,
  onFocusLinkSource,
  onResolveAmbiguousLink,
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
  overlayMode = false,
  panelRef,
}: RightPanelProps) {
  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const knowledgeCopy = getKnowledgePanelCopy(language);
  const closePanelLabel = getWorkspaceChromeCopy(language).topChrome.closeSidePanel;
  const {
    showResolved,
    collapsedReplyIds,
    collapsedCommentFileIds,
    collapsedLinkSections,
    collapsedOutlineHeadingIds,
    toggleResolvedSection,
    toggleRepliesCollapsed,
    toggleCommentFileCollapsed,
    toggleLinkSectionCollapsed,
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
  if (!isOpen) {
    return null;
  }

  const activeFile = files.find((file) => file.id === activeFileId);
  const effectiveView = view;
  const { openCommentGroups, resolvedCommentGroups } = getRightPanelCommentGroups(
    files,
    commentsByFileId,
  );
  const hasOpenComments = openCommentGroups.some((group) => group.comments.length > 0);
  const panelTitle = effectiveView === "properties"
    ? knowledgeCopy.properties
    : copy.tabs[effectiveView];
  const renderTab = (
    tabView: RightPanelView,
    label: string,
    icon: ReactNode,
    indicator?: "live" | "comments",
    tooltip = label,
  ) => (
    <button
      className={`ui-panel-tab right-panel-tab ${effectiveView === tabView ? "active" : ""}`}
      type="button"
      aria-label={label}
      data-tooltip={tooltip}
      aria-pressed={effectiveView === tabView}
      aria-controls="right-panel-body"
      onClick={() => onSetView(tabView)}
    >
      {icon}
      {indicator && <span className={`right-panel-tab-status-dot ${indicator}`} aria-hidden="true" />}
    </button>
  );

  return (
    <aside
      ref={panelRef}
      className="right-panel"
      role={overlayMode ? "dialog" : undefined}
      aria-modal={overlayMode || undefined}
      aria-label={panelTitle}
      tabIndex={overlayMode ? -1 : undefined}
      data-knowledge-index-source={knowledgeIndexSource}
    >
      <div className="right-panel-header">
        <nav className="ui-panel-tabs right-panel-tabs" aria-label={copy.sections}>
          {renderTab("outline", copy.tabs.outline, <ListTree size={14} />)}
          {renderTab("links", copy.tabs.links, <Link2 size={14} />)}
          {renderTab("comments", copy.tabs.comments, <MessageSquare size={14} />, hasOpenComments ? "comments" : undefined)}
          {renderTab(
            "properties",
            knowledgeCopy.properties,
            <FileSliders size={14} />,
          )}
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

      <div className={`right-panel-body ${effectiveView}`} id="right-panel-body">
        {!activeFile && (
          effectiveView === "outline" ||
          effectiveView === "links" ||
          effectiveView === "comments"
        ) && (
          <section className="right-panel-content">
            <PanelEmptyState>{copy.noDocumentOpen}</PanelEmptyState>
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

        {activeFile && effectiveView === "links" && knowledgeIndexPending && !knowledgeIndex &&
          panelFallback}

        {activeFile && effectiveView === "links" && (!knowledgeIndexPending || knowledgeIndex) && (
          <Suspense fallback={panelFallback}>
            <RightPanelLinks
              activeFileId={activeFileId}
              activeFileTitle={activeFileTitle}
              collapsedSections={collapsedLinkSections}
              copy={copy.links}
              fileLabels={fileLabels}
              index={knowledgeIndex}
              onFocusLinkSource={onFocusLinkSource}
              onResolveAmbiguousLink={onResolveAmbiguousLink}
              onSelectFile={onSelectFile}
              onToggleSection={toggleLinkSectionCollapsed}
            />
          </Suspense>
        )}

        {activeFile && effectiveView === "comments" && (
          <Suspense fallback={panelFallback}>
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
          </Suspense>
        )}


        {effectiveView === "properties" && (
          <Suspense fallback={panelFallback}>
            <RightPanelProperties
              activeFileId={activeFileId}
              noDocumentCopy={`${knowledgeCopy.properties}: ${copy.noDocumentOpen}`}
              index={knowledgeIndex}
              language={language}
              onSelectHealthIssue={onSelectKnowledgeHealthIssue}
            />
          </Suspense>
        )}
      </div>
    </aside>
  );
}
