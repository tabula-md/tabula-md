import type { Dispatch, SetStateAction } from "react";
import type { AppToastState } from "./useAppToast";
import type { FileHistory } from "./useWorkspaceActiveFileEditor";
import type { WorkspacePreferences } from "./useWorkspacePreferences";
import { getNewFilePreferenceOverrides } from "../workspaceIoModel";
import type { RenameFileResult } from "@tabula-md/tabula";
import type { ConnectionStatus } from "../collaboration";
import { removeRecordKey } from "../workspaceFileRuntimeModel";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";

type ShowToast = (
  message: string,
  tone?: AppToastState["tone"],
  action?: Pick<AppToastState, "actionLabel" | "onAction">,
) => void;

type DeleteFileResult = {
  closedActiveFile: boolean;
  nextActiveFile?: WorkspaceFile;
};

type CloseFileResult = {
  closedActiveFile: boolean;
  nextActiveFile?: WorkspaceFile;
};

type UseWorkspaceFileActionsArgs = {
  activeFile?: WorkspaceFile;
  isRoomSession: boolean;
  activeFileId: string;
  addWorkspaceFileAction: (overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  closeFloatingChrome: () => void;
  closeWorkspaceFileAction: (fileId: string) => CloseFileResult | undefined;
  commentsByFileId: Record<string, FileComment[]>;
  deleteWorkspaceFileAction: (fileId: string) => DeleteFileResult | undefined;
  duplicateWorkspaceFile: (fileId: string) => WorkspaceFile | undefined;
  files: WorkspaceFile[];
  historyByFileId: Record<string, FileHistory>;
  openFileIds: string[];
  onBeforeWorkspaceBoundary?: () => void;
  onFileCreated?: (file: WorkspaceFile) => boolean;
  onFileDeleted?: (file: WorkspaceFile) => boolean;
  onFileRenamed?: (fileId: string, title: string) => boolean;
  onFileRestored?: (file: WorkspaceFile, comments: FileComment[]) => boolean;
  readFileComments?: (fileId: string) => FileComment[];
  readFileText?: (fileId: string) => string | null;
  preferences: WorkspacePreferences;
  queueEditorFocus: () => void;
  renameFile: (fileId: string, nextRawTitle: string) => RenameFileResult;
  replaceCommentsByFileId: (commentsByFileId: Record<string, FileComment[]>) => void;
  resetCollaborationState: (nextStatus: ConnectionStatus) => void;
  restoreFile: (input: {
    file: WorkspaceFile;
    fileIndex: number;
    previousOpenFileIds: string[];
    activate: boolean;
  }) => WorkspaceFile;
  selectAdjacentWorkspaceFileAction: (direction: -1 | 1) => WorkspaceFile | undefined;
  selectWorkspaceFileAction: (fileId: string) => WorkspaceFile | undefined;
  setHistoryByFileId: Dispatch<SetStateAction<Record<string, FileHistory>>>;
  showToast: ShowToast;
};

export function useWorkspaceFileActions({
  activeFile,
  isRoomSession,
  activeFileId,
  addWorkspaceFileAction,
  closeFloatingChrome,
  closeWorkspaceFileAction,
  commentsByFileId,
  deleteWorkspaceFileAction,
  duplicateWorkspaceFile,
  files,
  historyByFileId,
  openFileIds,
  onBeforeWorkspaceBoundary,
  onFileCreated,
  onFileDeleted,
  onFileRenamed,
  onFileRestored,
  readFileComments,
  readFileText,
  preferences,
  queueEditorFocus,
  renameFile,
  replaceCommentsByFileId,
  resetCollaborationState,
  restoreFile,
  selectAdjacentWorkspaceFileAction,
  selectWorkspaceFileAction,
  setHistoryByFileId,
  showToast,
}: UseWorkspaceFileActionsArgs) {
  const selectFile = (fileId: string) => {
    onBeforeWorkspaceBoundary?.();
    const nextFile = selectWorkspaceFileAction(fileId);
    if (!nextFile) {
      return;
    }

    closeFloatingChrome();
  };

  const createFile = () => {
    onBeforeWorkspaceBoundary?.();
    queueEditorFocus();
    const nextFile = addWorkspaceFileAction({
      ...getNewFilePreferenceOverrides(preferences),
    });
    if (isRoomSession && onFileCreated && !onFileCreated(nextFile)) {
      deleteWorkspaceFileAction(nextFile.id);
      showToast("This document couldn’t be added to the live workspace.", "error");
      return undefined;
    }
    closeFloatingChrome();
    return nextFile;
  };

  const addFile = createFile;

  const renameWorkspaceFileAction = (fileId: string, nextRawTitle: string) => {
    const previousTitle = files.find((file) => file.id === fileId)?.title;
    const result = renameFile(fileId, nextRawTitle);
    if (!result.ok) {
      showToast(result.message, "error");
      return result;
    }
    if (isRoomSession && onFileRenamed && !onFileRenamed(fileId, result.title)) {
      if (previousTitle) renameFile(fileId, previousTitle);
      showToast("This document couldn’t be renamed in the live workspace.", "error");
    }
    return result;
  };

  const duplicateFile = (fileId: string) => {
    onBeforeWorkspaceBoundary?.();
    queueEditorFocus();
    const nextFile = duplicateWorkspaceFile(fileId);
    if (!nextFile) {
      return;
    }
    if (isRoomSession && onFileCreated && !onFileCreated(nextFile)) {
      deleteWorkspaceFileAction(nextFile.id);
      showToast("This document couldn’t be duplicated in the live workspace.", "error");
      return;
    }

    closeFloatingChrome();
    showToast("File duplicated.");
  };

  const deleteFile = (fileId: string) => {
    onBeforeWorkspaceBoundary?.();
    const currentFile = files.find((file) => file.id === fileId);
    if (!currentFile) {
      return;
    }
    const roomText = isRoomSession ? readFileText?.(fileId) : undefined;
    if (isRoomSession && roomText == null) {
      showToast("This document isn’t ready to delete yet.", "error");
      return;
    }
    const deletedFile: WorkspaceFile = {
      ...currentFile,
      text: roomText ?? currentFile.text,
    };

    const deletedFileIndex = Math.max(
      0,
      files.findIndex((file) => file.id === fileId),
    );
    const previousOpenFileIds = openFileIds;
    const previousActiveFileId = activeFile?.id ?? activeFileId;
    const deletedComments = isRoomSession
      ? readFileComments?.(fileId) ?? []
      : commentsByFileId[fileId];
    const deletedHistory = historyByFileId[fileId];
    if (isRoomSession && onFileDeleted && !onFileDeleted(deletedFile)) {
      showToast("This document couldn’t be deleted from the live workspace.", "error");
      return;
    }
    const result = deleteWorkspaceFileAction(fileId);
    if (!result) {
      return;
    }

    setHistoryByFileId((currentHistory) => removeRecordKey(currentHistory, fileId));
    if (commentsByFileId[fileId]) {
      replaceCommentsByFileId(removeRecordKey(commentsByFileId, fileId));
    }

    if (result.closedActiveFile) {
      closeFloatingChrome();
      if (!result.nextActiveFile) {
        if (!isRoomSession) {
          resetCollaborationState("idle");
        }
      }
    }

    showToast("File deleted.", "neutral", {
      actionLabel: "Undo",
      onAction: () => {
        const shouldActivateRestoredFile = previousActiveFileId === deletedFile.id;
        restoreFile({
          file: isRoomSession ? { ...deletedFile, text: "" } : deletedFile,
          fileIndex: deletedFileIndex,
          previousOpenFileIds,
          activate: shouldActivateRestoredFile,
        });
        if (
          isRoomSession &&
          onFileRestored &&
          !onFileRestored(deletedFile, deletedComments ?? [])
        ) {
          deleteWorkspaceFileAction(deletedFile.id);
          showToast("This document couldn’t be restored to the live workspace.", "error");
          return;
        }
        if (shouldActivateRestoredFile) {
          selectWorkspaceFileAction(deletedFile.id);
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
    onBeforeWorkspaceBoundary?.();
    const result = closeWorkspaceFileAction(fileId);
    if (!result) {
      return;
    }

    if (result.closedActiveFile) {
      closeFloatingChrome();
      if (result.nextActiveFile) return;

      if (!isRoomSession) {
        resetCollaborationState("idle");
      }
    }
  };

  const selectAdjacentFile = (direction: -1 | 1) => {
    onBeforeWorkspaceBoundary?.();
    const nextFile = selectAdjacentWorkspaceFileAction(direction);
    if (nextFile) {
      closeFloatingChrome();
    }
  };

  return {
    selectFile,
    addFile,
    renameWorkspaceFileAction,
    duplicateFile,
    deleteFile,
    closeFile,
    selectAdjacentFile,
  };
}
