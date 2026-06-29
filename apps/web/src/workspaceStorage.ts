import { parseRoomLocation, parseRoomShareUrl, type CollabRecoveryEvent, type ConnectionStatus } from "./collab";
import { PRODUCT_NAME } from "./product";

export const PROJECT_STORAGE_VERSION = 5;
export const WORKSPACE_STORAGE_VERSION = PROJECT_STORAGE_VERSION;
export const PROJECT_STORAGE_KEY = "tabula.project.v5";
const STARTER_MARKDOWN = "";
export const README_FILE_ID = "tabula-readme";

export type WorkspaceStorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export const browserWorkspaceStorageAdapter: WorkspaceStorageAdapter = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const DEFAULT_README_REFRESH_MARKERS = [
  "It is intentionally Markdown-file-first",
  "## Frontmatter",
  "Markdown bundle",
];
export const STARTER_README_MARKDOWN = `---
title: ${PRODUCT_NAME}
description: A local-first Markdown workspace for files that people and coding agents can share safely.
---

${PRODUCT_NAME} is a local-first Markdown workspace for files that people and coding agents can share safely.

No dashboard first. No project ceremony. Open a file, write Markdown, and share only when the file is ready to leave your browser.

## Start here

1. Create a blank Markdown file.
2. Edit, preview, or keep split view open.
3. Share a live room for co-editing or an encrypted copy link for handoff.

## Fits

- Product specs, design notes, decisions, runbooks, research, and implementation plans.
- Markdown files that teammates and coding agents should both understand.

## Storage and sharing

- Local files are saved in this browser.
- Live rooms sync the active file through a collaboration session.
- Shareable links export an encrypted copy that opens in another local workspace.
`;
export const isStarterReadmeText = (text: string) => text === STARTER_README_MARKDOWN;
export const READING_WIDTHS: ReadingWidth[] = ["narrow", "standard", "wide"];
export const DEFAULT_SPLIT_EDITOR_RATIO = 0.5;
export const MIN_SPLIT_EDITOR_RATIO = 0.28;
export const MAX_SPLIT_EDITOR_RATIO = 0.72;
const FILE_VIEW_MODES: FileViewMode[] = ["edit", "split", "preview"];
const CONNECTION_STATUSES: ConnectionStatus[] = ["idle", "connecting", "connected", "offline"];
const RECOVERY_EVENT_TYPES: CollabRecoveryEvent["type"][] = ["reconnected", "snapshot-recovered", "invalid-message"];

export type FileViewMode = "edit" | "split" | "preview";
export type ReadingWidth = "narrow" | "standard" | "wide";

export type FileBookmark = {
  id: string;
  position: number;
  createdAt: string;
};

export type WorkspaceFile = {
  id: string;
  title: string;
  text: string;
  viewMode: FileViewMode;
  readingWidth: ReadingWidth;
  splitRatio?: number;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks?: FileBookmark[];
  connectionStatus?: ConnectionStatus;
  roomId?: string;
  shareUrl?: string;
  collaboratorCount?: number;
  snapshotCount?: number;
  lastSnapshotAt?: string;
  lastRecoveryType?: CollabRecoveryEvent["type"];
  lastRecoveryMessage?: string;
  lastRecoveryAt?: string;
};

export type FileCommentReply = {
  id: string;
  body: string;
  authorName?: string;
  authorColor?: string;
  createdAt: string;
};

export type FileComment = {
  id: string;
  body: string;
  authorName?: string;
  authorColor?: string;
  quote?: string;
  sourceQuote?: string;
  prefix?: string;
  suffix?: string;
  selectionStart?: number;
  selectionEnd?: number;
  resolved?: boolean;
  replies?: FileCommentReply[];
  createdAt: string;
};

