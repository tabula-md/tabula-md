import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { COMMENT_ANCHOR_CONTEXT_LENGTH, getCommentRangeInText } from "./commentAnchors";
import { type Collaborator, type ConnectionStatus, type LiveSelection } from "./collab";
import { AppToast } from "./components/AppToast";
import { EmptyFileState } from "./components/EmptyFileState";
import { FileTabs } from "./components/FileTabs";
import { FileToolbar } from "./components/FileToolbar";
import { LeftSidebar } from "./components/LeftSidebar";
import { LiveRoomNotice } from "./components/LiveRoomNotice";
import { MarkdownEditor, type MarkdownCommentAnchor, type MarkdownEditorHandle } from "./components/MarkdownEditor";
import { MarkdownFormattingToolbar } from "./components/MarkdownFormattingToolbar";
import { MarkdownPreview, type MarkdownPreviewCommentAnchor } from "./components/MarkdownPreview";
import { RightPanel } from "./components/RightPanel";
import { ShareControls } from "./components/ShareControls";
import { StatusBar } from "./components/StatusBar";
import { TopChrome } from "./components/TopChrome";
import {
  createPublishedSnapshot,
  createServerPublishedSnapshot,
  deletePublishedSnapshot,
  getConfiguredPublishServiceUrl,
  getEmptyPublishFiles,
  getEmptyPublishFilesMessage,
  getPublishRoute,
  readLatestPublishedSnapshot,
  readPublishedSnapshot,
  readServerPublishedSnapshot,
  republishServerPublishedSnapshot,
  savePublishedSnapshot,
  unpublishServerPublishedSnapshot,
  type PublishedSnapshot,
  type PublishRoute,
  type PublishScope,
} from "./publish";
import {
  getLineStartOffset,
  getOutlineHeadings,
  getPreviewBody,
  getSearchMatches,
  parseFrontmatter,
  type MarkdownHeading,
  type SearchMatch,
} from "./markdown";
import type { MarkdownFormatCommand } from "./markdownFormatting";
import { getShortcutLabels, type ShortcutLabels } from "./keyboardShortcuts";
import { PRODUCT_NAME, WORKSPACE_EXPORT_FILE_PREFIX } from "./product";
import { useCollaborationRoom } from "./hooks/useCollaborationRoom";
import { useFileComments } from "./hooks/useFileComments";
import { useMarkdownFiles, normalizeMarkdownFileTitle } from "./hooks/useMarkdownFiles";
import { useWorkspaceScrollSync } from "./hooks/useWorkspaceScrollSync";
import {
  createMarkdownFile,
  createStoredWorkspace,
  ensureLiveFileForRoom,
  getFileIdForRoom,
  getRoomFromLocation,
  initialWorkspaceState,
  migrateWorkspacePayload,
  randomId,
  README_FILE_ID,
  READING_WIDTHS,
  syncUrlForFile,
  type FileComment,
  type FileViewMode,
  type LocationRoom,
  type MarkdownFile,
  type WorkspaceState,
  PROJECT_STORAGE_VERSION,
  writeStoredWorkspace,
} from "./workspaceStorage";
import type { CenterPopover, LeftPanelView, LibraryItem, RightPanelView, TopPopover } from "./uiTypes";

const IDENTITY_KEY = "tabula.identity";
const LIBRARIES_HREF = "#libraries";

const COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c", "#047857"];

const isMarkdownImportFile = (file: File) => {
  const fileName = file.name.toLowerCase();
  return (
    fileName.endsWith(".md") ||
    fileName.endsWith(".markdown") ||
    file.type === "text/markdown" ||
    file.type === "text/plain"
  );
};

type FileHistory = {
  past: string[];
  future: string[];
};

type AppToastState = {
  id: number;
  message: string;
  tone: "error" | "neutral";
  actionLabel?: string;
  onAction?: () => void;
};

type PreviewSelectionState = {
  from: number;
  to: number;
  text: string;
};

type PreviewSelectionEvent =
  | ReactKeyboardEvent<HTMLElement>
  | ReactMouseEvent<HTMLElement>
  | ReactTouchEvent<HTMLElement>;

type ActiveLiveRoomNotice = {
  title: string;
  message: string;
  canKeepLocal: boolean;
};

const getLiveRoomNotice = (file: MarkdownFile | undefined, status: ConnectionStatus): ActiveLiveRoomNotice | null => {
  if (
    !file?.roomId ||
    status !== "offline" ||
    file.lastRecoveryType !== "invalid-message" ||
    !file.lastRecoveryMessage
  ) {
    return null;
  }

  const sourceMessage = file.lastRecoveryMessage;
  const normalizedMessage = sourceMessage.toLowerCase();

  if (normalizedMessage.includes("missing its client-only room key")) {
    return {
      title: "Room key missing",
      message:
        "This shared URL is missing the client-only key, so Tabula cannot decrypt the room. Ask for the full link or keep this file as a local copy.",
      canKeepLocal: true,
    };
  }

  if (normalizedMessage.includes("invalid room key")) {
    return {
      title: "Room key invalid",
      message:
        "The key in this shared URL is not valid. Ask for a fresh room link or keep this file as a local copy.",
      canKeepLocal: true,
    };
  }

  if (normalizedMessage.includes("could not be decrypted")) {
    return {
      title: "Room key does not match",
      message:
        "The key in this URL cannot decrypt the latest room snapshot. The encrypted room was not changed.",
      canKeepLocal: true,
    };
  }

  if (normalizedMessage.includes("server disconnected") || normalizedMessage.includes("not reachable")) {
    return null;
  }

  return {
    title: "Live room needs attention",
    message: sourceMessage,
    canKeepLocal: true,
  };
};

const getTextOffsetWithinElement = (element: HTMLElement, container: Node, offset: number) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEnd(container, offset);
  const textOffset = range.toString().length;
  range.detach();
  return Math.max(0, Math.min(textOffset, element.textContent?.length ?? 0));
};

const readPreviewSelection = (surface: HTMLElement | null, previewBodyStartOffset: number): PreviewSelectionState | null => {
  if (!surface) {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) {
    return null;
  }

  if (!surface.contains(selection.anchorNode) || !surface.contains(selection.focusNode)) {
    return null;
  }

  const selectedText = selection.toString().replace(/\s+/g, " ").trim();
  if (!selectedText) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const segments = Array.from(surface.querySelectorAll<HTMLElement>(".preview-source-text"))
    .map((element) => {
      if (!range.intersectsNode(element)) {
        return null;
      }

      const sourceStart = Number(element.dataset.sourceStart);
      const sourceEnd = Number(element.dataset.sourceEnd);
      if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd) || sourceEnd <= sourceStart) {
        return null;
      }

      const textLength = element.textContent?.length ?? 0;
      let localStart = 0;
      let localEnd = textLength;

      if (element.contains(range.startContainer)) {
        localStart = getTextOffsetWithinElement(element, range.startContainer, range.startOffset);
      }
      if (element.contains(range.endContainer)) {
        localEnd = getTextOffsetWithinElement(element, range.endContainer, range.endOffset);
      }

      if (localEnd <= localStart) {
        return null;
      }

      return {
        from: previewBodyStartOffset + sourceStart + localStart,
        to: previewBodyStartOffset + sourceStart + localEnd,
      };
    })
    .filter((segment): segment is { from: number; to: number } => Boolean(segment));

  if (segments.length === 0) {
    return null;
  }

  return {
    from: Math.min(...segments.map((segment) => segment.from)),
    to: Math.max(...segments.map((segment) => segment.to)),
    text: selectedText,
  };
};

const TEMPLATE_ITEMS = [
  {
    title: "PRD.md",
    description: "Problem, scope, users, success criteria.",
    content: `---
title: Product Requirements
description: Problem, scope, users, and success criteria for the project.
---

# Product Requirements

## Problem


## Goals

- 

## Non-goals

- 

## User flow

1. 

## Success criteria

- 
`,
  },
  {
    title: "DESIGN.md",
    description: "Interface principles and key states.",
    content: `---
title: Design Brief
description: Interface principles, layout, states, and interaction notes.
---

# Design Brief

## Principles

- 

## Layout


## Key states

- Empty
- Loading
- Error
- Complete

## Interaction notes

- 
`,
  },
  {
    title: "SKILL.md",
    description: "Reusable agent skill contract.",
    content: `---
title: Skill
description: Reusable workflow that an AI agent can invoke.
---

# Skill

## When to use


## Inputs

- 

## Workflow

1. 

## Output

- 
`,
  },
] satisfies LibraryItem[];

