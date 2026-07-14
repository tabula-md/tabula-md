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
import { PRODUCT_NAME } from "./product";

export {
  clampSplitEditorRatio,
  DEFAULT_SPLIT_EDITOR_RATIO,
  MAX_SPLIT_EDITOR_RATIO,
  MIN_SPLIT_EDITOR_RATIO,
  READING_WIDTHS,
};
export type { FileViewMode, ReadingWidth };

export const PROJECT_STORAGE_VERSION = 7;
export const WORKSPACE_STORAGE_VERSION = PROJECT_STORAGE_VERSION;
const STARTER_MARKDOWN = "";
export const README_FILE_ID = "tabula-readme";
export const STARTER_README_MARKDOWN = `---
title: ${PRODUCT_NAME}
description: A local-first Markdown workspace for files that people and agents can share safely.
---

${PRODUCT_NAME} is a local-first Markdown workspace for files that people and agents can share safely.

No dashboard first. No project ceremony. Open a workspace, write Markdown, and start a live room when the workspace is ready to collaborate.

## Start here

1. Create a blank Markdown file.
2. Edit, preview, or keep split view open.
3. Share a live room for co-editing or an encrypted export link for handoff.

## Fits

- Product specs, design notes, decisions, runbooks, research, and implementation plans.
- Markdown files that teammates and agents should both understand.

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
};

export const WORKSPACE_ROOT_FOLDER_ID = "workspace-root";

export type WorkspaceFolder = {
  id: string;
  title: string;
  parentId: string | null;
  order?: number;
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
  anchorDetached?: boolean;
  authorName?: string;
  authorColor?: string;
  quote?: string;
  sourceQuote?: string;
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
};

export type StoredProjectV7 = {
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

export const syncUrlForLocalWorkspace = (mode: "push" | "replace" = "push") => {
  syncUrlPath("/", mode);
};

export const syncUrlForRoom = (
  room: LocationRoom,
  mode: "push" | "replace" = "push",
) => {
  const parsedRoom = parseRoomShareUrl(room.shareUrl);
  if (!parsedRoom || parsedRoom.roomId !== room.roomId) {
    syncUrlForLocalWorkspace(mode);
    return;
  }
  const roomUrl = new URL(parsedRoom.shareUrl);
  syncUrlPath(`${roomUrl.pathname}${roomUrl.hash}`, mode);
};

export const createRoomWorkspaceState = (): WorkspaceState => {
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
    ...overrides,
  };
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
      anchorDetached: comment.anchorDetached === true,
      authorName: getString(comment.authorName),
      authorColor: getString(comment.authorColor),
      quote: getString(comment.quote),
      sourceQuote: getString(comment.sourceQuote),
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
  options: { folders?: WorkspaceFolder[]; openFileIds?: string[] } = {},
): WorkspaceState => {
  const normalizedTree = normalizeWorkspaceTree(
    files,
    options.folders?.length ? options.folders : [createWorkspaceRootFolder()],
  );
  const nextFiles = normalizedTree.files;

  const fileIds = new Set(nextFiles.map((file) => file.id));
  const storedOpenFileIds = options.openFileIds;
  const hasStoredOpenFileIds = Array.isArray(storedOpenFileIds);
  let nextOpenFileIds = hasStoredOpenFileIds
    ? storedOpenFileIds.filter((fileId, index, fileIdList) => fileIds.has(fileId) && fileIdList.indexOf(fileId) === index)
    : nextFiles.map((file) => file.id);
  const storedActiveFileId = activeFileId && nextFiles.some((file) => file.id === activeFileId) ? activeFileId : undefined;
  let nextActiveFileId =
    storedActiveFileId ??
    nextOpenFileIds[0] ??
    nextFiles[0]?.id ??
    "";

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

export const createStarterWorkspaceState = (): WorkspaceState =>
  finalizeWorkspaceState([], undefined, {}, { openFileIds: [] });

export const parseWorkspacePayload = (payload: unknown): WorkspaceState | null => {
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
    return { source: "room", room, workspace: createRoomWorkspaceState() };
  }

  return { source: "starter", workspace: createStarterWorkspaceState() };
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
}: CreateStoredWorkspaceInput): StoredProjectV7 => {
  const storedFiles = files;
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
    folders: Object.fromEntries(folders.map((folder) => [folder.id, folder])),
    files: Object.fromEntries(storedFiles.map((file) => [file.id, serializeFile(file)])),
    commentsByFileId,
  };
};

export const initialWorkspaceState = (): WorkspaceState => {
  return readInitialWorkspaceSnapshot().workspace;
};