export type WorkspaceState = {
  files: WorkspaceFile[];
  openFileIds: string[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
};

export type InitialWorkspaceSnapshot = {
  source: "localStorage" | "starter";
  workspace: WorkspaceState;
};

export type StoredWorkspaceFile = {
  id: string;
  title: string;
  text: string;
  viewMode: FileViewMode;
  readingWidth: ReadingWidth;
  splitRatio?: number;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks?: FileBookmark[];
  connectionStatus?: ConnectionStatus;
  roomId?: string;
  shareUrl?: string;
  collaboratorCount?: number;
  snapshotCount?: number;
  lastSnapshotAt?: string;
  lastRecoveryType?: CollabRecoveryEvent["type"];
  lastRecoveryMessage?: string;
  lastRecoveryAt?: string;
};

export type StoredProjectV5 = {
  schema: "tabula.project";
  version: typeof PROJECT_STORAGE_VERSION;
  savedAt: string;
  activeFileId: string;
  openFileIds: string[];
  fileOrder: string[];
  files: Record<string, StoredWorkspaceFile>;
  commentsByFileId: Record<string, FileComment[]>;
};

export type LocationRoom = {
  roomId: string;
  shareUrl: string;
};

export const randomId = () => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const clampSplitEditorRatio = (value: unknown) => {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_SPLIT_EDITOR_RATIO;
  return Math.min(MAX_SPLIT_EDITOR_RATIO, Math.max(MIN_SPLIT_EDITOR_RATIO, numericValue));
};

export const getRoomFromLocation = (): LocationRoom | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const room = parseRoomLocation(window.location);
  if (!room) {
    return null;
  }

  return {
    roomId: room.roomId,
    shareUrl: room.shareUrl,
  };
};

const getLiveFileId = (roomId: string) => `live-${roomId}`;

export const getLiveFileTitle = (roomId: string) => `Shared ${roomId.slice(0, 8)}.md`;

export const getFileIdForRoom = (files: WorkspaceFile[], roomId: string) =>
  files.find((file) => file.roomId === roomId)?.id ?? getLiveFileId(roomId);

const getUsableLiveRoom = (roomId?: string, shareUrl?: string) => {
  if (!roomId || !shareUrl) {
    return {};
  }

  const parsedRoom = parseRoomShareUrl(shareUrl);
  if (!parsedRoom || parsedRoom.roomId !== roomId) {
    return {};
  }

  return {
    roomId: parsedRoom.roomId,
    shareUrl: parsedRoom.shareUrl,
  };
};

export const isUsableLiveRoomFile = (file?: Pick<WorkspaceFile, "roomId" | "shareUrl">) =>
  Boolean(getUsableLiveRoom(file?.roomId, file?.shareUrl).roomId);

const getFileUrlPath = (file?: Pick<WorkspaceFile, "roomId" | "shareUrl">) => {
  const liveRoom = getUsableLiveRoom(file?.roomId, file?.shareUrl);
  if (!liveRoom.roomId || !liveRoom.shareUrl) {
    return "/";
  }

  const fileUrl = new URL(liveRoom.shareUrl);
  return `${fileUrl.pathname}${fileUrl.hash}`;
};

const syncUrlPath = (nextPath: string, mode: "push" | "replace" = "push") => {
  const currentPath = `${window.location.pathname}${window.location.hash}`;
  if (currentPath === nextPath) {
    return;
  }

  if (mode === "replace") {
    window.history.replaceState(null, "", nextPath);
    return;
  }

  window.history.pushState(null, "", nextPath);
};

export const syncUrlForFile = (
  file?: Pick<WorkspaceFile, "roomId" | "shareUrl">,
  mode: "push" | "replace" = "push",
) => {
  syncUrlPath(getFileUrlPath(file), mode);
};

export const ensureLiveFileForRoom = (files: WorkspaceFile[], room: LocationRoom) => {
  const existingFile = files.find((file) => file.roomId === room.roomId);
  if (existingFile) {
    return files.map((file) =>
      file.id === existingFile.id
        ? {
            ...file,
            shareUrl: room.shareUrl,
            connectionStatus: "connecting" as ConnectionStatus,
          }
        : file,
    );
  }

  const userFileCount = files.filter((file) => file.id !== README_FILE_ID).length;
  return [
    ...files,
    createWorkspaceFile(userFileCount + 1, {
      id: getLiveFileId(room.roomId),
      title: getLiveFileTitle(room.roomId),
      roomId: room.roomId,
      shareUrl: room.shareUrl,
      connectionStatus: "connecting",
    }),
  ];
};

