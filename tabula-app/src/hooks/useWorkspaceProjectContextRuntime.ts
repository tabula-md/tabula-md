import {
  useCallback,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import type { WorkspaceSidePanelProps } from "../components/WorkspaceSidePanel";
import type { DocumentSearchBarProps } from "../components/DocumentControls";
import {
  getLineStartOffset,
  type MarkdownHeading,
} from "@tabula-md/tabula";
import type { RightPanelView } from "../uiTypes";
import type { LiveSelection } from "../collaboration";
import type {
  FileComment,
  FileViewMode,
  WorkspaceFile,
  WorkspaceFolder,
} from "../workspaceStorage";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";

type FocusTextRange = (start: number, end?: number) => void;

type ProjectContextHandlers = Pick<
  WorkspaceSidePanelProps,
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
  | "onStartCommentReply"
  | "onToggleCommentResolved"
  | "onGoToComment"
  | "onRequestTextSelection"
>;

type UseWorkspaceProjectContextRuntimeOptions = ProjectContextHandlers & {
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
  search: Omit<DocumentSearchBarProps, "language">;
  selectedCharacterCount: number;
  pendingSelectionText: string;
  selectionCommentPending: boolean;
  onSelectionCommentRequestHandled: () => void;
  onCancelSelectionComment: () => void;
  setRightPanelOpen: (isOpen: boolean) => void;
  setRightPanelView: (view: RightPanelView) => void;
  setSearchOpen: (isOpen: boolean) => void;
  text: string;
};

export function useWorkspaceProjectContextRuntime({
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
  onRequestTextSelection,
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
  onStartCommentReply,
  onToggleCommentResolved,
  outlineHeadings,
  parsedMarkdownBody,
  previewSurfaceRef,
  replyDraftByCommentId,
  rightPanelOpen,
  rightPanelView,
  search,
  selectedCharacterCount,
  pendingSelectionText,
  selectionCommentPending,
  onSelectionCommentRequestHandled,
  onCancelSelectionComment,
  setRightPanelOpen,
  setRightPanelView,
  setSearchOpen,
  text,
}: UseWorkspaceProjectContextRuntimeOptions) {
  const visibleFiles = files;
  const visibleActiveFileId = activeFile?.id;
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
  const activeOutlineHeadingIndex = useMemo(() => {
    if (outlineCursorOffset === undefined || outlineHeadings.length === 0) {
      return undefined;
    }

    const bodyStartOffset = text.indexOf(parsedMarkdownBody);
    const sourceOffset = Math.max(0, outlineCursorOffset - (bodyStartOffset === -1 ? 0 : bodyStartOffset));
    let activeIndex: number | undefined;
    for (let index = 0; index < outlineHeadings.length; index += 1) {
      if (getLineStartOffset(parsedMarkdownBody, outlineHeadings[index].sourceLineIndex) > sourceOffset) {
        break;
      }
      activeIndex = index;
    }
    return activeIndex;
  }, [outlineCursorOffset, outlineHeadings, parsedMarkdownBody, text]);
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

      const bodyStartOffset = text.indexOf(parsedMarkdownBody);
      const targetOffset =
        (bodyStartOffset === -1 ? 0 : bodyStartOffset) +
        getLineStartOffset(parsedMarkdownBody, heading.sourceLineIndex);
      focusTextRange(
        targetOffset,
        targetOffset + heading.text.length + heading.depth + 1,
      );
    },
    [
      activeViewMode,
      focusTextRange,
      parsedMarkdownBody,
      previewSurfaceRef,
      text,
    ],
  );
  const setPanelView = useCallback((nextView: RightPanelView) => {
    setSearchOpen(nextView === "search");
    setRightPanelView(nextView);
  }, [setRightPanelView, setSearchOpen]);

  const sidePanelProps: WorkspaceSidePanelProps = {
    isOpen: rightPanelOpen,
    view: rightPanelView,
    isLive,
    language,
    files: visibleFiles,
    folders,
    activeFileId: visibleActiveFileId,
    activeFileTitle,
    activeOutlineHeadingIndex,
    search,
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
    onRequestTextSelection,
    formatCommentDate,
  };

  return {
    sidePanelProps,
  };
}
