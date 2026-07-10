import type { Dispatch, SetStateAction } from "react";
import type { AppToastState } from "./useAppToast";
import type { FileHistory } from "./useWorkspaceActiveFileEditor";
import type { WorkspacePreferences } from "./useWorkspacePreferences";
import { getNewFilePreferenceOverrides } from "../workspaceIoModel";
import type { RenameFileResult } from "@tabula-md/tabula";
import {
  findWorkspaceAboutFile,
  getWorkspaceAboutFileDraft,
  removeRecordKey,
} from "../workspaceFileRuntimeModel";
import {
  syncUrlForFile,
  type FileComment,
  type WorkspaceFile,
} from "../workspaceStorage";

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

export const getLiveRoomFileOverrides = (
  activeFile?: Pick<
    WorkspaceFile,
    "roomId" | "shareUrl" | "connectionStatus"
  >,
): Partial<WorkspaceFile> => {
  if (!activeFile?.roomId || !activeFile.shareUrl) {
    return {};
  }

  return {
    roomId: activeFile.roomId,
    shareUrl: activeFile.shareUrl,
    connectionStatus: activeFile.connectionStatus ?? "idle",
    lastRecoveryType: undefined,
    lastRecoveryMessage: undefined,
    lastRecoveryAt: undefined,
  };
};

type UseWorkspaceFileActionsArgs = {
  activeFile?: WorkspaceFile;
  roomFile?: WorkspaceFile;
  activeFileId: string;
  addFileFromContent: (
    title: string,
    text: string,
    viewMode?: WorkspaceFile["viewMode"],
    overrides?: Partial<WorkspaceFile>,
  ) => WorkspaceFile;
  addWorkspaceFileAction: (overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  closeFloatingChrome: () => void;
  closeWorkspaceFileAction: (fileId: string) => CloseFileResult | undefined;
  commentsByFileId: Record<string, FileComment[]>;
  deleteWorkspaceFileAction: (fileId: string) => DeleteFileResult | undefined;
  duplicateWorkspaceFile: (fileId: string) => WorkspaceFile | undefined;
  files: WorkspaceFile[];
  helpMarkdown: string;
  historyByFileId: Record<string, FileHistory>;
  openFileIds: string[];
  onBeforeWorkspaceBoundary?: () => void;
  preferences: WorkspacePreferences;
  queueEditorFocus: () => void;
  renameFile: (fileId: string, nextRawTitle: string) => RenameFileResult;
  replaceCommentsByFileId: (commentsByFileId: Record<string, FileComment[]>) => void;
  resetCollaborationState: (nextStatus: WorkspaceFile["connectionStatus"]) => void;
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
  upsertHelpFile: (helpMarkdown: string) => WorkspaceFile;
};

export function useWorkspaceFileActions({
  activeFile,
  roomFile,
  activeFileId,
  addFileFromContent,
  addWorkspaceFileAction,
  closeFloatingChrome,
  closeWorkspaceFileAction,
  commentsByFileId,
  deleteWorkspaceFileAction,
  duplicateWorkspaceFile,
  files,
  helpMarkdown,
  historyByFileId,
  openFileIds,
  onBeforeWorkspaceBoundary,
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
  upsertHelpFile,
}: UseWorkspaceFileActionsArgs) {
  const syncSelectedFileUrl = (file?: WorkspaceFile, mode: "push" | "replace" = "push") => {
    if (roomFile?.roomId && !file?.roomId) return;
    syncUrlForFile(file, mode);
  };

  const selectFile = (fileId: string) => {
    onBeforeWorkspaceBoundary?.();
    const nextFile = selectWorkspaceFileAction(fileId);
    if (!nextFile) {
      return;
    }

    closeFloatingChrome();
    syncSelectedFileUrl(nextFile);
  };

  const createFile = (collaborationOverrides: Partial<WorkspaceFile>) => {
    onBeforeWorkspaceBoundary?.();
    queueEditorFocus();
    const nextFile = addWorkspaceFileAction({
      ...getNewFilePreferenceOverrides(preferences),
      ...collaborationOverrides,
    });
    closeFloatingChrome();
    syncSelectedFileUrl(nextFile);
    return nextFile;
  };

  const addFile = () => createFile(getLiveRoomFileOverrides(roomFile ?? activeFile));

  const addPrivateFile = () => createFile({
    roomId: undefined,
    shareUrl: undefined,
    connectionStatus: "idle",
  });

  const openHelpFile = () => {
    onBeforeWorkspaceBoundary?.();
    const nextFile = upsertHelpFile(helpMarkdown);
    closeFloatingChrome();
    syncSelectedFileUrl(nextFile);
  };

  const openAboutFile = () => {
    onBeforeWorkspaceBoundary?.();
    const readmeFile = findWorkspaceAboutFile(files);
    const readmeDraft = getWorkspaceAboutFileDraft();
    const nextFile =
      readmeFile ??
      addFileFromContent(
        readmeDraft.title,
        readmeDraft.text,
        readmeDraft.viewMode,
        readmeDraft.overrides,
      );

    selectWorkspaceFileAction(nextFile.id);
    closeFloatingChrome();
    syncSelectedFileUrl(nextFile);
  };

  const renameWorkspaceFileAction = (fileId: string, nextRawTitle: string) => {
    const result = renameFile(fileId, nextRawTitle);
    if (!result.ok) {
      showToast(result.message, "error");
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

    closeFloatingChrome();
    syncSelectedFileUrl(nextFile);
    showToast("File duplicated.");
  };

  const deleteFile = (fileId: string) => {
    onBeforeWorkspaceBoundary?.();
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

      if (result.nextActiveFile) {
        syncSelectedFileUrl(result.nextActiveFile);
      } else {
        if (!roomFile?.roomId) {
          resetCollaborationState("idle");
          syncSelectedFileUrl(undefined, "replace");
        }
      }
    }

    showToast("File deleted.", "neutral", {
      actionLabel: "Undo",
      onAction: () => {
        const shouldActivateRestoredFile = previousActiveFileId === deletedFile.id;
        restoreFile({
          file: deletedFile,
          fileIndex: deletedFileIndex,
          previousOpenFileIds,
          activate: shouldActivateRestoredFile,
        });
        if (shouldActivateRestoredFile) {
          syncSelectedFileUrl(deletedFile);
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

      if (result.nextActiveFile) {
        syncSelectedFileUrl(result.nextActiveFile);
        return;
      }

      if (!roomFile?.roomId) {
        resetCollaborationState("idle");
        syncSelectedFileUrl(undefined, "replace");
      }
    }
  };

  const selectAdjacentFile = (direction: -1 | 1) => {
    onBeforeWorkspaceBoundary?.();
    const nextFile = selectAdjacentWorkspaceFileAction(direction);
    if (nextFile) {
      closeFloatingChrome();
      syncSelectedFileUrl(nextFile);
    }
  };

  return {
    selectFile,
    addFile,
    addPrivateFile,
    openAboutFile,
    openHelpFile,
    renameWorkspaceFileAction,
    duplicateFile,
    deleteFile,
    closeFile,
    selectAdjacentFile,
  };
}