const getAppShortcut = ({ primary, alternate }: ShortcutLabels, key: string) => `${primary} + ${alternate} + ${key}`;

const getPublishedFilePageUrl = (pageUrl: string, fileId: string) => {
  const url = new URL(pageUrl, window.location.origin);
  url.searchParams.set("file", fileId);
  return url.toString();
};

const getPublishedSnapshotScope = (snapshot: PublishedSnapshot | null | undefined): PublishScope | undefined => {
  if (!snapshot) {
    return undefined;
  }

  return snapshot.scope ?? (snapshot.fileCount > 1 ? "project" : "file");
};

const getKeyboardShortcuts = (shortcutLabels: ShortcutLabels) => [
  { keys: getAppShortcut(shortcutLabels, "N"), action: "New Markdown" },
  { keys: getAppShortcut(shortcutLabels, "O"), action: "Open .md file" },
  { keys: getAppShortcut(shortcutLabels, "F"), action: "Browse project files" },
  { keys: "?", action: "Open Help.md" },
  { keys: `${shortcutLabels.primary} + B`, action: "Bold" },
  { keys: `${shortcutLabels.primary} + I`, action: "Italic" },
  { keys: `${shortcutLabels.primary} + K`, action: "Link" },
  { keys: `${shortcutLabels.primary} + Shift + 7`, action: "Numbered list" },
  { keys: `${shortcutLabels.primary} + Shift + 8`, action: "Bullet list" },
  { keys: `${shortcutLabels.primary} + Shift + 9`, action: "Quote" },
  { keys: getAppShortcut(shortcutLabels, "1"), action: "Edit mode" },
  { keys: getAppShortcut(shortcutLabels, "2"), action: "Split mode" },
  { keys: getAppShortcut(shortcutLabels, "3"), action: "Preview mode" },
  { keys: getAppShortcut(shortcutLabels, "Left"), action: "Previous file tab" },
  { keys: getAppShortcut(shortcutLabels, "Right"), action: "Next file tab" },
  { keys: "Enter in search", action: "Next search match" },
  { keys: "Shift + Enter in search", action: "Previous search match" },
  { keys: "Double-click tab", action: "Rename file" },
  { keys: "Enter", action: "Commit rename" },
  { keys: "Escape", action: "Cancel rename or close menu" },
];

const createHelpMarkdown = (shortcutLabels: ShortcutLabels) => `---
title: Help
description: Quick reference for using Tabula.md.
---

# Help

## Start

- Create a Markdown file with **New Markdown**.
- Open an existing \`.md\` or \`.markdown\` file with **Open .md file**.
- Use **Browse project files** to reopen files after closing every tab.

## Work

- Edit Markdown in Edit mode.
- Use Split mode to edit and preview together.
- Use Preview mode to read and comment on the rendered document.

## Share

- Share a live room when people need to edit together.
- Publish a project snapshot when you need a read-only handoff for people or agents.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| ${getAppShortcut(shortcutLabels, "N")} | New Markdown |
| ${getAppShortcut(shortcutLabels, "O")} | Open .md file |
| ${getAppShortcut(shortcutLabels, "F")} | Browse project files |
| ? | Open Help.md |
| ${getAppShortcut(shortcutLabels, "1")} | Edit mode |
| ${getAppShortcut(shortcutLabels, "2")} | Split mode |
| ${getAppShortcut(shortcutLabels, "3")} | Preview mode |
`;

const normalizeIdentity = (identity: Collaborator): Collaborator => {
  const name = identity.name?.trim();
  const nextName = name && !/^Guest\s+\d+$/i.test(name) ? name : `Anonymous ${identity.id.slice(0, 3)}`;
  return {
    ...identity,
    name: nextName.slice(0, 40),
    lastSeen: Date.now(),
  };
};

const createIdentity = (): Collaborator => {
  const stored = window.localStorage.getItem(IDENTITY_KEY);
  if (stored) {
    const identity = normalizeIdentity(JSON.parse(stored) as Collaborator);
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    return identity;
  }

  const identity = normalizeIdentity({
    id: randomId(),
    name: `Anonymous ${Math.floor(Math.random() * 900 + 100)}`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    lastSeen: Date.now(),
  });
  window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
};

function PublishedSnapshotView({
  route,
  snapshot,
  status = snapshot ? "ready" : "missing",
  errorMessage,
}: {
  route: PublishRoute;
  snapshot: PublishedSnapshot | null;
  status?: "loading" | "ready" | "missing" | "error";
  errorMessage?: string;
}) {
  const activeFile =
    snapshot?.files.find((file) => file.id === route.fileId) ??
    snapshot?.files.find((file) => file.id === snapshot.activeFileId) ??
    snapshot?.files[0];
  const parsedMarkdown = parseFrontmatter(activeFile?.text ?? "");
  const metadataTitle = parsedMarkdown.attributes.find((attribute) => attribute.key.toLowerCase() === "title")?.value;
  const pageTitle = metadataTitle || activeFile?.title || "Published page";

  useEffect(() => {
    document.title = snapshot
      ? `${pageTitle} - ${PRODUCT_NAME}`
      : status === "loading"
        ? "Loading published page"
        : "Published page not found";
  }, [pageTitle, snapshot, status]);

  if (!snapshot) {
    const headline =
      status === "loading"
        ? "Loading published page."
        : status === "error"
          ? "Unable to load published page."
          : "Published page not found.";
    return (
      <main className="published-page published-missing">
        <section className="published-shell">
          <p>{PRODUCT_NAME}</p>
          <h1>{headline}</h1>
          {errorMessage && <p>{errorMessage}</p>}
          <a href="/">Return to project</a>
        </section>
      </main>
    );
  }

  const textOutput = route.output === "llms.txt" ? snapshot.llmsTxt : route.output === "llms-full.txt" ? snapshot.llmsFullTxt : "";

  if (route.output !== "page") {
    return (
      <main className="published-text-page">
        <pre>{textOutput}</pre>
      </main>
    );
  }

  const renderedPreview = getPreviewBody(parsedMarkdown.body, metadataTitle);

  return (
    <main className="published-page">
      <section className="published-shell">
        <header className="published-header">
          <div>
            <p>{PRODUCT_NAME}</p>
            <h1>{pageTitle}</h1>
          </div>
          <nav aria-label="Published outputs">
            <a href={snapshot.urls.llmsTxt}>llms.txt</a>
            <a href={snapshot.urls.llmsFullTxt}>llms-full.txt</a>
          </nav>
        </header>

        <aside className="published-file-list" aria-label="Published files">
          <span>{snapshot.fileCount === 1 ? "1 file" : `${snapshot.fileCount} files`}</span>
          {snapshot.files.map((file) => (
            <a
              aria-current={file.id === activeFile?.id ? "page" : undefined}
              className={file.id === activeFile?.id ? "active" : ""}
              href={getPublishedFilePageUrl(snapshot.urls.page, file.id)}
              key={file.id}
            >
              {file.title}
            </a>
          ))}
        </aside>

        <article className="published-document">
          <MarkdownPreview
            metadata={parsedMarkdown.attributes}
            body={renderedPreview.body}
          />
        </article>
      </section>
    </main>
  );
}