const createReadmeFile = (): WorkspaceFile => ({
  id: README_FILE_ID,
  title: "README.md",
  text: STARTER_README_MARKDOWN,
  viewMode: "preview",
  readingWidth: "wide",
  lineWrapping: true,
  lineNumbers: true,
  bookmarks: [],
  connectionStatus: "idle",
});

export const createWorkspaceFile = (index: number, overrides: Partial<WorkspaceFile> = {}): WorkspaceFile => {
  return {
    id: randomId(),
    title: index === 1 ? "Untitled.md" : `Untitled ${index}.md`,
    text: STARTER_MARKDOWN,
    viewMode: "edit",
    readingWidth: "wide",
    lineWrapping: true,
    lineNumbers: true,
    bookmarks: [],
    connectionStatus: "idle",
    ...overrides,
  };
};

const isDefaultReadmeFile = (file: Partial<WorkspaceFile>) => {
  const normalizedTitle = file.title?.trim().toLowerCase();
  return file.id === README_FILE_ID || normalizedTitle === "readme.md";
};

export const ensureDefaultFiles = (files: WorkspaceFile[], options: { ensureUntitled?: boolean } = {}) => {
  const readmeFile = files.find(isDefaultReadmeFile);
  const readmeTitle = readmeFile?.title?.trim().toLowerCase();
  const shouldRefreshReadmeText =
    !readmeFile?.text || DEFAULT_README_REFRESH_MARKERS.some((marker) => readmeFile.text.includes(marker));
  const normalizedReadmeFile = readmeFile
    ? {
        ...readmeFile,
        id: README_FILE_ID,
        title: readmeTitle === "readme.md" ? "README.md" : readmeFile.title,
        text: shouldRefreshReadmeText ? STARTER_README_MARKDOWN : readmeFile.text,
        viewMode: readmeFile.viewMode ?? "preview",
        readingWidth: readmeFile.readingWidth ?? "wide",
        lineWrapping: readmeFile.lineWrapping ?? true,
        lineNumbers: readmeFile.lineNumbers ?? true,
        bookmarks: readmeFile.bookmarks ?? [],
        connectionStatus: readmeFile.connectionStatus ?? "idle",
      }
    : createReadmeFile();

  if (readmeFile) {
    return files.map((file) => (file === readmeFile ? normalizedReadmeFile : file));
  }

  if (files.length > 0) {
    return files;
  }

  return options.ensureUntitled ? [normalizedReadmeFile, createWorkspaceFile(1)] : [normalizedReadmeFile];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const getString = (value: unknown) => (typeof value === "string" ? value : undefined);

const getFiniteNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const getFileViewMode = (value: unknown): FileViewMode | undefined =>
  typeof value === "string" && FILE_VIEW_MODES.includes(value as FileViewMode)
    ? (value as FileViewMode)
    : undefined;

const getReadingWidth = (value: unknown): ReadingWidth | undefined =>
  typeof value === "string" && READING_WIDTHS.includes(value as ReadingWidth) ? (value as ReadingWidth) : undefined;

const getConnectionStatus = (value: unknown): ConnectionStatus | undefined =>
  typeof value === "string" && CONNECTION_STATUSES.includes(value as ConnectionStatus)
    ? (value as ConnectionStatus)
    : undefined;

const getRecoveryEventType = (value: unknown): CollabRecoveryEvent["type"] | undefined =>
  typeof value === "string" && RECOVERY_EVENT_TYPES.includes(value as CollabRecoveryEvent["type"])
    ? (value as CollabRecoveryEvent["type"])
    : undefined;

const normalizeConnectionStatus = (status: ConnectionStatus | undefined, roomId?: string) => {
  if (!roomId) {
    return "idle";
  }

  return status === "connecting" ? "connecting" : "offline";
};

const normalizeFileBookmarks = (bookmarks: unknown, textLength: number): FileBookmark[] => {
  if (!Array.isArray(bookmarks)) {
    return [];
  }

  return bookmarks
    .filter((bookmark): bookmark is Record<string, unknown> => isRecord(bookmark))
    .map((bookmark) => ({
      id: getString(bookmark.id) || randomId(),
      position: Math.max(0, Math.min(getFiniteNumber(bookmark.position) ?? 0, textLength)),
      createdAt: getString(bookmark.createdAt) || new Date().toISOString(),
    }))
    .filter((bookmark, index, bookmarkList) =>
      bookmarkList.findIndex((candidate) => candidate.position === bookmark.position) === index,
    );
};

const normalizeWorkspaceFile = (value: unknown, index: number): WorkspaceFile | null => {
  if (!isRecord(value)) {
    return null;
  }

  const text = getString(value.text) ?? "";
  const liveRoom = getUsableLiveRoom(getString(value.roomId), getString(value.shareUrl));
  const connectionStatus = normalizeConnectionStatus(getConnectionStatus(value.connectionStatus), liveRoom.roomId);
  const splitRatio = getFiniteNumber(value.splitRatio);
  const isLiveRoom = Boolean(liveRoom.roomId);

  return {
    id: getString(value.id) || randomId(),
    title: getString(value.title) || `Untitled ${index + 1}.md`,
    text,
    viewMode: getFileViewMode(value.viewMode) ?? "edit",
    readingWidth: getReadingWidth(value.readingWidth) ?? "wide",
    splitRatio: splitRatio === undefined ? undefined : clampSplitEditorRatio(splitRatio),
    lineWrapping: typeof value.lineWrapping === "boolean" ? value.lineWrapping : true,
    lineNumbers: typeof value.lineNumbers === "boolean" ? value.lineNumbers : true,
    bookmarks: normalizeFileBookmarks(value.bookmarks, text.length),
    connectionStatus,
    roomId: liveRoom.roomId,
    shareUrl: liveRoom.shareUrl,
    collaboratorCount: isLiveRoom ? (getFiniteNumber(value.collaboratorCount) ?? 0) : 0,
    snapshotCount: isLiveRoom ? (getFiniteNumber(value.snapshotCount) ?? 0) : 0,
    lastSnapshotAt: isLiveRoom ? getString(value.lastSnapshotAt) : undefined,
    lastRecoveryType: isLiveRoom ? getRecoveryEventType(value.lastRecoveryType) : undefined,
    lastRecoveryMessage: isLiveRoom ? getString(value.lastRecoveryMessage) : undefined,
    lastRecoveryAt: isLiveRoom ? getString(value.lastRecoveryAt) : undefined,
  };
};

const normalizeFileComments = (comments: unknown): FileComment[] => {
  if (!Array.isArray(comments)) {
    return [];
  }

  const normalizeReplies = (replies: unknown): FileCommentReply[] => {
    if (!Array.isArray(replies)) {
      return [];
    }

    return replies
      .filter((reply): reply is Record<string, unknown> => isRecord(reply))
      .map((reply) => ({
        id: getString(reply.id) || randomId(),
        body: getString(reply.body) ?? "",
        authorName: getString(reply.authorName),
        authorColor: getString(reply.authorColor),
        createdAt: getString(reply.createdAt) || new Date().toISOString(),
      }))
      .filter((reply) => reply.body.trim());
  };

  return comments
    .filter((comment): comment is Record<string, unknown> => isRecord(comment))
    .map((comment) => ({
      id: getString(comment.id) || randomId(),
      body: getString(comment.body) ?? "",
      authorName: getString(comment.authorName),
      authorColor: getString(comment.authorColor),
      quote: getString(comment.quote),
      sourceQuote: getString(comment.sourceQuote),
      prefix: getString(comment.prefix),
      suffix: getString(comment.suffix),
      selectionStart: getFiniteNumber(comment.selectionStart),
      selectionEnd: getFiniteNumber(comment.selectionEnd),
      resolved: typeof comment.resolved === "boolean" ? comment.resolved : false,
      replies: normalizeReplies(comment.replies),
      createdAt: getString(comment.createdAt) || new Date().toISOString(),
    }))
    .filter((comment) => comment.body.trim());
};

const normalizeCommentsByFileId = (value: unknown): Record<string, FileComment[]> => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([fileId, comments]) => [fileId, normalizeFileComments(comments)] as const)
      .filter(([, comments]) => comments.length > 0),
  );
};

