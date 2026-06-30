import type { RefObject } from "react";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import type {
  FileComment,
  InitialWorkspaceSnapshot,
  WorkspaceFile,
  WorkspaceState,
} from "../workspaceStorage";
import { useJsonShareImportController } from "./useJsonShareImportController";
import { useProjectIoController } from "./useProjectIoController";
import type { WorkspacePreferences } from "./useWorkspacePreferences";

type UseWorkspaceIoRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  addFileFromContent: (
    title: string,
    text: string,
    viewMode?: WorkspaceFile["viewMode"],
    overrides?: Partial<WorkspaceFile>,
  ) => WorkspaceFile;
  clearFileHistory: () => void;
  closeFloatingChrome: () => void;
  commentsByFileId: Record<string, FileComment[]>;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  files: WorkspaceFile[];
  openFileIds: string[];
  preferences: WorkspacePreferences;
  replaceCommentsByFileId: (
    commentsByFileId: Record<string, FileComment[]>,
  ) => void;
  replaceWorkspace: (
    workspace: Pick<WorkspaceState, "files" | "openFileIds" | "activeFileId">,
  ) => WorkspaceFile | undefined;
  resetCollaborationState: (
    nextStatus: WorkspaceFile["connectionStatus"],
  ) => void;
  showToast: (
    message: string,
    tone?: "neutral" | "error",
    options?: { actionLabel?: string; onAction?: () => void },
  ) => void;
  workspaceSource: InitialWorkspaceSnapshot["source"];
};

export function useWorkspaceIoRuntime({
  activeFile,
  activeFileId,
  addFileFromContent,
  clearFileHistory,
  closeFloatingChrome,
  commentsByFileId,
  editorRef,
  files,
  openFileIds,
  preferences,
  replaceCommentsByFileId,
  replaceWorkspace,
  resetCollaborationState,
  showToast,
  workspaceSource,
}: UseWorkspaceIoRuntimeOptions) {
  const projectIo = useProjectIoController({
    activeFile,
    activeFileId,
    addFileFromContent,
    commentsByFileId,
    editorRef,
    files,
    openFileIds,
    preferences,
    replaceCommentsByFileId,
    replaceWorkspace,
    resetCollaborationState,
    showToast,
    clearFileHistory,
    onCloseChrome: closeFloatingChrome,
  });
  const jsonShareImport = useJsonShareImportController({
    clearFileHistory,
    closeFloatingChrome,
    commentsByFileId,
    files,
    replaceCommentsByFileId,
    replaceWorkspace,
    resetCollaborationState,
    showToast,
    workspaceSource,
  });

  return {
    ...projectIo,
    ...jsonShareImport,
  };
}