function PublishedSnapshotRoute({ route }: { route: PublishRoute }) {
  const [snapshot, setSnapshot] = useState<PublishedSnapshot | null>(() => readPublishedSnapshot(route.snapshotId));
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(() =>
    snapshot ? "ready" : "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const localSnapshot = readPublishedSnapshot(route.snapshotId);
    setSnapshot(localSnapshot);
    setErrorMessage(undefined);

    if (localSnapshot) {
      setStatus("ready");
      return;
    }

    const publishServiceUrl = getConfiguredPublishServiceUrl();
    if (!publishServiceUrl) {
      setStatus("missing");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    void readServerPublishedSnapshot({
      serviceUrl: publishServiceUrl,
      origin: window.location.origin,
      snapshotId: route.snapshotId,
    })
      .then((serverSnapshot) => {
        if (cancelled) {
          return;
        }
        setSnapshot(serverSnapshot);
        setStatus(serverSnapshot ? "ready" : "missing");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Publish failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [route.snapshotId]);

  return <PublishedSnapshotView route={route} snapshot={snapshot} status={status} errorMessage={errorMessage} />;
}

function WorkspaceApp() {
  const [initialWorkspace] = useState<WorkspaceState>(() => initialWorkspaceState());
  const {
    files,
    openFiles,
    openFileIds,
    setOpenFileIds,
    setFiles,
    activeFileId,
    setActiveFileId,
    activeFile,
    selectFile: selectMarkdownFile,
    addFile: addMarkdownFile,
    addFileFromContent,
    addTemplateFile: addMarkdownTemplateFile,
    duplicateFile: duplicateMarkdownFile,
    renameFile,
    closeFile: closeMarkdownFile,
    deleteFile: deleteMarkdownFile,
    reorderFiles,
    selectAdjacentFile: selectAdjacentMarkdownFile,
    setActiveFileViewMode: setMarkdownFileViewMode,
    setActiveFileReadingWidth,
    setActiveFileLineWrapping,
    setActiveFileLineNumbers,
  } = useMarkdownFiles({
    initialFiles: initialWorkspace.files,
    initialOpenFileIds: initialWorkspace.openFileIds,
    initialActiveFileId: initialWorkspace.activeFileId,
    readmeFileId: README_FILE_ID,
    createFile: createMarkdownFile,
  });
  const [topPopover, setTopPopover] = useState<TopPopover>(null);
  const [centerPopover, setCenterPopover] = useState<CenterPopover>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [leftPanelView, setLeftPanelView] = useState<LeftPanelView>("menu");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(-1);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>("files");
  const [rightFileQuery, setRightFileQuery] = useState("");
  const [emptyDropActive, setEmptyDropActive] = useState(false);
  const [historyByFileId, setHistoryByFileId] = useState<Record<string, FileHistory>>({});
  const [editorHistoryState, setEditorHistoryState] = useState({ canUndo: false, canRedo: false });
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const [activeSelection, setActiveSelection] = useState<LiveSelection | undefined>(undefined);
  const [previewSelection, setPreviewSelection] = useState<PreviewSelectionState | null>(null);
  const [publishedSnapshot, setPublishedSnapshot] = useState<PublishedSnapshot | null>(() => readLatestPublishedSnapshot());
  const [publishScope, setPublishScope] = useState<PublishScope>("file");
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [toast, setToast] = useState<AppToastState | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [shortcutLabels] = useState(() => getShortcutLabels());
  const keyboardShortcuts = useMemo(() => getKeyboardShortcuts(shortcutLabels), [shortcutLabels]);

  const [identity, setIdentity] = useState<Collaborator>(() => createIdentity());
  const {
    commentsByFileId,
    commentDraft,
    activeReplyCommentId,
    replyDraftByCommentId,
    focusedCommentId,
    activeFileComments,
    activeOpenComments,
    setCommentDraft,
    setFocusedCommentId,
    replaceCommentsByFileId,
    addFileComment: createFileComment,
    deleteFileComment,
    toggleFileCommentResolved,
    startCommentReply: beginCommentReply,
    cancelCommentReply,
    updateCommentReplyDraft,
    addFileCommentReply,
  } = useFileComments({
    initialCommentsByFileId: initialWorkspace.commentsByFileId,
    activeFileId: activeFile?.id ?? "",
    files,
    identity,
    createId: randomId,
  });
  const {
    collaborators,
    connectionStatus,
    startSession: startCollaborationSession,
    applyLocalText,
    resetCollaborationState,
  } = useCollaborationRoom({
    activeFile: activeFile,
    activeSelection,
    identity,
    setFiles,
  });
  const text = activeFile?.text ?? "";
  const activeViewMode = activeFile?.viewMode ?? "edit";
  const activeReadingWidth = activeFile?.readingWidth ?? "standard";
  const activeLineWrapping = activeFile?.lineWrapping ?? true;
  const activeLineNumbers = activeFile?.lineNumbers ?? true;
  const {
    workspaceRef,
    editorSurfaceRef,
    previewSurfaceRef,
    setActiveFileViewMode,
    queueEditorFocus,
    handleEditorScrollRatioChange,
    handleEditorSurfaceScroll,
    handlePreviewScroll,
  } = useWorkspaceScrollSync({
    activeFileId: activeFile?.id,
    activeViewMode,
    editorRef,
    onSetActiveFileViewMode: setMarkdownFileViewMode,
  });
  const isLive = Boolean(activeFile?.roomId);
  const activeHistory = activeFile ? (historyByFileId[activeFile.id] ?? { past: [], future: [] }) : { past: [], future: [] };
  const canUndo = activeHistory.past.length > 0;
  const canRedo = activeHistory.future.length > 0;
  const copied = copiedFileId === activeFile?.id;
  const activeWordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const selectedMarkdownText =
    activeViewMode === "preview"
      ? (previewSelection?.text ?? "")
      : activeSelection && activeSelection.from !== activeSelection.to
        ? text.slice(Math.min(activeSelection.from, activeSelection.to), Math.max(activeSelection.from, activeSelection.to)).trim()
        : "";
  const selectedWordCount = selectedMarkdownText ? selectedMarkdownText.split(/\s+/).length : 0;
  const parsedMarkdown = parseFrontmatter(text);
  const metadataTitle = parsedMarkdown.attributes.find((attribute) => attribute.key.toLowerCase() === "title")?.value;
  const renderedPreview = getPreviewBody(parsedMarkdown.body, metadataTitle);
  const shareOpen = topPopover === "share";
  const publishedScope = getPublishedSnapshotScope(publishedSnapshot);
  const publishedFileTitle =
    publishedSnapshot?.files.find((file) => file.id === publishedSnapshot.activeFileId)?.title ??
    publishedSnapshot?.files[0]?.title;
  const outlineHeadings = useMemo<MarkdownHeading[]>(
    () => getOutlineHeadings(renderedPreview),
    [renderedPreview],
  );
  const searchMatches = useMemo<SearchMatch[]>(() => getSearchMatches(text, searchQuery), [searchQuery, text]);
  const showToast = (
    message: string,
    tone: AppToastState["tone"] = "neutral",
    action?: Pick<AppToastState, "actionLabel" | "onAction">,
  ) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast({ id: Date.now(), message, tone, ...action });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2800);
  };

  const activateRoomFromLocation = (room: LocationRoom) => {
    const targetFileId = getFileIdForRoom(files, room.roomId);
    setFiles((currentFiles) => ensureLiveFileForRoom(currentFiles, room));
    setActiveFileId(targetFileId);
    setTopPopover(null);
    setCenterPopover(null);
    setCopiedFileId(null);
  };

  useEffect(() => {
    if (!activeFile && rightPanelView !== "files") {
      setRightPanelView("files");
    }
  }, [activeFile, rightPanelView]);

  useEffect(() => {
    const currentPublishedScope = getPublishedSnapshotScope(publishedSnapshot);
    if (currentPublishedScope) {
      setPublishScope(currentPublishedScope);
    }
  }, [publishedSnapshot?.id, publishedSnapshot?.scope, publishedSnapshot?.fileCount]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const room = getRoomFromLocation();
      if (room) {
        activateRoomFromLocation(room);
        return;
      }

      const currentFile = files.find((file) => file.id === activeFileId);
      if (!currentFile?.roomId) {
        return;
      }

      const localFile = files.find((file) => !file.roomId) ?? files[0];
      if (localFile) {
        setActiveFileId(localFile.id);
        setTopPopover(null);
        setCenterPopover(null);
        setCopiedFileId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeFileId, files]);

  useEffect(() => {
    if (!activeFile) {
      return;
    }

    syncUrlForFile(activeFile, "replace");
  }, [activeFile?.id, activeFile?.roomId, activeFile?.shareUrl]);

  useEffect(() => {
    writeStoredWorkspace({
      files,
      openFileIds,
      activeFileId,
      commentsByFileId,
    });
  }, [activeFileId, commentsByFileId, files, openFileIds]);

  useEffect(() => {
    setActiveSearchMatchIndex(-1);
  }, [searchQuery, activeFile?.id]);

  useEffect(() => {
    if (centerPopover !== "search") {
      return;
    }

    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [centerPopover]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (topPopover || centerPopover) {
        event.preventDefault();
        setTopPopover(null);
        setCenterPopover(null);
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const isInsideLeftPanel = Boolean(target?.closest(".left-sidebar"));
      const isInsideRightPanel = Boolean(target?.closest(".right-panel"));

      if (leftPanelOpen && (isInsideLeftPanel || !isInsideRightPanel)) {
        event.preventDefault();
        if (leftPanelView === "settings" || leftPanelView === "shortcuts") {
          setLeftPanelView("menu");
          return;
        }

        setLeftPanelOpen(false);
        return;
      }

      if (rightPanelOpen) {
        event.preventDefault();
        setRightPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [centerPopover, leftPanelOpen, leftPanelView, rightPanelOpen, topPopover]);

  const startSession = async () => {
    const startedSession = startCollaborationSession();
    if (!startedSession) {
      return;
    }

    setCopiedFileId(null);
    setCenterPopover(null);
  };

  const stopSession = () => {
    if (!activeFile?.roomId) {
      return;
    }

    const stoppedFileId = activeFile.id;
    resetCollaborationState("idle");
    setCopiedFileId(null);
    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.id === stoppedFileId
          ? {
              ...file,
              roomId: undefined,
              shareUrl: undefined,
              connectionStatus: "idle",
              collaboratorCount: 0,
              snapshotCount: 0,
              lastSnapshotAt: undefined,
              lastRecoveryType: undefined,
              lastRecoveryMessage: undefined,
              lastRecoveryAt: undefined,
            }
          : file,
      ),
    );
  };

  const copyShareUrl = async () => {
    const url = activeFile?.shareUrl || window.location.href;
    await navigator.clipboard.writeText(url);
    activeFile && setCopiedFileId(activeFile.id);
    window.setTimeout(() => setCopiedFileId(null), 1600);
  };

  const getPublishFiles = () => (publishScope === "file" && activeFile ? [activeFile] : files);

  const getPublishCommentsByFileId = (publishFiles: MarkdownFile[]) => {
    const publishFileIds = new Set(publishFiles.map((file) => file.id));
    return Object.fromEntries(
      Object.entries(commentsByFileId).filter(([fileId, comments]) => publishFileIds.has(fileId) && comments.length > 0),
    );
  };

  const getPublishActiveFileId = (publishFiles = getPublishFiles()) => {
    const requestedActiveFileId = activeFile?.id ?? activeFileId;
    return publishFiles.some((file) => file.id === requestedActiveFileId)
      ? requestedActiveFileId
      : (publishFiles[0]?.id ?? requestedActiveFileId);
  };

  const publishProjectSnapshot = async () => {
    if (publishing) {
      return;
    }

    const publishServiceUrl = getConfiguredPublishServiceUrl();
    const isUpdatingPublishedPage = Boolean(
      publishedSnapshot && (publishServiceUrl ? publishedSnapshot.ownerToken : true),
    );
    const publishFiles = getPublishFiles();
    const emptyPublishFiles = getEmptyPublishFiles(publishFiles);
    if (emptyPublishFiles.length > 0) {
      showToast(getEmptyPublishFilesMessage(publishFiles, publishScope), "error");
      return;
    }

    const publishActiveFileId = getPublishActiveFileId(publishFiles);
    const publishCommentsByFileId = getPublishCommentsByFileId(publishFiles);
    setPublishing(true);
    try {
      const snapshot = publishServiceUrl
        ? isUpdatingPublishedPage && publishedSnapshot?.ownerToken
          ? await republishServerPublishedSnapshot({
              serviceUrl: publishServiceUrl,
              origin: window.location.origin,
              scope: publishScope,
              ownerName: identity.name,
              snapshot: publishedSnapshot,
              files: publishFiles,
              activeFileId: publishActiveFileId,
              commentsByFileId: publishCommentsByFileId,
            })
          : await createServerPublishedSnapshot({
              serviceUrl: publishServiceUrl,
              origin: window.location.origin,
              scope: publishScope,
              ownerName: identity.name,
              files: publishFiles,
              activeFileId: publishActiveFileId,
              commentsByFileId: publishCommentsByFileId,
            })
        : {
            ...createPublishedSnapshot({
              id: publishedSnapshot?.id ?? randomId(),
              origin: window.location.origin,
              scope: publishScope,
              ownerName: identity.name,
              files: publishFiles,
              activeFileId: publishActiveFileId,
              commentsByFileId: publishCommentsByFileId,
            }),
            ...(publishedSnapshot ? { createdAt: publishedSnapshot.createdAt, updatedAt: new Date().toISOString() } : {}),
          };
      savePublishedSnapshot(snapshot);
      setPublishedSnapshot(snapshot);
      showToast(isUpdatingPublishedPage ? "Published page updated." : "Page published.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  const unpublishProjectSnapshot = async () => {
    if (unpublishing || !publishedSnapshot) {
      return;
    }

    const publishServiceUrl = getConfiguredPublishServiceUrl();
    if (publishServiceUrl && !publishedSnapshot.ownerToken) {
      return;
    }

    const confirmed = window.confirm(
      "Unpublish this page?\n\nThis removes the public page and included AI-readable outputs. The local project stays unchanged.",
    );
    if (!confirmed) {
      return;
    }

    setUnpublishing(true);
    try {
      if (publishServiceUrl) {
        await unpublishServerPublishedSnapshot({
          serviceUrl: publishServiceUrl,
          snapshot: publishedSnapshot,
        });
      }
      deletePublishedSnapshot(publishedSnapshot.id);
      setPublishedSnapshot(null);
      showToast("Page unpublished.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setUnpublishing(false);
    }
  };

  const copyPublishedUrl = async (url: string, label: string) => {
    await navigator.clipboard.writeText(url);
    showToast(`${label} copied.`);
  };

  const updateIdentityName = (nextName: string) => {
    setIdentity((currentIdentity) => {
      const updatedIdentity = {
        ...currentIdentity,
        name: nextName.slice(0, 40),
        lastSeen: Date.now(),
      };
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(updatedIdentity));
      return updatedIdentity;
    });
  };

  const normalizeIdentityName = () => {
    setIdentity((currentIdentity) => {
      const updatedIdentity = normalizeIdentity(currentIdentity);
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(updatedIdentity));
      return updatedIdentity;
    });
  };

  const copyCurrentMarkdown = async () => {
    if (!activeFile) {
      return;
    }

    await navigator.clipboard.writeText(activeFile.text);
    showToast("Markdown copied.");
  };

  const downloadTextFile = (fileName: string, content: string, type = "text/plain;charset=utf-8") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportCurrentFile = () => {
    if (!activeFile) {
      return;
    }

    downloadTextFile(activeFile.title, activeFile.text, "text/markdown;charset=utf-8");
  };

  const downloadCurrentMarkdownFile = () => {
    if (!activeFile) {
      return;
    }

    downloadTextFile(activeFile.title, activeFile.text, "text/markdown;charset=utf-8");
    showToast("Markdown downloaded.");
  };

  const downloadWorkspace = () => {
    const workspaceExport = createStoredWorkspace({
      files,
      openFileIds,
      activeFileId: activeFile?.id ?? activeFileId,
      commentsByFileId,
    });
    downloadTextFile(
      `${WORKSPACE_EXPORT_FILE_PREFIX}-v${PROJECT_STORAGE_VERSION}.json`,
      JSON.stringify(workspaceExport, null, 2),
      "application/json",
    );
    showToast("Project downloaded.");
  };

  const importWorkspaceFile = async (file: File) => {
    let parsedWorkspace: unknown;

    try {
      parsedWorkspace = JSON.parse(await file.text());
    } catch {
      showToast("This file is not readable JSON.", "error");
      return;
    }

    const nextWorkspace = migrateWorkspacePayload(parsedWorkspace, { includeLocationRoom: false });
    if (!nextWorkspace) {
      showToast(`This JSON does not match the ${PRODUCT_NAME} project v${PROJECT_STORAGE_VERSION} files schema.`, "error");
      return;
    }

    const nextActiveFile = nextWorkspace.activeFileId
      ? nextWorkspace.files.find((file) => file.id === nextWorkspace.activeFileId)
      : undefined;

    setFiles(nextWorkspace.files);
    setOpenFileIds(nextWorkspace.openFileIds);
    setActiveFileId(nextActiveFile?.id ?? "");
    replaceCommentsByFileId(nextWorkspace.commentsByFileId);
    setHistoryByFileId({});
    resetCollaborationState(nextActiveFile?.roomId ? "connecting" : "idle");
    setTopPopover(null);
    setCenterPopover(null);
    setCopiedFileId(null);
    syncUrlForFile(nextActiveFile);
    showToast("Project imported.");
  };

  const importMarkdownFile = async (file: File) => {
    const importedText = await file.text();
    const nextFile = addFileFromContent(normalizeMarkdownFileTitle(file.name || "Imported.md"), importedText);
    closeFloatingChrome();
    syncUrlForFile(nextFile);

    window.setTimeout(() => editorRef.current?.focus(), 0);
  };

  const handleImportInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    void importMarkdownFile(file);
  };

  const handleWorkspaceImportInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    void importWorkspaceFile(file);
  };

  const getDroppedMarkdownFile = (event: DragEvent<HTMLElement>) => {
    return Array.from(event.dataTransfer.files).find(isMarkdownImportFile);
  };

  const handleEmptyWorkspaceDragOver = (event: DragEvent<HTMLElement>) => {
    if (!getDroppedMarkdownFile(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setEmptyDropActive(true);
  };

  const handleEmptyWorkspaceDragLeave = (event: DragEvent<HTMLElement>) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return;
    }

    setEmptyDropActive(false);
  };

  const handleEmptyWorkspaceDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setEmptyDropActive(false);

    const markdownFile = getDroppedMarkdownFile(event);
    if (!markdownFile) {
      showToast("Drop a Markdown file.", "error");
      return;
    }

    void importMarkdownFile(markdownFile);
  };

  const updateActiveFileText = (nextText: string, options: { recordHistory?: boolean } = {}) => {
    if (!activeFile) {
      return;
    }

    const shouldRecordHistory = options.recordHistory ?? true;
    if (shouldRecordHistory && nextText !== activeFile.text) {
      setHistoryByFileId((currentHistory) => {
        const fileHistory = currentHistory[activeFile.id] ?? { past: [], future: [] };
        return {
          ...currentHistory,
          [activeFile.id]: {
            past: [...fileHistory.past.slice(-79), activeFile.text],
            future: [],
          },
        };
      });
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) => (file.id === activeFile.id ? { ...file, text: nextText } : file)),
    );

    if (activeFile.roomId) {
      applyLocalText(nextText);
    }
  };

  const handleTextChange = (nextText: string) => {
    updateActiveFileText(nextText);
  };

  const handleEditorSelectionChange = (selection: LiveSelection) => {
    setPreviewSelection(null);
    setActiveSelection(selection);
  };

  const undoActiveFile = () => {
    if (editorRef.current?.undo()) {
      return;
    }

    if (!activeFile || !canUndo) {
      return;
    }

    const previousText = activeHistory.past[activeHistory.past.length - 1];
    setHistoryByFileId((currentHistory) => {
      const fileHistory = currentHistory[activeFile.id] ?? { past: [], future: [] };
      return {
        ...currentHistory,
        [activeFile.id]: {
          past: fileHistory.past.slice(0, -1),
          future: [activeFile.text, ...fileHistory.future].slice(0, 80),
        },
      };
    });
    updateActiveFileText(previousText, { recordHistory: false });
  };

  const redoActiveFile = () => {
    if (editorRef.current?.redo()) {
      return;
    }

    if (!activeFile || !canRedo) {
      return;
    }

    const nextText = activeHistory.future[0];
    setHistoryByFileId((currentHistory) => {
      const fileHistory = currentHistory[activeFile.id] ?? { past: [], future: [] };
      return {
        ...currentHistory,
        [activeFile.id]: {
          past: [...fileHistory.past.slice(-79), activeFile.text],
          future: fileHistory.future.slice(1),
        },
      };
    });
    updateActiveFileText(nextText, { recordHistory: false });
  };

  const getSelectedMarkdownExcerpt = () => {
    const selectedText = activeViewMode === "preview" ? (previewSelection?.text ?? "") : (editorRef.current?.getSelectedText() ?? "");
    if (!selectedText) {
      return "";
    }

    return selectedText
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 180);
  };

  const getSelectedMarkdownRange = () => {
    if (activeViewMode === "preview") {
      if (!previewSelection || previewSelection.from === previewSelection.to) {
        return null;
      }

      return {
        start: Math.min(previewSelection.from, previewSelection.to),
        end: Math.max(previewSelection.from, previewSelection.to),
      };
    }

    if (!activeSelection || activeSelection.from === activeSelection.to) {
      return null;
    }

    return {
      start: Math.min(activeSelection.from, activeSelection.to),
      end: Math.max(activeSelection.from, activeSelection.to),
    };
  };

  const getSelectedMarkdownAnchor = () => {
    const selectionRange = getSelectedMarkdownRange();
    if (!selectionRange) {
      return null;
    }

    return {
      ...selectionRange,
      sourceQuote: text.slice(selectionRange.start, selectionRange.end),
      prefix: text.slice(Math.max(0, selectionRange.start - COMMENT_ANCHOR_CONTEXT_LENGTH), selectionRange.start),
      suffix: text.slice(selectionRange.end, selectionRange.end + COMMENT_ANCHOR_CONTEXT_LENGTH),
    };
  };

  const addFileComment = () => {
    if (!activeFile) {
      return;
    }

    const selectionAnchor = getSelectedMarkdownAnchor();
    createFileComment({
      fileId: activeFile.id,
      body: commentDraft,
      quote: getSelectedMarkdownExcerpt() || undefined,
      anchor: selectionAnchor,
    });
  };

  const startCommentReply = (_fileId: string, commentId: string) => {
    openCommentsPanel(commentId);
    beginCommentReply(commentId);
  };

  const getCommentRange = (comment: FileComment): { start: number; end: number } | null =>
    getCommentRangeInText(text, comment);

  const scrollCommentIntoView = (commentId: string) => {
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`.right-comment-card[data-comment-id="${commentId}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }, 0);
  };

  const openCommentsPanel = (commentId?: string) => {
    setRightPanelOpen(true);
    setRightPanelView("comments");
    setTopPopover(null);
    setCenterPopover(null);

    if (commentId) {
      setFocusedCommentId(commentId);
      scrollCommentIntoView(commentId);
    }
  };

  const setFileViewMode = (fileId: string, nextViewMode: FileViewMode) => {
    setFiles((currentFiles) =>
      currentFiles.map((file) => (file.id === fileId ? { ...file, viewMode: nextViewMode } : file)),
    );
  };

  const goToFileComment = (fileId: string, comment: FileComment) => {
    const targetFile = files.find((file) => file.id === fileId);
    if (!targetFile) {
      return;
    }

    openCommentsPanel(comment.id);
    if (targetFile.id !== activeFile?.id) {
      selectFile(targetFile.id);
    }

    const commentRange = getCommentRangeInText(targetFile.text, comment);
    if (!commentRange) {
      showToast("Original text not found.", "neutral");
      return;
    }

    if (targetFile.viewMode === "preview") {
      window.setTimeout(() => {
        previewSurfaceRef.current
          ?.querySelector<HTMLElement>(`.preview-comment-mark[data-comment-id="${comment.id}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 0);
      return;
    }

    window.setTimeout(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(commentRange.start, commentRange.end);
    }, 0);
  };

  const openCommentMarker = (commentId: string) => {
    const comment = activeFileComments.find((fileComment) => fileComment.id === commentId);
    if (!comment) {
      openCommentsPanel(commentId);
      return;
    }

    if (activeFile) {
      goToFileComment(activeFile.id, comment);
    }
  };

  const formatCommentDate = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (elapsedSeconds < 45) {
      return "just now";
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) {
      return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
      return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 7) {
      return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const adjustActiveFileReadingWidth = (direction: -1 | 1) => {
    const currentIndex = READING_WIDTHS.indexOf(activeReadingWidth);
    const nextReadingWidth = READING_WIDTHS[Math.min(READING_WIDTHS.length - 1, Math.max(0, currentIndex + direction))];
    setActiveFileReadingWidth(nextReadingWidth);
  };

  const openSelectionComment = () => {
    if (!selectedWordCount) {
      return;
    }

    openCommentsPanel();
    window.setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const focusTextRange = (start: number, end = start) => {
    if (activeViewMode === "preview") {
      setActiveFileViewMode("edit", { preserveScroll: false, focusEditor: false });
    }

    window.setTimeout(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(start, end);
    }, 0);
  };

  const goToSearchMatch = (direction: 1 | -1) => {
    if (searchMatches.length === 0) {
      return;
    }

    const currentIndex = activeSearchMatchIndex === -1 ? (direction === 1 ? -1 : 0) : activeSearchMatchIndex;
    const nextIndex =
      direction === 1
        ? (currentIndex + 1) % searchMatches.length
        : (currentIndex - 1 + searchMatches.length) % searchMatches.length;
    const match = searchMatches[nextIndex];
    setActiveSearchMatchIndex(nextIndex);
    focusTextRange(match.start, match.end);
  };

  const goToOutlineHeading = (heading: MarkdownHeading, headingIndex: number) => {
    if (activeViewMode === "preview") {
      const renderedHeadings = Array.from(previewSurfaceRef.current?.querySelectorAll("h1, h2, h3") ?? []).filter(
        (heading) => !heading.closest(".frontmatter-view"),
      );
      const renderedHeading = renderedHeadings[headingIndex];
      renderedHeading?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }

    const bodyStartOffset = text.indexOf(parsedMarkdown.body);
    const targetOffset =
      (bodyStartOffset === -1 ? 0 : bodyStartOffset) +
      getLineStartOffset(parsedMarkdown.body, heading.sourceLineIndex);
    focusTextRange(targetOffset, targetOffset + heading.text.length + heading.depth + 1);
  };

  const closeFloatingChrome = () => {
    setTopPopover(null);
    setCenterPopover(null);
    setCopiedFileId(null);
  };

  const selectFile = (fileId: string) => {
    const nextFile = selectMarkdownFile(fileId);
    if (!nextFile) {
      return;
    }

    closeFloatingChrome();
    syncUrlForFile(nextFile);
  };

  const addFile = () => {
    queueEditorFocus();
    const nextFile = addMarkdownFile();
    closeFloatingChrome();
    syncUrlForFile(nextFile);
  };

  const openHelpFile = () => {
    const helpMarkdown = createHelpMarkdown(shortcutLabels);
    const existingHelpFile = files.find((file) => file.title.trim().toLowerCase() === "help.md");

    if (existingHelpFile) {
      setFiles((currentFiles) =>
        currentFiles.map((file) =>
          file.id === existingHelpFile.id ? { ...file, text: helpMarkdown, viewMode: "preview" } : file,
        ),
      );
      selectFile(existingHelpFile.id);
      return;
    }

    const nextFile = addFileFromContent("Help.md", helpMarkdown, "preview");
    closeFloatingChrome();
    syncUrlForFile(nextFile);
  };

  const addTemplateFile = (template: LibraryItem) => {
    queueEditorFocus();
    const nextFile = addMarkdownTemplateFile(template);
    closeFloatingChrome();
    syncUrlForFile(nextFile);
  };

  const renameMarkdownFile = (fileId: string, nextRawTitle: string) => {
    const result = renameFile(fileId, nextRawTitle);
    if (!result.ok) {
      showToast(result.message, "error");
    }
    return result;
  };

  const duplicateFile = (fileId: string) => {
    queueEditorFocus();
    const nextFile = duplicateMarkdownFile(fileId);
    if (!nextFile) {
      return;
    }

    closeFloatingChrome();
    syncUrlForFile(nextFile);
    showToast("File duplicated.");
  };

  const deleteFile = (fileId: string) => {
    const deletedFile = files.find((file) => file.id === fileId);
    if (!deletedFile) {
      return;
    }

    const deletedFileIndex = Math.max(
      0,
      files.findIndex((file) => file.id === fileId),
    );
    const previousOpenFileIds = openFileIds;
    const previousActiveFileId = activeFile?.id ?? activeFileId;
    const deletedComments = commentsByFileId[fileId];
    const deletedHistory = historyByFileId[fileId];
    const result = deleteMarkdownFile(fileId);
    if (!result) {
      return;
    }

    setHistoryByFileId((currentHistory) => {
      if (!currentHistory[fileId]) {
        return currentHistory;
      }

      const { [fileId]: _deletedHistory, ...nextHistory } = currentHistory;
      return nextHistory;
    });
    if (commentsByFileId[fileId]) {
      const { [fileId]: _deletedComments, ...nextCommentsByFileId } = commentsByFileId;
      replaceCommentsByFileId(nextCommentsByFileId);
    }

    if (result.closedActiveFile) {
      closeFloatingChrome();
      setCopiedFileId(null);

      if (result.nextActiveFile) {
        syncUrlForFile(result.nextActiveFile);
      } else {
        resetCollaborationState("idle");
        syncUrlForFile(undefined, "replace");
      }
    }

    showToast("File deleted.", "neutral", {
      actionLabel: "Undo",
      onAction: () => {
        setFiles((currentFiles) => {
          if (currentFiles.some((file) => file.id === deletedFile.id)) {
            return currentFiles;
          }

          const nextFiles = [...currentFiles];
          nextFiles.splice(Math.min(deletedFileIndex, nextFiles.length), 0, deletedFile);
          return nextFiles;
        });
        setOpenFileIds((currentOpenFileIds) => {
          if (!previousOpenFileIds.includes(deletedFile.id) || currentOpenFileIds.includes(deletedFile.id)) {
            return currentOpenFileIds;
          }

          const previousOpenIndex = previousOpenFileIds.indexOf(deletedFile.id);
          const nextOpenFileIds = [...currentOpenFileIds];
          nextOpenFileIds.splice(Math.min(previousOpenIndex, nextOpenFileIds.length), 0, deletedFile.id);
          return nextOpenFileIds;
        });
        if (previousActiveFileId === deletedFile.id) {
          setActiveFileId(deletedFile.id);
          syncUrlForFile(deletedFile);
        }
        if (deletedComments?.length) {
          replaceCommentsByFileId({
            ...commentsByFileId,
            [deletedFile.id]: deletedComments,
          });
        }
        if (deletedHistory) {
          setHistoryByFileId((currentHistory) => ({
            ...currentHistory,
            [deletedFile.id]: deletedHistory,
          }));
        }
        showToast("File restored.");
      },
    });
  };

  const closeFile = (fileId: string) => {
    const result = closeMarkdownFile(fileId);
    if (!result) {
      return;
    }

    if (result.closedActiveFile) {
      closeFloatingChrome();
      setCopiedFileId(null);

      if (result.nextActiveFile) {
        syncUrlForFile(result.nextActiveFile);
        return;
      }

      resetCollaborationState("idle");
      syncUrlForFile(undefined, "replace");
    }
  };

  const selectAdjacentFile = (direction: -1 | 1) => {
    const nextFile = selectAdjacentMarkdownFile(direction);
    if (nextFile) {
      closeFloatingChrome();
      syncUrlForFile(nextFile);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isRenameInput = target instanceof HTMLElement && target.classList.contains("tab-rename-input");
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if (isRenameInput) {
        return;
      }

      const hasCommandModifier = event.metaKey || event.ctrlKey;
      const hasAppModifier = hasCommandModifier && event.altKey && !event.shiftKey;
      const key = event.key.toLowerCase();
      const code = event.code;
      const isKey = (nextKey: string) => key === nextKey.toLowerCase() || code === `Key${nextKey.toUpperCase()}`;
      const isDigit = (digit: string) => event.key === digit || code === `Digit${digit}`;
      const consumeShortcut = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (hasAppModifier && isKey("n")) {
        consumeShortcut();
        addFile();
        return;
      }

      if (hasAppModifier && isKey("o")) {
        consumeShortcut();
        closeFloatingChrome();
        importInputRef.current?.click();
        return;
      }

      if (hasAppModifier && isKey("f")) {
        consumeShortcut();
        setRightPanelOpen(true);
        setRightPanelView("files");
        closeFloatingChrome();
        return;
      }

      if (!isEditableTarget && !hasCommandModifier && !event.altKey && event.key === "?") {
        consumeShortcut();
        openHelpFile();
        return;
      }

      if (!hasAppModifier) {
        return;
      }

      if (event.key === "ArrowLeft") {
        consumeShortcut();
        selectAdjacentFile(-1);
      }

      if (event.key === "ArrowRight") {
        consumeShortcut();
        selectAdjacentFile(1);
      }

      if (isDigit("1")) {
        consumeShortcut();
        setActiveFileViewMode("edit");
        setCenterPopover(null);
      }

      if (isDigit("2")) {
        consumeShortcut();
        setActiveFileViewMode("split");
        setCenterPopover(null);
      }

      if (isDigit("3")) {
        consumeShortcut();
        setActiveFileViewMode("preview");
        setCenterPopover(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  });

  const getStatusLabel = (status: ConnectionStatus) =>
    ({
      idle: "Local draft",
      connecting: "Connecting",
      connected: "Live session",
      offline: "Room offline",
    })[status];

  const getFileStatus = (file: MarkdownFile) => {
    if (file.id === activeFile?.id) {
      return connectionStatus;
    }

    return file.connectionStatus ?? (file.roomId ? "offline" : "idle");
  };

  const activeStatus = isLive ? connectionStatus : "idle";
  const activeLiveRoomNotice = getLiveRoomNotice(activeFile, activeStatus);
  const statusLabel = getStatusLabel(activeStatus);
  const activeFileTitle = activeFile?.title ?? "No file open";
  const showFormattingToolbar = Boolean(activeFile && activeViewMode !== "preview");
  const getFileSearchText = (file: MarkdownFile) => {
    const metadata = parseFrontmatter(file.text);
    const title = metadata.attributes.find((attribute) => attribute.key.toLowerCase() === "title")?.value ?? "";
    return `${file.title} ${title}`;
  };
  const activeCommentAnchors: MarkdownCommentAnchor[] = activeOpenComments
    .map((comment) => {
      const commentRange = getCommentRange(comment);
      return commentRange ? { id: comment.id, start: commentRange.start, end: commentRange.end } : null;
    })
    .filter((anchor): anchor is MarkdownCommentAnchor => Boolean(anchor));
  const parsedBodyStartOffset = text.indexOf(parsedMarkdown.body);
  const previewBodyStartOffset =
    (parsedBodyStartOffset === -1 ? 0 : parsedBodyStartOffset) +
    getLineStartOffset(parsedMarkdown.body, renderedPreview.sourceLineOffset);
  const activePreviewCommentAnchors: MarkdownPreviewCommentAnchor[] = activeCommentAnchors
    .map((anchor) => ({
      id: anchor.id,
      start: anchor.start - previewBodyStartOffset,
      end: anchor.end - previewBodyStartOffset,
    }))
    .filter((anchor) => anchor.end > 0 && anchor.start < renderedPreview.body.length)
    .map((anchor) => ({
      ...anchor,
      start: Math.max(0, anchor.start),
      end: Math.min(renderedPreview.body.length, anchor.end),
    }))
    .filter((anchor) => anchor.end > anchor.start);

  useEffect(() => {
    if (activeViewMode !== "preview") {
      setPreviewSelection(null);
    }
  }, [activeFile?.id, activeViewMode]);

  const shouldIgnorePreviewSelectionEvent = (event?: PreviewSelectionEvent) => {
    const target = event?.target;
    return (
      target instanceof Element &&
      Boolean(target.closest("button, a, .preview-code-block, .preview-comment-mark"))
    );
  };

  const syncPreviewSelection = (event?: PreviewSelectionEvent) => {
    if (activeViewMode !== "preview") {
      return;
    }

    if (shouldIgnorePreviewSelectionEvent(event)) {
      return;
    }

    window.setTimeout(() => {
      const nextPreviewSelection = readPreviewSelection(previewSurfaceRef.current, previewBodyStartOffset);
      setPreviewSelection(nextPreviewSelection);
      setActiveSelection(nextPreviewSelection ? { from: nextPreviewSelection.from, to: nextPreviewSelection.to } : undefined);
    }, 0);
  };

  const fileTabsNode = (
    <FileTabs
      files={openFiles}
      activeFile={activeFile}
      activeCollaboratorCount={collaborators.length}
      getFileStatus={getFileStatus}
      onAddFile={addFile}
      onSelectFile={selectFile}
      onRenameFile={renameMarkdownFile}
      onCloseFile={closeFile}
      onReorderFiles={reorderFiles}
      onChromeInteraction={() => {
        setTopPopover(null);
        setCenterPopover(null);
      }}
    />
  );

  const publishServiceConfigured = Boolean(getConfiguredPublishServiceUrl());
  const canManagePublishedPage = Boolean(
    publishedSnapshot && (!publishServiceConfigured || publishedSnapshot.ownerToken),
  );
  const publishPreviewFiles = publishScope === "file" && activeFile ? [activeFile] : files;
  const publishBlockerMessage = getEmptyPublishFilesMessage(publishPreviewFiles, publishScope);
  const shareControlsNode = activeFile ? (
    <ShareControls
      activeFile={activeFile}
      activeFileTitle={activeFileTitle}
      currentUserName={identity.name}
      activeStatus={activeStatus}
      isLive={isLive}
      shareOpen={shareOpen}
      copied={copied}
      onToggleShare={() => {
        setTopPopover(shareOpen ? null : "share");
        setCenterPopover(null);
      }}
      onCloseShare={() => setTopPopover(null)}
      onStartSession={startSession}
      onCopyShareUrl={copyShareUrl}
      onCopyMarkdown={copyCurrentMarkdown}
      onDownloadMarkdown={downloadCurrentMarkdownFile}
      publishScope={publishScope}
      publishFileCount={files.length}
      publishedScope={publishedScope}
      publishedFileTitle={publishedFileTitle}
      publishedFileCount={publishedSnapshot?.fileCount}
      publishedAt={publishedSnapshot?.updatedAt ?? publishedSnapshot?.createdAt}
      publishPageUrl={publishedSnapshot?.urls.page}
      publishBlockerMessage={publishBlockerMessage}
      canRepublishSnapshot={canManagePublishedPage}
      publishing={publishing}
      unpublishing={unpublishing}
      onChangePublishScope={setPublishScope}
      onPublishSnapshot={publishProjectSnapshot}
      onUnpublishSnapshot={unpublishProjectSnapshot}
      onCopyPublishPageUrl={() =>
        publishedSnapshot && copyPublishedUrl(publishedSnapshot.urls.page, "Published page link")
      }
      onChangeUserName={updateIdentityName}
      onCommitUserName={normalizeIdentityName}
      onStopSession={stopSession}
    />
  ) : null;

  const formatMarkdown = (command: MarkdownFormatCommand) => {
    if (activeViewMode === "preview") {
      return;
    }

    setTopPopover(null);
    setCenterPopover(null);
    editorRef.current?.format(command);
  };

  return (
    <main className="app-shell">
      {toast && (
        <AppToast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      )}
      <input
        ref={importInputRef}
        className="workspace-file-input"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={handleImportInputChange}
        aria-label="Import Markdown file"
      />
      <input
        ref={workspaceImportInputRef}
        className="workspace-file-input"
        type="file"
        accept=".json,application/json"
        onChange={handleWorkspaceImportInputChange}
        aria-label="Import project file"
      />
      <section
        className={`main-panel ${leftPanelOpen ? "left-panel-open" : ""} ${
          rightPanelOpen ? "right-panel-open" : ""
        }`}
      >
        {leftPanelOpen && (
          <LeftSidebar
            isOpen={leftPanelOpen}
            view={leftPanelView}
            hasActiveFile={Boolean(activeFile)}
            importInputRef={importInputRef}
            workspaceImportInputRef={workspaceImportInputRef}
            keyboardShortcuts={keyboardShortcuts}
            storageVersion={PROJECT_STORAGE_VERSION}
            templates={TEMPLATE_ITEMS}
            librariesHref={LIBRARIES_HREF}
            onSetView={setLeftPanelView}
            onClose={() => {
              setLeftPanelOpen(false);
              setTopPopover(null);
              setCenterPopover(null);
            }}
            onExportCurrentFile={exportCurrentFile}
            onDownloadWorkspace={downloadWorkspace}
            onAddTemplate={addTemplateFile}
          />
        )}

        <section className="center-workbench">
          <TopChrome
            leftPanelOpen={leftPanelOpen}
            rightPanelOpen={rightPanelOpen}
            isLive={isLive}
            identity={identity}
            collaborators={collaborators}
            fileTabs={fileTabsNode}
            shareControls={shareControlsNode}
            onToggleLeftPanel={() => {
              setLeftPanelOpen((isOpen) => !isOpen);
              setTopPopover(null);
              setCenterPopover(null);
            }}
            onToggleRightPanel={() => {
              setRightPanelOpen((isOpen) => !isOpen);
              setTopPopover(null);
              setCenterPopover(null);
            }}
          />

          <section
            className={`file-shell ${
              activeFile ? `view-${activeViewMode} reading-${activeReadingWidth}` : "empty"
            } ${showFormattingToolbar ? "with-format-toolbar" : ""} ${
              activeLiveRoomNotice ? "with-live-room-notice" : ""
            }`}
          >
            {activeFile ? (
              <>
                <section
                  className={`editor-control-row ${activeViewMode} reading-${activeReadingWidth} ${
                    showFormattingToolbar ? "with-formatting" : ""
                  }`}
                  aria-label="Editor controls"
                >
                  {showFormattingToolbar && (
                    <MarkdownFormattingToolbar
                      className={`${activeViewMode} reading-${activeReadingWidth}`}
                      onFormat={formatMarkdown}
                    />
                  )}

                  <FileToolbar
                    activeFileTitle={activeFileTitle}
                    activeViewMode={activeViewMode}
                    activeReadingWidth={activeReadingWidth}
                    activeLineWrapping={activeLineWrapping}
                    activeLineNumbers={activeLineNumbers}
                    centerPopover={centerPopover}
                    searchInputRef={searchInputRef}
                    searchQuery={searchQuery}
                    searchMatches={searchMatches}
                    activeSearchMatchIndex={activeSearchMatchIndex}
                    onSetViewMode={(nextViewMode) => {
                      setActiveFileViewMode(nextViewMode);
                      setCenterPopover(null);
                    }}
                    onToggleSearch={() => {
                      setCenterPopover((current) => (current === "search" ? null : "search"));
                      setTopPopover(null);
                    }}
                    onToggleViewOptions={() => {
                      setCenterPopover((current) => (current === "view" ? null : "view"));
                      setTopPopover(null);
                    }}
                    onNarrower={() => adjustActiveFileReadingWidth(-1)}
                    onWider={() => adjustActiveFileReadingWidth(1)}
                    onToggleLineWrapping={() => setActiveFileLineWrapping(!activeLineWrapping)}
                    onToggleLineNumbers={() => setActiveFileLineNumbers(!activeLineNumbers)}
                    onSearchQueryChange={setSearchQuery}
                    onGoToSearchMatch={goToSearchMatch}
                    onSelectSearchMatch={(match, index) => {
                      setActiveSearchMatchIndex(index);
                      focusTextRange(match.start, match.end);
                    }}
                  />
                </section>

                {activeLiveRoomNotice && (
                  <LiveRoomNotice
                    title={activeLiveRoomNotice.title}
                    message={activeLiveRoomNotice.message}
                    canKeepLocal={activeLiveRoomNotice.canKeepLocal}
                    onCopyMarkdown={copyCurrentMarkdown}
                    onKeepLocal={stopSession}
                    onOpenShare={() => {
                      setTopPopover("share");
                      setCenterPopover(null);
                    }}
                  />
                )}

                <section className={`workspace ${activeViewMode} reading-${activeReadingWidth}`} ref={workspaceRef}>
                  <article className="editor-surface" ref={editorSurfaceRef} onScroll={handleEditorSurfaceScroll}>
                    <MarkdownEditor
                      ref={editorRef}
                      fileId={activeFile.id}
                      value={text}
                      lineWrapping={activeLineWrapping}
                      lineNumbers={activeLineNumbers}
                      commentAnchors={activeCommentAnchors}
                      activeCommentId={focusedCommentId}
                      onChange={handleTextChange}
                      onHistoryStateChange={setEditorHistoryState}
                      onOpenComment={openCommentMarker}
                      onSelectionChange={handleEditorSelectionChange}
                      onScrollRatioChange={handleEditorScrollRatioChange}
                    />
                  </article>

                  <article
                    className="preview-surface"
                    ref={previewSurfaceRef}
                    onKeyUp={syncPreviewSelection}
                    onMouseUp={syncPreviewSelection}
                    onScroll={handlePreviewScroll}
                    onTouchEnd={syncPreviewSelection}
                  >
                    <MarkdownPreview
                      metadata={parsedMarkdown.attributes}
                      body={renderedPreview.body}
                      commentAnchors={activePreviewCommentAnchors}
                      activeCommentId={focusedCommentId}
                      onOpenComment={openCommentMarker}
                    />
                  </article>
                </section>

                <StatusBar
                  activeFileTitle={activeFileTitle}
                  canUndo={canUndo || editorHistoryState.canUndo}
                  canRedo={canRedo || editorHistoryState.canRedo}
                  isLive={isLive}
                  statusLabel={statusLabel}
                  wordCount={activeWordCount}
                  commentCount={activeOpenComments.length}
                  selectedWordCount={selectedWordCount}
                  onUndo={undoActiveFile}
                  onRedo={redoActiveFile}
                  onOpenComments={() => openCommentsPanel(focusedCommentId ?? activeOpenComments[0]?.id)}
                  onAddSelectionComment={openSelectionComment}
                />
              </>
            ) : (
              <section
                className={`workspace empty-workspace ${emptyDropActive ? "drop-active" : ""}`}
                ref={workspaceRef}
                onDragOver={handleEmptyWorkspaceDragOver}
                onDragLeave={handleEmptyWorkspaceDragLeave}
                onDrop={handleEmptyWorkspaceDrop}
              >
                <EmptyFileState
                  onNewFile={addFile}
                  onOpenMarkdown={() => importInputRef.current?.click()}
                  onBrowseFiles={() => {
                    setRightPanelOpen(true);
                    setRightPanelView("files");
                    closeFloatingChrome();
                  }}
                  onOpenHelp={openHelpFile}
                  primaryShortcutModifier={shortcutLabels.primary}
                  alternateShortcutModifier={shortcutLabels.alternate}
                />
              </section>
            )}
          </section>
        </section>

        {rightPanelOpen && (
          <RightPanel
            isOpen={rightPanelOpen}
            view={rightPanelView}
            files={files}
            openFileIds={openFileIds}
            activeFileId={activeFile?.id ?? ""}
            activeFileTitle={activeFileTitle}
            fileQuery={rightFileQuery}
            outlineHeadings={outlineHeadings}
            commentsByFileId={commentsByFileId}
            commentDraft={commentDraft}
            identityName={identity.name}
            selectedText={selectedMarkdownText}
            selectedWordCount={selectedWordCount}
            commentInputRef={commentInputRef}
            activeCommentId={focusedCommentId}
            activeReplyCommentId={activeReplyCommentId}
            replyDraftByCommentId={replyDraftByCommentId}
            getFileStatus={getFileStatus}
            getFileSearchText={getFileSearchText}
            onSetView={setRightPanelView}
            onClose={() => setRightPanelOpen(false)}
            onFileQueryChange={setRightFileQuery}
            onNewFile={addFile}
            onImportMarkdown={() => importInputRef.current?.click()}
            onSelectFile={selectFile}
            onCloseFile={closeFile}
            onRenameFile={renameMarkdownFile}
            onDuplicateFile={duplicateFile}
            onDeleteFile={deleteFile}
            onGoToOutlineHeading={goToOutlineHeading}
            onCommentDraftChange={setCommentDraft}
            onIdentityNameChange={updateIdentityName}
            onIdentityNameCommit={normalizeIdentityName}
            onAddComment={addFileComment}
            onGoToComment={goToFileComment}
            onStartCommentReply={startCommentReply}
            onCancelCommentReply={cancelCommentReply}
            onReplyDraftChange={updateCommentReplyDraft}
            onAddCommentReply={addFileCommentReply}
            onToggleCommentResolved={toggleFileCommentResolved}
            onDeleteComment={deleteFileComment}
            formatCommentDate={formatCommentDate}
          />
        )}
      </section>
    </main>
  );
}

function App() {
  const publishRoute = getPublishRoute(window.location.pathname, window.location.search);
  if (publishRoute) {
    return <PublishedSnapshotRoute route={publishRoute} />;
  }

  return <WorkspaceApp />;
}

export default App;
