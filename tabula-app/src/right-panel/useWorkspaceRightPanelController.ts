import {
  useCallback,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import type { WorkspaceRightPanelProps } from "./WorkspaceRightPanel";
import type { WorkspaceLeftPanelProps } from "../left-panel/WorkspaceLeftPanel";
import type {
  MarkdownHeading,
  WorkspaceKnowledgeBaseline,
  WorkspaceKnowledgeLink,
} from "@tabula-md/tabula";
import {
  getActiveOutlineHeadingIndex,
  getOutlineHeadingOffsets,
} from "../editor/outlineNavigationModel";
import type { LeftPanelView, RightPanelView } from "../ui/uiTypes";
import type { LiveSelection } from "../collaboration/liveCollaboration";
import type {
  FileComment,
  FileViewMode,
  WorkspaceFile,
  WorkspaceFolder,
} from "../workspace/workspaceStorage";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceKnowledgeDocuments } from "../workspace/workspaceKnowledgeModel";
import { useWorkspaceKnowledgeIndex } from "../workspace/useWorkspaceKnowledgeIndex";

type FocusTextRange = (start: number, end?: number) => void;

type RightPanelHandlers = Pick<
  WorkspaceRightPanelProps,
  | "formatCommentDate"
  | "onAddComment"
  | "onAddCommentReply"
  | "onCancelCommentReply"
  | "onCommentDraftChange"
  | "onDeleteComment"
  | "onIdentityNameChange"
  | "onIdentityNameCommit"
  | "onReplyDraftChange"
  | "onResolveAmbiguousLink"
  | "onSelectFile"
  | "onSelectKnowledgeHealthIssue"
  | "onSetActiveFileOkfType"
  | "onApplyOkfConceptRepairs"
  | "onApplyOkfWikilinkRepairs"
  | "onVerifyKnowledgeDocument"
  | "onMaterializeOkfIndex"
  | "onMaterializeOkfLog"
  | "onStartKnowledgeTracking"
  | "onStartCommentReply"
  | "onToggleCommentResolved"
  | "onGoToComment"
>;

type LeftPanelHandlers = Pick<
  WorkspaceLeftPanelProps,
  | "onNewFile"
  | "onNewFolder"
  | "onDeleteFile"
  | "onDeleteFolder"
  | "onCopyFile"
  | "onDuplicateFile"
  | "onRenameFile"
  | "onRenameFolder"
  | "onRenameWorkspace"
  | "onMoveFileToFolder"
  | "onMoveFolder"
>;

type UseWorkspaceRightPanelControllerOptions = RightPanelHandlers & LeftPanelHandlers & {
  activeCommentId: string | null;
  activeFile?: WorkspaceFile;
  activeFileTitle: string;
  activeReplyCommentId: string | null;
  activeSelection?: LiveSelection;
  activeViewMode: FileViewMode;
  commentDraft: string;
  commentInputRef: RefObject<HTMLTextAreaElement | null>;
  commentsByFileId: Record<string, FileComment[]>;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  knowledgeBaseline?: WorkspaceKnowledgeBaseline;
  knowledgeCompatibilityOpenRequest: number;
  focusTextRange: FocusTextRange;
  identityName: string;
  isLive: boolean;
  language: WorkspaceLanguage;
  leftPanelOpen: boolean;
  leftPanelView: LeftPanelView;
  onImportFile: () => void;
  outlineHeadings: MarkdownHeading[];
  parsedMarkdownBody: string;
  previewSurfaceRef: RefObject<HTMLElement | null>;
  replyDraftByCommentId: Record<string, string>;
  rightPanelOpen: boolean;
  rightPanelView: RightPanelView;
  selectedCharacterCount: number;
  pendingSelectionText: string;
  selectionCommentPending: boolean;
  onSelectionCommentRequestHandled: () => void;
  onCancelSelectionComment: () => void;
  setRightPanelOpen: (isOpen: boolean) => void;
  setRightPanelView: (view: RightPanelView) => void;
  setLeftPanelOpen: (isOpen: boolean) => void;
  setLeftPanelView: (view: LeftPanelView) => void;
  text: string;
};