const normalizeFileIdList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((fileId) => getString(fileId))
    .filter((fileId): fileId is string => Boolean(fileId));
};

const normalizeFilesFromMap = (files: unknown, fileOrder: unknown) => {
  if (!isRecord(files)) {
    return [];
  }

  const orderedIds = Array.isArray(fileOrder)
    ? fileOrder
        .map((fileId) => getString(fileId))
        .filter((fileId): fileId is string => Boolean(fileId))
    : [];
  const remainingIds = Object.keys(files).filter((fileId) => !orderedIds.includes(fileId));
  const allIds = [...orderedIds, ...remainingIds];

  return allIds
    .map((fileId, index) => normalizeWorkspaceFile(files[fileId], index))
    .filter((file): file is WorkspaceFile => Boolean(file));
};

export const finalizeWorkspaceState = (
  files: WorkspaceFile[],
  activeFileId?: string,
  commentsByFileId: Record<string, FileComment[]> = {},
  options: { includeLocationRoom?: boolean; openFileIds?: string[] } = {},
): WorkspaceState => {
  const room = options.includeLocationRoom === false ? null : getRoomFromLocation();
  let nextFiles = ensureDefaultFiles(files, { ensureUntitled: files.length === 0 });

  if (room) {
    nextFiles = ensureLiveFileForRoom(nextFiles, room);
  }

  const fileIds = new Set(nextFiles.map((file) => file.id));
  const storedOpenFileIds = options.openFileIds;
  const hasStoredOpenFileIds = Array.isArray(storedOpenFileIds);
  let nextOpenFileIds = hasStoredOpenFileIds
    ? storedOpenFileIds.filter((fileId, index, fileIdList) => fileIds.has(fileId) && fileIdList.indexOf(fileId) === index)
    : nextFiles.map((file) => file.id);
  const storedActiveFileId = activeFileId && nextFiles.some((file) => file.id === activeFileId) ? activeFileId : undefined;
  const defaultReadmeFile = nextFiles.find(isDefaultReadmeFile);
  const defaultLocalFile = nextFiles.find((file) => !isDefaultReadmeFile(file));
  const storedActiveFile = nextFiles.find((file) => file.id === storedActiveFileId);
  const hasOpenTabs = nextOpenFileIds.length > 0;
  const hasOnlyStarterFiles =
    nextFiles.length === 2 &&
    Boolean(defaultReadmeFile) &&
    Boolean(defaultLocalFile) &&
    !defaultLocalFile?.roomId &&
    defaultLocalFile?.title === "Untitled.md" &&
    defaultLocalFile?.text.trim() === "";
  const storedActiveIsReadme = storedActiveFile ? isDefaultReadmeFile(storedActiveFile) : false;
  const shouldPreferReadmeIntro =
    hasOpenTabs && (!storedActiveFileId || (hasOnlyStarterFiles && Boolean(storedActiveFile) && !storedActiveIsReadme));
  let nextActiveFileId = room
    ? getFileIdForRoom(nextFiles, room.roomId)
    : (shouldPreferReadmeIntro ? defaultReadmeFile?.id : (storedActiveFileId ?? defaultReadmeFile?.id)) ??
      defaultLocalFile?.id ??
      nextFiles[0]?.id ??
      "";

  if (room && nextActiveFileId && !nextOpenFileIds.includes(nextActiveFileId)) {
    nextOpenFileIds = [...nextOpenFileIds, nextActiveFileId];
  }

  if (nextActiveFileId && !nextOpenFileIds.includes(nextActiveFileId)) {
    nextActiveFileId = hasStoredOpenFileIds ? (nextOpenFileIds[0] ?? "") : nextActiveFileId;
    if (nextActiveFileId && !nextOpenFileIds.includes(nextActiveFileId)) {
      nextOpenFileIds = [...nextOpenFileIds, nextActiveFileId];
    }
  }

  return {
    files: nextFiles,
    openFileIds: nextOpenFileIds,
    activeFileId: nextActiveFileId,
    commentsByFileId,
  };
};

