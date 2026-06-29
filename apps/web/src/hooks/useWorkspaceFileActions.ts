import type { Dispatch, SetStateAction } from "react";
import type { AppToastState } from "./useAppToast";
import type { FileHistory } from "./useWorkspaceActiveFileEditor";
import { getNewFilePreferenceOverrides } from "./useProjectIoController";
import type { WorkspacePreferences } from "./useWorkspacePreferences";
import type { RenameFileResult } from "../workspaceModel";
import {
  README_FILE_ID,
  STARTER_README_MARKDOWN,
  syncUrlForFile,
  type FileComment,
  type MarkdownFile,
} from "../workspaceStorage";

type ShowToast = (
  message: string,
  tone?: AppToastState["tone"],
  action?: Pick<AppToastState, "actionLabel" | "onAction">,
) => void;

type DeleteFileResult = {
  closedActiveFile: boolean;
  nextActiveFile?: MarkdownFile;
};

type CloseFileResult = {
  closedActiveFile: boolean;
  nextActiveFile?: MarkdownFile;
};

type UseWorkspaceFileActionsArgs = {
  activeFile?: MarkdownFile;
  activeFileId: string;
  addFileFromContent: (
    title: string,
    text: string,
    viewMode?: MarkdownFile["viewMode"],
    overrides?: Partial<MarkdownFile>,
  ) => MarkdownFile;
  addMarkdownFile: (overrides?: Partial<MarkdownFile>) => MarkdownFile;
  closeFloatingChrome: () => void;
  closeMarkdownFile: (fileId: string) => CloseFileResult | undefined;
  commentsByFileId: Record<string, FileComment[]>;
  deleteMarkdownFile: (fileId: string) => DeleteFileResult | undefined;
  duplicateMarkdownFile: (fileId: string) => MarkdownFile | undefined;
  files: MarkdownFile[];
  helpMarkdown: string;
  historyByFileId: Record<string, FileHistory>;
  openFileIds: string[];
  preferences: WorkspacePreferences;
  queueEditorFocus: () => void;
  renameFile: (fileId: string, nextRawTitle: string) => RenameFileResult;
  replaceCommentsByFileId: (commentsByFileId: Record<string, FileComment[]>) => void;
  resetCollaborationState: (nextStatus: MarkdownFile["connectionStatus"]) => void;
  restoreFile: (input: {
    file: MarkdownFile;
    fileIndex: number;
    previousOpenFileIds: string[];
    activate: boolean;
  }) => MarkdownFile;
  selectAdjacentMarkdownFile: (direction: -1 | 1) => MarkdownFile | undefined;
  selectMarkdownFile: (fileId: string) => MarkdownFile | undefined;
  setHistoryByFileId: Dispatch<SetStateAction<Record<string, FileHistory>>>;
  showToast: ShowToast;
  upsertHelpFile: (helpMarkdown: string) => MarkdownFile;
};

export function removeRecordKey<TValue>(record: Record<string, TValue>, key: string) {
  if (!(key in record)) {
    return record;
  }

  const { [key]: _removed, ...nextRecord } = record;
  return nextRecord;
}

export function restoreFileToList(files: MarkdownFile[], restoredFile: MarkdownFile, restoredIndex: number) {
  if (files.some((file) => file.id === restoredFile.id)) {
    return files;
  }

  const nextFiles = [...files];
  nextFiles.splice(Math.min(restoredIndex, nextFiles.length), 0, restoredFile);
  return nextFiles;
}

export function restoreOpenFileId(
  openFileIds: string[],
  restoredFileId: string,
  previousOpenFileIds: string[],
) {
  if (!previousOpenFileIds.includes(restoredFileId) || openFileIds.includes(restoredFileId)) {
    return openFileIds;
  }

  const previousOpenIndex = previousOpenFileIds.indexOf(restoredFileId);
  const nextOpenFileIds = [...openFileIds];
  nextOpenFileIds.splice(Math.min(previousOpenIndex, nextOpenFileIds.length), 0, restoredFileId);
  return nextOpenFileIds;
}

export function useWorkspaceFileActions({
  activeFile,
  activeFileId,
  addFileFromContent,
  addMarkdownFile,
  closeFloatingChrome,
  closeMarkdownFile,
  commentsByFileId,
  deleteMarkdownFile,
  duplicateMarkdownFile,
  files,
  helpMarkdown,
  historyByFileId,
  openFileIds,
  preferences,
  queueEditorFocus,
  renameFile,
  replaceCommentsByFileId,
  resetCollaborationState,
  restoreFile,
  selectAdjacentMarkdownFile,
  selectMarkdownFile,
  setHistoryByFileId,
  showToast,
  upsertHelpFile,
}: UseWorkspaceFileActionsArgs) {
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
    const nextFile = addMarkdownFile(getNewFilePreferenceOverrides(preferences));
    closeFloatingChrome();
    syncUrlForFile(nextFile);
  };

  const openHelpFile = () => {
    const nextFile = upsertHelpFile(helpMarkdown);
    closeFloatingChrome();
    syncUrlForFile(nextFile);
  };

  const openAboutFile = () => {
    const getNormalizedTitle = (file: MarkdownFile) => file.title.trim().toLowerCase().replace(/\.md$/, "");
    const readmeFile =
      files.find((file) => file.id === README_FILE_ID) ??
      files.find((file) => getNormalizedTitle(file) === "readme");
    const nextFile =
      readmeFile ??
      addFileFromContent("README.md", STARTER_README_MARKDOWN, "preview", {
        id: README_FILE_ID,
        lineNumbers: true,
        lineWrapping: true,
        readingWidth: "wide",
      });

    selectMarkdownFile(nextFile.id);
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

    setHistoryByFileId((currentHistory) => removeRecordKey(currentHistory, fileId));
    if (commentsByFileId[fileId]) {
      replaceCommentsByFileId(removeRecordKey(commentsByFileId, fileId));
    }

    if (result.closedActiveFile) {
      closeFloatingChrome();

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
        const shouldActivateRestoredFile = previousActiveFileId === deletedFile.id;
        restoreFile({
          file: deletedFile,
          fileIndex: deletedFileIndex,
          previousOpenFileIds,
          activate: shouldActivateRestoredFile,
        });
        if (shouldActivateRestoredFile) {
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

  return {
    selectFile,
    addFile,
    openAboutFile,
    openHelpFile,
    renameMarkdownFile,
    duplicateFile,
    deleteFile,
    closeFile,
    selectAdjacentFile,
  };
}
