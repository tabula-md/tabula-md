import {
  useCallback,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import type { WorkspaceRightPanelProps } from "./WorkspaceRightPanel";
import type { MarkdownHeading, WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import {
  getActiveOutlineHeadingIndex,
  getOutlineHeadingOffsets,
} from "../editor/outlineNavigationModel";
import type { RightPanelView } from "../ui/uiTypes";
import type { LiveSelection } from "../collaboration/liveCollaboration";
import type {
  FileComment,
  FileViewMode,
  WorkspaceFile,
  WorkspaceFolder,
} from "../workspace/workspaceStorage";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import {
  getWorkspaceKnowledgeDocuments,
  reconcileWorkspaceKnowledgeIndex,
} from "../workspace/workspaceKnowledgeModel";

type FocusTextRange = (start: number, end?: number) => void;

type RightPanelHandlers = Pick<
  WorkspaceRightPanelProps,
  | "formatCommentDate"
  | "onAddComment"
  | "onAddCommentReply"
  | "onCancelCommentReply"
  | "onCommentDraftChange"
  | "onDeleteComment"
  | "onDeleteFile"
  | "onDeleteFolder"
  | "onCopyFile"
  | "onDuplicateFile"
  | "onIdentityNameChange"
  | "onIdentityNameCommit"
  | "onNewFile"
  | "onNewFolder"
  | "onReplyDraftChange"
  | "onRenameFile"
  | "onRenameFolder"
  | "onMoveFileToFolder"
  | "onMoveFolder"
  | "onSelectFile"
  | "onSetActiveFileOkfType"
  | "onStartCommentReply"
  | "onToggleCommentResolved"
  | "onGoToComment"
>;

type UseWorkspaceRightPanelControllerOptions = RightPanelHandlers & {
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
  focusTextRange: FocusTextRange;
  identityName: string;
  isLive: boolean;
  language: WorkspaceLanguage;
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
  focusTextRange,
  formatCommentDate,
  identityName,
  isLive,
  language,
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
  onMoveFileToFolder,
  onMoveFolder,
  onReplyDraftChange,
  onSelectFile,
  onSetActiveFileOkfType,
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
  text,
}: UseWorkspaceRightPanelControllerOptions) {
  const visibleFiles = files;
  const visibleActiveFileId = activeFile?.id;
  const knowledgeDocuments = useMemo(
    () => getWorkspaceKnowledgeDocuments(visibleFiles, folders),
    [folders, visibleFiles],
  );
  const knowledgeIndexRef = useRef<WorkspaceKnowledgeIndex | undefined>(undefined);
  const knowledgeIndex = useMemo(() => {
    try {
      const next = reconcileWorkspaceKnowledgeIndex(
        knowledgeIndexRef.current,
        knowledgeDocuments,
      );
      knowledgeIndexRef.current = next;
      return next;
    } catch {
      knowledgeIndexRef.current = undefined;
      return undefined;
    }
  }, [knowledgeDocuments]);
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
        ).filter((heading) => !heading.closest(".frontmatter-view"));
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

  const rightPanelProps: WorkspaceRightPanelProps = {
    isOpen: rightPanelOpen,
    view: rightPanelView,
    isLive,
    language,
    files: visibleFiles,
    folders,
    knowledgeIndex,
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
    onClose: () => setRightPanelOpen(false),
    onNewFile,
    onNewFolder,
    onImportFile,
    onSelectFile,
    onSetActiveFileOkfType,
    onRenameFile,
    onDuplicateFile,
    onDeleteFile,
    onDeleteFolder,
    onCopyFile,
    onMoveFileToFolder,
    onMoveFolder,
    onRenameFolder,
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
    rightPanelProps,
  };
}