export const migrateWorkspacePayload = (
  payload: unknown,
  options: { includeLocationRoom?: boolean } = {},
): WorkspaceState | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const activeFileId = getString(payload.activeFileId);
  const openFileIds = normalizeFileIdList(payload.openFileIds);
  const commentsByFileId = normalizeCommentsByFileId(payload.commentsByFileId);

  const isProjectPayload = payload.version === PROJECT_STORAGE_VERSION && payload.schema === "tabula.project";

  if (isProjectPayload) {
    if (!isRecord(payload.files)) {
      return null;
    }

    return finalizeWorkspaceState(
      normalizeFilesFromMap(payload.files, payload.fileOrder),
      activeFileId,
      commentsByFileId,
      { ...options, openFileIds },
    );
  }

  return null;
};

const readJsonFromStorage = (key: string, storage: WorkspaceStorageAdapter) => {
  let stored: string | null;
  try {
    stored = storage.getItem(key);
  } catch {
    return null;
  }

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as unknown;
  } catch {
    return null;
  }
};

export const readStoredWorkspace = (
  storage: WorkspaceStorageAdapter = browserWorkspaceStorageAdapter,
): WorkspaceState | null => {
  return migrateWorkspacePayload(readJsonFromStorage(PROJECT_STORAGE_KEY, storage));
};

