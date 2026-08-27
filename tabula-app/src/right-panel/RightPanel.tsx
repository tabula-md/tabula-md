import { Suspense, lazy, type ReactNode, type RefObject, useMemo } from "react";
import {
  Info,
  Link,
  ListTree,
  MessageSquare,
} from "lucide-react";
import { SIDE_PANEL_OVERLAY_ACCESSIBILITY } from "../ui/overlayAccessibility";
import {
  getRightPanelCommentGroups,
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
import { getWorkspaceFileTabLabels } from "../workspace/workspaceDisplayTitles";
import { PanelEmptyState } from "./PanelEmptyState";
import { RightPanelProperties } from "./RightPanelProperties";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { SidePanelTabs } from "../workspace/components/SidePanelTabs";

const RightPanelLinks = lazy(() => import("./RightPanelLinks").then((module) => ({
  default: module.RightPanelLinks,
})));
const RightPanelComments = lazy(() => import("./RightPanelComments").then((module) => ({
  default: module.RightPanelComments,
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
  onSelectFile: (fileId: string) => void;
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
  onSelectFile,
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
  const panelTitle = effectiveView === "metadata"
    ? knowledgeCopy.properties
    : copy.tabs[effectiveView];
  const tabs = [
    { view: "metadata", label: knowledgeCopy.properties, icon: <Info size={14} /> },
    { view: "links", label: copy.tabs.links, icon: <Link size={14} /> },
    { view: "outline", label: copy.tabs.outline, icon: <ListTree size={14} /> },
    {
      view: "comments",
      label: copy.tabs.comments,
      icon: <MessageSquare size={14} />,
      indicator: hasOpenComments
        ? <span className="right-panel-tab-status-dot comments" aria-hidden="true" />
        : undefined,
    },
  ] satisfies Array<{
    view: RightPanelView;
    label: string;
    icon: ReactNode;
    indicator?: ReactNode;
  }>;

  return (
    <aside
      ref={panelRef}
      className="right-panel"
      role={overlayMode ? SIDE_PANEL_OVERLAY_ACCESSIBILITY.role : undefined}
      aria-modal={overlayMode && SIDE_PANEL_OVERLAY_ACCESSIBILITY.ariaModal ? true : undefined}
      aria-label={panelTitle}
      tabIndex={overlayMode ? -1 : undefined}
      data-knowledge-index-source={knowledgeIndexSource}
    >
      <div className="right-panel-header">
        <SidePanelTabs
          activeView={effectiveView}
          ariaLabel={copy.sections}
          controls="right-panel-body"
          items={tabs}
          onSelect={onSetView}
          side="right"
        />
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

        {effectiveView === "metadata" && (
          <RightPanelProperties
            activeFileId={activeFileId}
            markdown={activeFile?.text ?? ""}
            noDocumentCopy={copy.noDocumentOpen}
            emptyCopy={knowledgeCopy.notSet}
            invalidCopy={knowledgeCopy.invalidMetadata}
            label={knowledgeCopy.properties}
          />
        )}
      </div>
    </aside>
  );
}
