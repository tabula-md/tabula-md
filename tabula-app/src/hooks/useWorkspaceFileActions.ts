import type { Dispatch, SetStateAction } from "react";
import type { AppToastState } from "./useAppToast";
import type { FileHistory } from "../document/useWorkspaceActiveFileEditor";
import type { WorkspacePreferences } from "./useWorkspacePreferences";
import { getNewFilePreferenceOverrides } from "../workspaceIoModel";
import type { RenameFileResult } from "@tabula-md/tabula";
import type { ConnectionStatus } from "../collaboration/liveCollaboration";
import { removeRecordKey } from "../workspaceFileRuntimeModel";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";
import type { WorkspaceActionCopy } from "../workspaceActionLocale";

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
  copy: WorkspaceActionCopy;
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
  copy,
}: UseWorkspaceFileActionsArgs) {
  const selectFile = (fileId: string) => {
    onBeforeWorkspaceBoundary?.();
    const nextFile = selectWorkspaceFileAction(fileId);
    if (!nextFile) {
      return;
    }

    closeFloatingChrome();
  };

  const createFile = (overrides?: Partial<WorkspaceFile>) => {
    onBeforeWorkspaceBoundary?.();
    queueEditorFocus();
    const nextFile = addWorkspaceFileAction({
      ...getNewFilePreferenceOverrides(preferences),
      ...overrides,
    });
    if (isRoomSession && onFileCreated && !onFileCreated(nextFile)) {
      deleteWorkspaceFileAction(nextFile.id);
      showToast(copy.fileAddFailed, "error");
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
      showToast(copy.fileRenameFailed, "error");
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
      showToast(copy.fileDuplicateFailed, "error");
      return;
    }

    closeFloatingChrome();
    showToast(copy.fileDuplicated);
  };

  const deleteFile = (fileId: string) => {
    onBeforeWorkspaceBoundary?.();
    const currentFile = files.find((file) => file.id === fileId);
    if (!currentFile) {
      return;
    }
    const roomText = isRoomSession ? readFileText?.(fileId) : undefined;
    if (isRoomSession && roomText == null) {
      showToast(copy.fileDeleteNotReady, "error");
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
      showToast(copy.fileDeleteFailed, "error");
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

    showToast(copy.fileDeleted, "neutral", {
      actionLabel: copy.undo,
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
          showToast(copy.fileRestoreFailed, "error");
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
        showToast(copy.fileRestored);
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
