import type { Dispatch, SetStateAction } from "react";
import type { WorkspaceRoomComment, WorkspaceRoomSnapshot } from "@tabula-md/tabula";
import { projectWorkspaceRoomComments } from "../collaboration/workspaceRoomProjection";
import type { DeletedWorkspaceFolderBundle } from "./state/workspaceStore";
import type { FileComment, WorkspaceFile, WorkspaceFolder } from "./workspaceStorage";
import { WORKSPACE_ROOT_FOLDER_ID } from "./workspaceStorage";
import type { WorkspaceActionCopy } from "./workspaceActionLocale";
import type { FileHistory } from "../document/useWorkspaceActiveFileEditor";
import { useEventCallback } from "../shared/useEventCallback";

type ShowToast = (
  message: string,
  tone?: "neutral" | "error",
  options?: { actionLabel?: string; onAction?: () => void },
) => void;

type UseWorkspaceFolderActionsOptions = {
  activeRoom: boolean;
  copy: WorkspaceActionCopy;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  historyByFileId: Record<string, FileHistory>;
  addFolder: (title?: string, parentId?: string) => WorkspaceFolder | undefined;
  deleteFolder: (folderId: string) => DeletedWorkspaceFolderBundle | undefined;
  deleteCommentsForFiles: (fileIds: Set<string>) => Record<string, FileComment[]>;
  deleteRoomNode: (nodeId: string) => boolean;
  materializeRoomWorkspace: () => WorkspaceRoomSnapshot | undefined;
  moveFile: (fileId: string, folderId: string) => boolean;
  moveFolder: (folderId: string, parentId: string) => boolean;
  moveRoomNode: (nodeId: string, parentId: string) => boolean;
  publishRoomFolder: (folder: WorkspaceFolder) => boolean;
  readFolder: (folderId: string) => WorkspaceFolder | undefined;
  renameFolder: (folderId: string, title: string) => boolean;
  renameRoomNode: (nodeId: string, title: string) => boolean;
  restoreCommentsForFiles: (comments: Record<string, FileComment[]>) => void;
  restoreFolder: (bundle: DeletedWorkspaceFolderBundle) => WorkspaceFile | undefined;
  restoreRoomFolderBundle: (bundle: DeletedWorkspaceFolderBundle) => boolean;
  setHistoryByFileId: Dispatch<SetStateAction<Record<string, FileHistory>>>;
  showToast: ShowToast;
  upsertRoomComment: (comment: WorkspaceRoomComment) => void;
};

export function useWorkspaceFolderActions({
  activeRoom,
  copy,
  files,
  folders,
  historyByFileId,
  addFolder,
  deleteFolder,
  deleteCommentsForFiles,
  deleteRoomNode,
  materializeRoomWorkspace,
  moveFile,
  moveFolder,
  moveRoomNode,
  publishRoomFolder,
  readFolder,
  renameFolder,
  renameRoomNode,
  restoreCommentsForFiles,
  restoreFolder,
  restoreRoomFolderBundle,
  setHistoryByFileId,
  showToast,
  upsertRoomComment,
}: UseWorkspaceFolderActionsOptions) {
  const addWorkspaceFolder = useEventCallback((parentId?: string) => {
    const folder = addFolder("New folder", parentId);
    if (!folder) {
      showToast(copy.folderDepth, "error");
      return undefined;
    }
    if (!publishRoomFolder(folder)) {
      deleteFolder(folder.id);
      showToast(copy.folderAddFailed, "error");
      return undefined;
    }
    return folder;
  });

  const deleteWorkspaceFolder = useEventCallback((folderId: string) => {
    const roomSnapshot = activeRoom ? materializeRoomWorkspace() : undefined;
    if (activeRoom && !roomSnapshot) {
      showToast(copy.folderDeleteNotReady, "error");
      return;
    }
    if (activeRoom && !deleteRoomNode(folderId)) {
      showToast(copy.folderDeleteFailed, "error");
      return;
    }
    const deletedBundle = deleteFolder(folderId);
    if (!deletedBundle) return;
    const restorableBundle = roomSnapshot
      ? {
          ...deletedBundle,
          files: deletedBundle.files.map(({ item, ...entry }) => ({
            ...entry,
            item: { ...item, text: roomSnapshot.documents[item.id] ?? "" },
          })),
        }
      : deletedBundle;
    const deletedFileIds = new Set(restorableBundle.files.map(({ item }) => item.id));
    const locallyDeletedComments = deleteCommentsForFiles(deletedFileIds);
    const deletedComments = roomSnapshot
      ? Object.fromEntries(
          Object.entries(projectWorkspaceRoomComments(roomSnapshot.commentsByFileId))
            .filter(([fileId]) => deletedFileIds.has(fileId)),
        )
      : locallyDeletedComments;
    const deletedHistory = Object.fromEntries(
      Object.entries(historyByFileId).filter(([fileId]) => deletedFileIds.has(fileId)),
    );
    setHistoryByFileId((currentHistory) =>
      Object.fromEntries(Object.entries(currentHistory).filter(([fileId]) => !deletedFileIds.has(fileId))),
    );
    showToast(copy.folderDeleted, "neutral", {
      actionLabel: copy.undo,
      onAction: () => {
        restoreFolder(activeRoom
          ? {
              ...restorableBundle,
              files: restorableBundle.files.map((entry) => ({
                ...entry,
                item: { ...entry.item, text: "" },
              })),
            }
          : restorableBundle);
        if (!restoreRoomFolderBundle(restorableBundle)) {
          deleteRoomNode(folderId);
          deleteFolder(folderId);
          showToast(copy.folderRestoreFailed, "error");
          return;
        }
        restoreCommentsForFiles(deletedComments);
        for (const [fileId, comments] of Object.entries(deletedComments)) {
          for (const comment of comments) {
            upsertRoomComment({
              ...comment,
              fileId,
              resolved: comment.resolved ?? false,
              replies: comment.replies ?? [],
            });
          }
        }
        setHistoryByFileId((currentHistory) => ({ ...currentHistory, ...deletedHistory }));
        showToast(copy.folderRestored);
      },
    });
  });

  const renameWorkspaceFolder = useEventCallback((folderId: string, title: string) => {
    const folder = folders.find((candidate) => candidate.id === folderId);
    if (!folder || !renameFolder(folderId, title)) return false;
    const currentFolder = readFolder(folderId);
    if (activeRoom && currentFolder && !renameRoomNode(folderId, currentFolder.title)) {
      renameFolder(folderId, folder.title);
      return false;
    }
    return true;
  });

  const moveWorkspaceFile = useEventCallback((fileId: string, folderId: string) => {
    const file = files.find((candidate) => candidate.id === fileId);
    const previousParentId = file?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    if (!moveFile(fileId, folderId)) return;
    if (activeRoom && !moveRoomNode(fileId, folderId)) {
      moveFile(fileId, previousParentId);
      showToast(copy.documentMoveFailed, "error");
    }
  });

  const moveWorkspaceFolder = useEventCallback((folderId: string, parentId: string) => {
    const folder = folders.find((candidate) => candidate.id === folderId);
    const previousParentId = folder?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    if (!moveFolder(folderId, parentId)) {
      showToast(copy.folderMoveInvalid, "error");
      return;
    }
    if (activeRoom && !moveRoomNode(folderId, parentId)) {
      moveFolder(folderId, previousParentId);
      showToast(copy.folderMoveFailed, "error");
    }
  });

  return {
    addWorkspaceFolder,
    deleteWorkspaceFolder,
    moveWorkspaceFile,
    moveWorkspaceFolder,
    renameWorkspaceFolder,
  };
}