export function useWorkspaceRightPanelController({
  activeCommentId,
  activeFile,
  activeFileTitle,
  activeReplyCommentId,
  activeSelection,
  activeViewMode,
  commentDraft,
  commentInputRef,
  commentsByFileId,
  files,
  folders,
  knowledgeBaseline,
  knowledgeCompatibilityOpenRequest,
  focusTextRange,
  formatCommentDate,
  identityName,
  isLive,
  language,
  leftPanelOpen,
  leftPanelView,
  onAddComment,
  onAddCommentReply,
  onCancelCommentReply,
  onCommentDraftChange,
  onDeleteComment,
  onDeleteFile,
  onDeleteFolder,
  onCopyFile,
  onDuplicateFile,
  onGoToComment,
  onIdentityNameChange,
  onIdentityNameCommit,
  onImportFile,
  onNewFile,
  onNewFolder,
  onRenameFile,
  onRenameFolder,
  onRenameWorkspace,
  onMoveFileToFolder,
  onMoveFolder,
  onReplyDraftChange,
  onResolveAmbiguousLink,
  onSelectFile,
  onSelectKnowledgeHealthIssue,
  onSetActiveFileOkfType,
  onApplyOkfConceptRepairs,
  onApplyOkfWikilinkRepairs,
  onVerifyKnowledgeDocument,
  onMaterializeOkfIndex,
  onMaterializeOkfLog,
  onStartKnowledgeTracking,
  onStartCommentReply,
  onToggleCommentResolved,
  outlineHeadings,
  parsedMarkdownBody,
  previewSurfaceRef,
  replyDraftByCommentId,
  rightPanelOpen,
  rightPanelView,
  selectedCharacterCount,
  pendingSelectionText,
  selectionCommentPending,
  onSelectionCommentRequestHandled,
  onCancelSelectionComment,
  setRightPanelOpen,
  setRightPanelView,
  setLeftPanelOpen,
  setLeftPanelView,
  text,
}: UseWorkspaceRightPanelControllerOptions) {
  const visibleFiles = files;
  const visibleActiveFileId = activeFile?.id;
  const knowledgeDocuments = useMemo(
    () => getWorkspaceKnowledgeDocuments(visibleFiles, folders),
    [folders, visibleFiles],
  );
  const {
    compatibilityReport: knowledgeCompatibilityReport,
    index: knowledgeIndex,
    pending: knowledgeIndexPending,
    source: knowledgeIndexSource,
  } = useWorkspaceKnowledgeIndex(knowledgeDocuments);
  const outlineCursorRef = useRef({ fileId: visibleActiveFileId, offset: 0 });
  if (outlineCursorRef.current.fileId !== visibleActiveFileId) {
    outlineCursorRef.current = { fileId: visibleActiveFileId, offset: 0 };
  }
  if (activeViewMode !== "preview" && activeSelection) {
    outlineCursorRef.current.offset = activeSelection.to;
  }
  const outlineCursorOffset = activeViewMode === "preview"
    ? undefined
    : outlineCursorRef.current.offset;
  const bodyStartOffset = useMemo(() => {
    const offset = text.indexOf(parsedMarkdownBody);
    return offset === -1 ? 0 : offset;
  }, [parsedMarkdownBody, text]);
  const outlineHeadingOffsets = useMemo(
    () => getOutlineHeadingOffsets(parsedMarkdownBody, outlineHeadings),
    [outlineHeadings, parsedMarkdownBody],
  );
  const activeOutlineHeadingIndex = useMemo(() => {
    if (outlineCursorOffset === undefined || outlineHeadings.length === 0) {
      return undefined;
    }

    const sourceOffset = Math.max(0, outlineCursorOffset - bodyStartOffset);
    return getActiveOutlineHeadingIndex(outlineHeadingOffsets, sourceOffset);
  }, [bodyStartOffset, outlineCursorOffset, outlineHeadingOffsets, outlineHeadings.length]);
  const goToOutlineHeading = useCallback(
    (heading: MarkdownHeading, headingIndex: number) => {
      if (activeViewMode === "preview") {
        const renderedHeadings = Array.from(
          previewSurfaceRef.current?.querySelectorAll("h1, h2, h3") ?? [],
        ).filter((heading) =>
          !heading.closest(".frontmatter-view") &&
          !heading.closest(".preview-workspace-embed-body")
        );
        const renderedHeading = renderedHeadings[headingIndex];
        renderedHeading?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
        return;
      }

      const targetOffset =
        bodyStartOffset + (outlineHeadingOffsets[headingIndex] ?? 0);
      focusTextRange(
        targetOffset,
        targetOffset + heading.text.length + heading.depth + 1,
      );
    },
    [
      activeViewMode,
      bodyStartOffset,
      focusTextRange,
      outlineHeadingOffsets,
      previewSurfaceRef,
    ],
  );
  const setPanelView = useCallback((nextView: RightPanelView) => {
    setRightPanelView(nextView);
  }, [setRightPanelView]);
  const focusLinkSource = useCallback(
    (link: WorkspaceKnowledgeLink) => focusTextRange(link.from, link.to),
    [focusTextRange],
  );
  const closePanel = useCallback(
    () => setRightPanelOpen(false),
    [setRightPanelOpen],
  );
  const closeLeftPanel = useCallback(
    () => setLeftPanelOpen(false),
    [setLeftPanelOpen],
  );
  const setLeftPanelViewOnly = useCallback(
    (view: LeftPanelView) => setLeftPanelView(view),
    [setLeftPanelView],
  );
  const selectFromLeftPanel = useCallback((fileId: string) => {
    onSelectFile(fileId);
    if (typeof window !== "undefined" && window.innerWidth <= 1160) {
      setLeftPanelOpen(false);
    }
  }, [onSelectFile, setLeftPanelOpen]);
  const leftPanelProps: WorkspaceLeftPanelProps = {
    isOpen: leftPanelOpen,
    view: leftPanelView,
    isLive,
    language,
    files: visibleFiles,
    folders,
    knowledgeIndex,
    knowledgeIndexPending,
    knowledgeIndexSource,
    activeFileId: visibleActiveFileId,
    onClose: closeLeftPanel,
    onViewChange: setLeftPanelViewOnly,
    onNewFile,
    onNewFolder,
    onImportFile,
    onSelectFile: selectFromLeftPanel,
    onRenameFile,
    onDuplicateFile,
    onDeleteFile,
    onDeleteFolder,
    onCopyFile,
    onMoveFileToFolder,
    onMoveFolder,
    onRenameFolder,
    onRenameWorkspace,
  };

  const rightPanelProps: WorkspaceRightPanelProps = {
    isOpen: rightPanelOpen,
    view: rightPanelView,
    language,
    isLiveWorkspace: isLive,
    files: visibleFiles,
    folders,
    knowledgeIndex,
    knowledgeCompatibilityReport,
    knowledgeIndexPending,
    knowledgeIndexSource,
    knowledgeBaseline,
    knowledgeCompatibilityOpenRequest,
    activeFileId: visibleActiveFileId,
    activeFileTitle,
    activeOutlineHeadingIndex,
    outlineHeadings,
    commentsByFileId,
    commentDraft,
    identityName,
    pendingSelectionText,
    selectedCharacterCount,
    selectionCommentPending,
    onSelectionCommentRequestHandled,
    onCancelSelectionComment,
    commentInputRef,
    activeCommentId,
    activeReplyCommentId,
    replyDraftByCommentId,
    onSetView: setPanelView,
    onClose: closePanel,
    onNewFile,
    onNewFolder,
    onImportFile,
    onSelectFile,
    onSelectKnowledgeHealthIssue,
    onFocusLinkSource: focusLinkSource,
    onResolveAmbiguousLink,
    onSetActiveFileOkfType,
    onApplyOkfConceptRepairs,
    onApplyOkfWikilinkRepairs,
    onVerifyKnowledgeDocument,
    onMaterializeOkfIndex,
    onMaterializeOkfLog,
    onStartKnowledgeTracking,
    onRenameFile,
    onDuplicateFile,
    onDeleteFile,
    onDeleteFolder,
    onCopyFile,
    onMoveFileToFolder,
    onMoveFolder,
    onRenameFolder,
    onRenameWorkspace,
    onGoToOutlineHeading: goToOutlineHeading,
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
  };

  return {
    knowledgeIndex,
    leftPanelProps,
    rightPanelProps,
  };
}
