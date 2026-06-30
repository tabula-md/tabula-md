import {
  useCallback,
  useEffect,
  useState,
  type RefObject,
} from "react";
import type { ConnectionStatus } from "../collaboration";
import type { WorkspaceProjectContextProps } from "../components/WorkspaceProjectContext";
import {
  getLineStartOffset,
  type MarkdownHeading,
} from "../markdown";
import type { RightPanelView } from "../uiTypes";
import { getWorkspaceFileStatus } from "../workspace";
import type {
  FileComment,
  FileViewMode,
  WorkspaceFile,
} from "../workspaceStorage";

type FocusTextRange = (start: number, end?: number) => void;

type ProjectContextHandlers = Pick<
  WorkspaceProjectContextProps,
  | "formatCommentDate"
  | "onAddComment"
  | "onAddCommentReply"
  | "onCancelCommentReply"
  | "onCloseFile"
  | "onCommentDraftChange"
  | "onDeleteComment"
  | "onDeleteFile"
  | "onDuplicateFile"
  | "onIdentityNameChange"
  | "onIdentityNameCommit"
  | "onNewFile"
  | "onReplyDraftChange"
  | "onRenameFile"
  | "onSelectFile"
  | "onStartCommentReply"
  | "onToggleCommentResolved"
  | "onGoToComment"
>;

type UseWorkspaceProjectContextRuntimeOptions = ProjectContextHandlers & {
  activeCommentId: string | null;
  activeFile?: WorkspaceFile;
  activeFileTitle: string;
  activeReplyCommentId: string | null;
  activeViewMode: FileViewMode;
  commentDraft: string;
  commentInputRef: RefObject<HTMLTextAreaElement | null>;
  commentsByFileId: Record<string, FileComment[]>;
  connectionStatus: ConnectionStatus;
  files: WorkspaceFile[];
  focusTextRange: FocusTextRange;
  identityName: string;
  isLive: boolean;
  onImportFile: () => void;
  openFileIds: string[];
  outlineHeadings: MarkdownHeading[];
  parsedMarkdownBody: string;
  previewSurfaceRef: RefObject<HTMLElement | null>;
  replyDraftByCommentId: Record<string, string>;
  rightPanelOpen: boolean;
  rightPanelView: RightPanelView;
  selectedCharacterCount: number;
  selectedText: string;
  setRightPanelOpen: (isOpen: boolean) => void;
  setRightPanelView: (view: RightPanelView) => void;
  text: string;
};

export function useWorkspaceProjectContextRuntime({
  activeCommentId,
  activeFile,
  activeFileTitle,
  activeReplyCommentId,
  activeViewMode,
  commentDraft,
  commentInputRef,
  commentsByFileId,
  connectionStatus,
  files,
  focusTextRange,
  formatCommentDate,
  identityName,
  isLive,
  onAddComment,
  onAddCommentReply,
  onCancelCommentReply,
  onCloseFile,
  onCommentDraftChange,
  onDeleteComment,
  onDeleteFile,
  onDuplicateFile,
  onGoToComment,
  onIdentityNameChange,
  onIdentityNameCommit,
  onImportFile,
  onNewFile,
  onRenameFile,
  onReplyDraftChange,
  onSelectFile,
  onStartCommentReply,
  onToggleCommentResolved,
  openFileIds,
  outlineHeadings,
  parsedMarkdownBody,
  previewSurfaceRef,
  replyDraftByCommentId,
  rightPanelOpen,
  rightPanelView,
  selectedCharacterCount,
  selectedText,
  setRightPanelOpen,
  setRightPanelView,
  text,
}: UseWorkspaceProjectContextRuntimeOptions) {
  const [fileQuery, setFileQuery] = useState("");

  useEffect(() => {
    if (!isLive && rightPanelView === "comments") {
      setRightPanelView("files");
    }
  }, [isLive, rightPanelView, setRightPanelView]);

  const getFileStatus = useCallback(
    (file: WorkspaceFile) =>
      getWorkspaceFileStatus({
        file,
        activeFileId: activeFile?.id,
        activeConnectionStatus: connectionStatus,
      }),
    [activeFile?.id, connectionStatus],
  );

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

  const projectContextProps: WorkspaceProjectContextProps = {
    isOpen: rightPanelOpen,
    view: rightPanelView,
    isLive,
    files,
    openFileIds,
    activeFileId: activeFile?.id,
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
    onSetView: setRightPanelView,
    onClose: () => setRightPanelOpen(false),
    onFileQueryChange: setFileQuery,
    onNewFile,
    onImportFile,
    onSelectFile,
    onCloseFile,
    onRenameFile,
    onDuplicateFile,
    onDeleteFile,
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
    getFileStatus,
    projectContextProps,
  };
}
