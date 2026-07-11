import {
  clampSplitEditorRatio,
  DEFAULT_SPLIT_EDITOR_RATIO,
  FILE_VIEW_MODES,
  MAX_SPLIT_EDITOR_RATIO,
  MIN_SPLIT_EDITOR_RATIO,
  normalizeWorkspaceFileTitle,
  parseRoomLocation,
  parseRoomShareUrl,
  READING_WIDTHS,
  type FileViewMode,
  type ReadingWidth,
} from "@tabula-md/tabula";
import type { CollabRecoveryEvent, ConnectionStatus } from "./collaboration";
import { PRODUCT_NAME } from "./product";

export {
  clampSplitEditorRatio,
  DEFAULT_SPLIT_EDITOR_RATIO,
  MAX_SPLIT_EDITOR_RATIO,
  MIN_SPLIT_EDITOR_RATIO,
  READING_WIDTHS,
};
export type { FileViewMode, ReadingWidth };

export const PROJECT_STORAGE_VERSION = 6;
export const WORKSPACE_STORAGE_VERSION = PROJECT_STORAGE_VERSION;
const STARTER_MARKDOWN = "";
export const README_FILE_ID = "tabula-readme";
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

No dashboard first. No project ceremony. Open a workspace, write Markdown, and start a live room when the workspace is ready to collaborate.

## Start here

1. Create a blank Markdown file.
2. Edit, preview, or keep split view open.
3. Share a live room for co-editing or an encrypted export link for handoff.

## Fits

- Product specs, design notes, decisions, runbooks, research, and implementation plans.
- Markdown files that teammates and coding agents should both understand.

## Storage and sharing

