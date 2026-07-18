import type { ShareSnapshot } from "@tabula-md/tabula";
import {
  createWorkspaceFile,
  isStarterReadmeText,
  README_FILE_ID,
  type FileComment,
  type WorkspaceFile,
  type WorkspaceState,
} from "../workspaceStorage";

export const createWorkspaceFromJsonShareSnapshot = (snapshot: ShareSnapshot): WorkspaceState => {
  const files = snapshot.files.map((file, index) =>
    createWorkspaceFile(index + 1, {
      id: file.id,
      title: file.title || (index === 0 ? "Shared.md" : `Shared ${index + 1}.md`),
      text: file.text ?? "",
      parentId: file.parentId,
      order: file.order,
      viewMode: "edit",
      readingWidth: "wide",
      lineWrapping: true,
      lineNumbers: true,
      bookmarks: [],
    }),
  );
  const normalizedFiles = files.length > 0 ? files : [createWorkspaceFile(1, { title: "Shared.md" })];
  const activeFileId = normalizedFiles.some((file) => file.id === snapshot.activeFileId)
    ? snapshot.activeFileId
    : normalizedFiles[0]?.id;

  return {
    folders: snapshot.folders.map((folder) => ({
      id: folder.id,
      title: folder.title,
      parentId: folder.id === snapshot.rootFolderId ? null : folder.parentId,
      order: folder.order,
    })),
    files: normalizedFiles,
    openFileIds: normalizedFiles.map((file) => file.id),
    activeFileId: activeFileId ?? normalizedFiles[0]?.id ?? "",
    commentsByFileId: normalizeSnapshotComments(snapshot.commentsByFileId, normalizedFiles),
  };
};

export const hasMeaningfulWorkspaceContent = ({
  files,
  commentsByFileId,
}: {
  files: WorkspaceFile[];
  commentsByFileId: Record<string, FileComment[]>;
}) => {
  if (Object.values(commentsByFileId).some((comments) => comments.length > 0)) {
    return true;
  }

  return files.some((file) => {
    if (file.id === README_FILE_ID && file.title === "README.md") {
      return !isStarterReadmeText(file.text);
    }
    return file.text.trim().length > 0;
  });
};

const normalizeSnapshotComments = (
  commentsByFileId: Record<string, FileComment[]>,
  files: WorkspaceFile[],
): Record<string, FileComment[]> => {
  const fileIds = new Set(files.map((file) => file.id));
  return Object.fromEntries(Object.entries(commentsByFileId).filter(([fileId]) => fileIds.has(fileId)));
};
