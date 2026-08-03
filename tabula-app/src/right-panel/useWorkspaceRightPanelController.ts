import {
  createElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Braces,
  Download,
  FileInput,
  FilePlus2,
  PanelLeft,
  Search,
} from "lucide-react";
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
import type { RightPanelView } from "../ui/uiTypes";
import type { LiveSelection } from "../collaboration/liveCollaboration";
import type {
  FileComment,
  FileViewMode,
  WorkspaceFile,
  WorkspaceFolder,
} from "../workspace/workspaceStorage";
import { getWorkspaceName } from "../workspace/workspaceStorage";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type { WorkspaceSearchMode } from "../workspace/state/workspaceUiStore";
import { getWorkspaceKnowledgeDocuments } from "../workspace/workspaceKnowledgeModel";
import { useWorkspaceKnowledgeIndex } from "../workspace/useWorkspaceKnowledgeIndex";
import { getWorkspaceChromeCopy, getWorkspaceMenuCopy } from "../workspace/workspaceLocale";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { formatShortcut } from "../workspace/keyboardShortcuts";
import type { MetadataFocusSection } from "./RightPanelPropertiesContext";

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
  workspaceSearchOpen: boolean;
  workspaceSearchMode: WorkspaceSearchMode;
  openFileIds: string[];
  workspaceMenuOpen: boolean;
  onImportFile: () => void;
  onToggleWorkspaceMenu: () => void;
  onToggleWorkspaceSearch: () => void;
  onExportFile: () => void;
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
  setWorkspaceSearchOpen: (isOpen: boolean) => void;
  setWorkspaceSearchMode: (mode: WorkspaceSearchMode) => void;
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
  workspaceSearchOpen,
  workspaceSearchMode,
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
  onToggleWorkspaceMenu,
  onToggleWorkspaceSearch,
  onExportFile,
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
  setWorkspaceSearchOpen,
  setWorkspaceSearchMode,
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
    mode: workspaceSearchMode,
    language,
    activeFileId: visibleActiveFileId,
    openFileIds,
    pending: knowledgeIndexPending,
    onClose: () => setWorkspaceSearchOpen(false),
    onSelectFile,
    commands: [
      {
        id: "search-workspace",
        label: `${getWorkspaceInterfaceCopy(language).sidePanel.search.label}…`,
        keywords: ["find", "content", "metadata", "files"],
        shortcut: formatShortcut("Mod+Shift+F"),
        icon: createElement(Search, { size: 16 }),
        closeOnSelect: false,
        onSelect: () => setWorkspaceSearchMode("search"),
      },
      {
        id: "new-document",
        label: getWorkspaceInterfaceCopy(language).sidePanel.files.newDocument,
        keywords: ["create", "file", "document"],
        icon: createElement(FilePlus2, { size: 16 }),
        onSelect: () => onNewFile(),
      },
      {
        id: "import-document",
        label: getWorkspaceMenuCopy(language).actions.importFile,
        keywords: ["open", "markdown", "file"],
        icon: createElement(FileInput, { size: 16 }),
        onSelect: onImportFile,
      },
      {
        id: "export-document",
        label: getWorkspaceMenuCopy(language).actions.exportFile,
        keywords: ["download", "markdown", "file"],
        icon: createElement(Download, { size: 16 }),
        enabled: Boolean(activeFile),
        onSelect: onExportFile,
      },
      {
        id: "toggle-workspace-panel",
        label: getWorkspaceChromeCopy(language).topChrome.workspacePanel,
        keywords: ["files", "sidebar", "left"],
        icon: createElement(PanelLeft, { size: 16 }),
        onSelect: () => setLeftPanelOpen(!leftPanelOpen),
      },
      {
        id: "open-document-properties",
        label: getKnowledgePanelCopy(language).reviewInKnowledge,
        keywords: ["metadata", "frontmatter", "status", "trust", "right"],
        icon: createElement(Braces, { size: 16 }),
        enabled: Boolean(activeFile),
        onSelect: () => {
          setRightPanelView("properties");
          setRightPanelOpen(true);
        },
      },
    ],
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