export const readInitialWorkspaceSnapshot = (): InitialWorkspaceSnapshot => {
  const storedWorkspace = readStoredWorkspace();
  return storedWorkspace
    ? { source: "localStorage", workspace: storedWorkspace }
    : { source: "starter", workspace: finalizeWorkspaceState([]) };
};

export const serializeFile = (file: WorkspaceFile): StoredWorkspaceFile => {
  const liveRoom = getUsableLiveRoom(file.roomId, file.shareUrl);
  const isLiveRoom = Boolean(liveRoom.roomId);

  return {
    id: file.id,
    title: file.title,
    text: file.text,
    viewMode: file.viewMode,
    readingWidth: file.readingWidth,
    splitRatio: typeof file.splitRatio === "number" ? clampSplitEditorRatio(file.splitRatio) : undefined,
    lineWrapping: file.lineWrapping,
    lineNumbers: file.lineNumbers,
    bookmarks: file.bookmarks ?? [],
    connectionStatus: normalizeConnectionStatus(file.connectionStatus, liveRoom.roomId),
    roomId: liveRoom.roomId,
    shareUrl: liveRoom.shareUrl,
    collaboratorCount: isLiveRoom ? (file.collaboratorCount ?? 0) : 0,
    snapshotCount: isLiveRoom ? (file.snapshotCount ?? 0) : 0,
    lastSnapshotAt: isLiveRoom ? file.lastSnapshotAt : undefined,
    lastRecoveryType: isLiveRoom ? file.lastRecoveryType : undefined,
    lastRecoveryMessage: isLiveRoom ? file.lastRecoveryMessage : undefined,
    lastRecoveryAt: isLiveRoom ? file.lastRecoveryAt : undefined,
  };
};

type CreateStoredWorkspaceInput = Omit<WorkspaceState, "openFileIds"> & {
  openFileIds?: string[];
};

export const createStoredWorkspace = ({
  files,
  openFileIds = files.map((file) => file.id),
  activeFileId,
  commentsByFileId,
}: CreateStoredWorkspaceInput): StoredProjectV5 => ({
  schema: "tabula.project",
  version: PROJECT_STORAGE_VERSION,
  savedAt: new Date().toISOString(),
  activeFileId,
  openFileIds: openFileIds.filter(
    (fileId, index, fileIdList) => files.some((file) => file.id === fileId) && fileIdList.indexOf(fileId) === index,
  ),
  fileOrder: files.map((file) => file.id),
  files: Object.fromEntries(files.map((file) => [file.id, serializeFile(file)])),
  commentsByFileId,
});

export const writeStoredWorkspace = (
  workspace: WorkspaceState,
  storage: WorkspaceStorageAdapter = browserWorkspaceStorageAdapter,
) => {
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createStoredWorkspace(workspace)));
};

export const initialWorkspaceState = (): WorkspaceState => {
  return readInitialWorkspaceSnapshot().workspace;
};