- Local files are saved in this browser.
- Live rooms synchronize the workspace tree, Markdown documents, and comments.
- Export links create an encrypted copy that opens in another local workspace.
`;
export const isStarterReadmeText = (text: string) => text === STARTER_README_MARKDOWN;

export type FileBookmark = {
  id: string;
  position: number;
  createdAt: string;
};

export type WorkspaceFile = {
  id: string;
  title: string;
  text: string;
  parentId?: string | null;
  order?: number;
  viewMode: FileViewMode;
  readingWidth: ReadingWidth;
  splitRatio?: number;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks?: FileBookmark[];
  connectionStatus?: ConnectionStatus;
  roomId?: string;
  shareUrl?: string;
  lastRecoveryType?: CollabRecoveryEvent["type"];
  lastRecoveryMessage?: string;
  lastRecoveryAt?: string;
};

export const WORKSPACE_ROOT_FOLDER_ID = "workspace-root";

export type WorkspaceFolder = {
  id: string;
  title: string;
  parentId: string | null;
  order?: number;
  roomId?: string;
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
  folders: WorkspaceFolder[];
  files: WorkspaceFile[];
  openFileIds: string[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
};

export type InitialWorkspaceSnapshot = {
  source: "room" | "starter";
  room?: LocationRoom;
  workspace: WorkspaceState;
};

export type StoredWorkspaceFile = {
  id: string;
  title: string;
  text: string;
  parentId?: string | null;
  order?: number;
  viewMode: FileViewMode;
  readingWidth: ReadingWidth;
  splitRatio?: number;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks?: FileBookmark[];
  connectionStatus?: ConnectionStatus;
  roomId?: string;
  shareUrl?: string;
  lastRecoveryType?: CollabRecoveryEvent["type"];
  lastRecoveryMessage?: string;
  lastRecoveryAt?: string;
};

export type StoredProjectV6 = {
  schema: "tabula.project";
  version: typeof PROJECT_STORAGE_VERSION;
  savedAt: string;
  activeFileId: string;
  openFileIds: string[];
  fileOrder: string[];
  folderOrder: string[];
  folders: Record<string, WorkspaceFolder>;
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

const GENERATED_LIVE_FILE_TITLE_PATTERN = /^Shared [A-Za-z0-9_-]{8}\.md$/;

export const isEmptyGeneratedLivePlaceholder = (file: WorkspaceFile) =>
  file.text.trim() === "" &&
  ((file.roomId && file.title === getLiveFileTitle(file.roomId)) ||
    (!file.roomId && GENERATED_LIVE_FILE_TITLE_PATTERN.test(file.title)));

const pruneEmptyGeneratedLivePlaceholders = (
  files: WorkspaceFile[],
  commentsByFileId: Record<string, FileComment[]> = {},
) =>
  files.filter((file) => {
    const hasComments = (commentsByFileId[file.id] ?? []).length > 0;
    return hasComments || !isEmptyGeneratedLivePlaceholder(file);
  });

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

export const createRoomWorkspaceState = (_room: LocationRoom): WorkspaceState => {
  return {
    folders: [createWorkspaceRootFolder()],
    files: [],
    openFileIds: [],
    activeFileId: "",
    commentsByFileId: {},
  };
};

export const createWorkspaceRootFolder = (): WorkspaceFolder => ({
  id: WORKSPACE_ROOT_FOLDER_ID,
  title: "Project",
  parentId: null,
  order: 0,
});

const createReadmeFile = (): WorkspaceFile => ({
  id: README_FILE_ID,
  title: "README.md",
  text: STARTER_README_MARKDOWN,
  parentId: WORKSPACE_ROOT_FOLDER_ID,
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
    parentId: WORKSPACE_ROOT_FOLDER_ID,
    order: undefined,
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
  const splitRatio = getFiniteNumber(value.splitRatio);

  return {
    id: getString(value.id) || randomId(),
    title: getString(value.title) || `Untitled ${index + 1}.md`,
    text,
    parentId: typeof value.parentId === "string" ? value.parentId : WORKSPACE_ROOT_FOLDER_ID,
    order: getFiniteNumber(value.order),
    viewMode: getFileViewMode(value.viewMode) ?? "edit",
    readingWidth: getReadingWidth(value.readingWidth) ?? "wide",
    splitRatio: splitRatio === undefined ? undefined : clampSplitEditorRatio(splitRatio),
    lineWrapping: typeof value.lineWrapping === "boolean" ? value.lineWrapping : true,
    lineNumbers: typeof value.lineNumbers === "boolean" ? value.lineNumbers : true,
    bookmarks: normalizeFileBookmarks(value.bookmarks, text.length),
    connectionStatus: "idle",
    roomId: undefined,
    shareUrl: undefined,
    lastRecoveryType: undefined,
    lastRecoveryMessage: undefined,
    lastRecoveryAt: undefined,
  };
};

const normalizeWorkspaceFolder = (value: unknown, fallbackId?: string): WorkspaceFolder | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = getString(value.id) || fallbackId;
  if (!id) {
    return null;
  }
  return {
    id,
    title: (getString(value.title) ?? "")
      .trim()
      .split("\0")
      .join(" ")
      .replace(/[/\\]/g, " ")
      .replace(/\s+/g, " ") || (id === WORKSPACE_ROOT_FOLDER_ID ? "Project" : "Folder"),
    parentId: id === WORKSPACE_ROOT_FOLDER_ID
      ? null
      : (typeof value.parentId === "string" ? value.parentId : WORKSPACE_ROOT_FOLDER_ID),
    order: getFiniteNumber(value.order),
    roomId: undefined,
  };
};

const normalizeFoldersFromMap = (folders: unknown, folderOrder: unknown): WorkspaceFolder[] => {
  if (!isRecord(folders)) {
    return [createWorkspaceRootFolder()];
  }
  const orderedIds = Array.isArray(folderOrder)
    ? folderOrder.map(getString).filter((id): id is string => Boolean(id))
    : [];
  const ids = [...orderedIds, ...Object.keys(folders).filter((id) => !orderedIds.includes(id))];
  const normalized = ids
    .map((id) => normalizeWorkspaceFolder(folders[id], id))
    .filter((folder): folder is WorkspaceFolder => Boolean(folder));
  const withoutDuplicateRoots = normalized.filter((folder) => folder.id !== WORKSPACE_ROOT_FOLDER_ID);
  return [createWorkspaceRootFolder(), ...withoutDuplicateRoots];
};

const normalizeWorkspaceTree = (
  files: WorkspaceFile[],
  folders: WorkspaceFolder[],
) => {
  const uniqueFolders = new Map<string, WorkspaceFolder>();
  for (const folder of folders) {
    if (!folder.id || folder.id === WORKSPACE_ROOT_FOLDER_ID || uniqueFolders.has(folder.id)) continue;
    uniqueFolders.set(folder.id, {
      ...folder,
      title: folder.title.trim().split("\0").join(" ").replace(/[/\\]/g, " ").replace(/\s+/g, " ") || "Folder",
    });
  }
  const foldersById = new Map<string, WorkspaceFolder>([
    [WORKSPACE_ROOT_FOLDER_ID, createWorkspaceRootFolder()],
    ...uniqueFolders,
  ]);
  const normalizedFolders = [createWorkspaceRootFolder()];
  for (const folder of uniqueFolders.values()) {
    let parentId = folder.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    if (!foldersById.has(parentId) || parentId === folder.id) parentId = WORKSPACE_ROOT_FOLDER_ID;
    const visited = new Set([folder.id]);
    let ancestorId: string | null = parentId;
    while (ancestorId && ancestorId !== WORKSPACE_ROOT_FOLDER_ID) {
      if (visited.has(ancestorId)) {
        parentId = WORKSPACE_ROOT_FOLDER_ID;
        break;
      }
      visited.add(ancestorId);
      ancestorId = foldersById.get(ancestorId)?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    }
    const normalized = { ...folder, parentId };
    foldersById.set(folder.id, normalized);
    normalizedFolders.push(normalized);
  }
  return {
    folders: normalizedFolders,
    files: files.map((file) => ({
      ...file,
      title: normalizeWorkspaceFileTitle(file.title),
      parentId: foldersById.has(file.parentId ?? "")
        ? file.parentId
        : WORKSPACE_ROOT_FOLDER_ID,
    })),
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
  options: { folders?: WorkspaceFolder[]; includeLocationRoom?: boolean; openFileIds?: string[] } = {},
): WorkspaceState => {
  const normalizedTree = normalizeWorkspaceTree(
    files,
    options.folders?.length ? options.folders : [createWorkspaceRootFolder()],
  );
  const room = options.includeLocationRoom === false ? null : getRoomFromLocation();
  const prunedFiles = pruneEmptyGeneratedLivePlaceholders(normalizedTree.files, commentsByFileId);
  let nextFiles = ensureDefaultFiles(prunedFiles, { ensureUntitled: prunedFiles.length === 0 });

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
    folders: normalizedTree.folders,
    files: nextFiles,
    openFileIds: nextOpenFileIds,
    activeFileId: nextActiveFileId,
    commentsByFileId,
  };
};

export const parseWorkspacePayload = (
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
      {
        ...options,
        folders: normalizeFoldersFromMap(payload.folders, payload.folderOrder),
        openFileIds,
      },
    );
  }

  return null;
};

export const readInitialWorkspaceSnapshot = (): InitialWorkspaceSnapshot => {
  const room = getRoomFromLocation();
  if (room) {
    return { source: "room", room, workspace: createRoomWorkspaceState(room) };
  }

  return { source: "starter", workspace: finalizeWorkspaceState([]) };
};

export const serializeFile = (file: WorkspaceFile): StoredWorkspaceFile => {
  return {
    id: file.id,
    title: file.title,
    text: file.text,
    parentId: file.parentId ?? WORKSPACE_ROOT_FOLDER_ID,
    order: file.order,
    viewMode: file.viewMode,
    readingWidth: file.readingWidth,
    splitRatio: typeof file.splitRatio === "number" ? clampSplitEditorRatio(file.splitRatio) : undefined,
    lineWrapping: file.lineWrapping,
    lineNumbers: file.lineNumbers,
    bookmarks: file.bookmarks ?? [],
    connectionStatus: "idle",
    roomId: undefined,
    shareUrl: undefined,
    lastRecoveryType: undefined,
    lastRecoveryMessage: undefined,
    lastRecoveryAt: undefined,
  };
};

type CreateStoredWorkspaceInput = Omit<WorkspaceState, "folders" | "openFileIds"> & {
  folders?: WorkspaceFolder[];
  openFileIds?: string[];
};

export const createStoredWorkspace = ({
  folders = [createWorkspaceRootFolder()],
  files,
  openFileIds = files.map((file) => file.id),
  activeFileId,
  commentsByFileId,
}: CreateStoredWorkspaceInput): StoredProjectV6 => {
  const storedFiles = pruneEmptyGeneratedLivePlaceholders(files, commentsByFileId);
  const storedFileIds = new Set(storedFiles.map((file) => file.id));
  const nextActiveFileId = storedFileIds.has(activeFileId) ? activeFileId : (storedFiles[0]?.id ?? "");

  return {
    schema: "tabula.project",
    version: PROJECT_STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    activeFileId: nextActiveFileId,
    openFileIds: openFileIds.filter(
      (fileId, index, fileIdList) => storedFileIds.has(fileId) && fileIdList.indexOf(fileId) === index,
    ),
    fileOrder: storedFiles.map((file) => file.id),
    folderOrder: folders.map((folder) => folder.id),
    folders: Object.fromEntries(folders.map((folder) => [folder.id, { ...folder, roomId: undefined }])),
    files: Object.fromEntries(storedFiles.map((file) => [file.id, serializeFile(file)])),
    commentsByFileId,
  };
};

export const initialWorkspaceState = (): WorkspaceState => {
  return readInitialWorkspaceSnapshot().workspace;
};
