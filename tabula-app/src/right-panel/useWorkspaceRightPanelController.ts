import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { WorkspaceRightPanelProps } from "./WorkspaceRightPanel";
import type { WorkspaceLeftPanelProps } from "../left-panel/WorkspaceLeftPanel";
import type { WorkspaceSearchModalProps } from "../workspace/components/WorkspaceSearchModal";
import type {
  MarkdownHeading,
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
import { getWorkspaceName } from "../workspace/workspaceStorage";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceKnowledgeDocuments } from "../workspace/workspaceKnowledgeModel";
import { useWorkspaceKnowledgeIndex } from "../workspace/useWorkspaceKnowledgeIndex";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import type { MetadataFocusSection } from "./RightPanelPropertiesContext";
import { buildWorkspaceCommandRegistry } from "../workspace/workspaceCommandRegistry";

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
  focusTextRange: FocusTextRange;
  identityName: string;
  isLive: boolean;
  language: WorkspaceLanguage;
  leftPanelOpen: boolean;
  leftPanelView: LeftPanelView;
  workspaceSearchOpen: boolean;
  openFileIds: string[];
  workspaceMenuOpen: boolean;
  onImportFile: () => void;
  onImportWorkspace: () => void;
  onOpenPreferences: () => void;
  onToggleWorkspaceMenu: () => void;
  onToggleWorkspaceSearch: () => void;
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
  setWorkspaceSearchOpen: (isOpen: boolean) => void;
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
  leftPanelOpen,
  leftPanelView,
  workspaceSearchOpen,
  openFileIds,
  workspaceMenuOpen,
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
  onImportWorkspace,
  onOpenPreferences,
  onToggleWorkspaceMenu,
  onToggleWorkspaceSearch,
  onNewFile,
  onNewFolder,
  onRenameFile,
  onRenameFolder,
  onMoveFileToFolder,
  onMoveFolder,
  onReplyDraftChange,
  onResolveAmbiguousLink,
  onSelectFile,
  onSelectKnowledgeHealthIssue,
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
  setWorkspaceSearchOpen,
  text,
}: UseWorkspaceRightPanelControllerOptions) {
  const visibleFiles = files;
  const visibleActiveFileId = activeFile?.id;
  const knowledgeDocuments = useMemo(
    () => getWorkspaceKnowledgeDocuments(visibleFiles, folders),
    [folders, visibleFiles],
  );
  const {
    index: knowledgeIndex,
    pending: knowledgeIndexPending,
    source: knowledgeIndexSource,
  } = useWorkspaceKnowledgeIndex(knowledgeDocuments);
  const outlineCursorRef = useRef({ fileId: visibleActiveFileId, offset: 0 });
  const [metadataFocus, setMetadataFocus] = useState<{
    fileId: string;
    section: MetadataFocusSection;
  }>();
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
  const selectFromLeftPanel = useCallback((fileId: string) => {
    onSelectFile(fileId);
    if (typeof window !== "undefined" && window.innerWidth <= 1160) {
      setLeftPanelOpen(false);
    }
  }, [onSelectFile, setLeftPanelOpen]);
  const openDocumentProperties = useCallback((
    fileId: string,
    section: MetadataFocusSection,
  ) => {
    onSelectFile(fileId);
    setMetadataFocus({ fileId, section });
    setRightPanelView("properties");
    setRightPanelOpen(true);
    if (typeof window !== "undefined" && window.innerWidth <= 1160) {
      setLeftPanelOpen(false);
    }
  }, [onSelectFile, setLeftPanelOpen, setRightPanelOpen, setRightPanelView]);

  const leftPanelProps: WorkspaceLeftPanelProps = {
    isOpen: leftPanelOpen,
    isLive,
    language,
    workspaceMenuOpen,
    workspaceName: getWorkspaceName(folders),
    workspaceSearchOpen,
    activeView: leftPanelView,
    onSetView: setLeftPanelView,
    files: visibleFiles,
    folders,
    knowledgeIndex,
    knowledgeIndexSource,
    activeFileId: visibleActiveFileId,
    onClose: closeLeftPanel,
    onToggleWorkspaceMenu,
    onToggleWorkspaceSearch,
    onNewFile,
    onNewFolder,
    onImportFile,
    onSelectFile: selectFromLeftPanel,
    onOpenProperties: openDocumentProperties,
    onRenameFile,
    onDuplicateFile,
    onDeleteFile,
    onDeleteFolder,
    onCopyFile,
    onMoveFileToFolder,
    onMoveFolder,
    onRenameFolder,
  };

  const searchModalProps: WorkspaceSearchModalProps = {
    files: visibleFiles,
    folders,
    index: knowledgeIndex,
    isOpen: workspaceSearchOpen,
    language,
    activeFileId: visibleActiveFileId,
    openFileIds,
    onClose: () => setWorkspaceSearchOpen(false),
    onSelectFile,
    commands: buildWorkspaceCommandRegistry({
      language,
      actions: {
        newFile: () => { onNewFile(); },
        newFolder: () => { onNewFolder(); },
        importFile: onImportFile,
        importWorkspace: onImportWorkspace,
        openPreferences: onOpenPreferences,
      },
    }),
  };

  const rightPanelProps: WorkspaceRightPanelProps = {
    isOpen: rightPanelOpen,
    view: rightPanelView,
    language,
    files: visibleFiles,
    folders,
    knowledgeIndex,
    knowledgeIndexPending,
    knowledgeIndexSource,
    activeFileId: visibleActiveFileId,
    activeFileTitle,
    metadataFocusSection: metadataFocus?.fileId === visibleActiveFileId
      ? metadataFocus?.section
      : undefined,
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
    onSelectFile,
    onSelectKnowledgeHealthIssue,
    onFocusLinkSource: focusLinkSource,
    onResolveAmbiguousLink,
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
    searchModalProps,
  };
}
