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
  roomFile?: WorkspaceFile;
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
  folders: import("../workspaceStorage").WorkspaceFolder[];
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  getWorkspaceSnapshot?: () => WorkspaceState;
  openFileIds: string[];
  onBeforeWorkspaceBoundary?: () => void;
  preferences: WorkspacePreferences;
  replaceCommentsByFileId: (
    commentsByFileId: Record<string, FileComment[]>,
  ) => void;
  replaceWorkspace: (
    workspace: Pick<WorkspaceState, "files" | "folders" | "openFileIds" | "activeFileId">,
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
  roomFile,
  activeFileId,
  addFileFromContent,
  clearFileHistory,
  closeFloatingChrome,
  commentsByFileId,
  editorRef,
  files,
  folders,
  getActiveFileSnapshot,
  getWorkspaceSnapshot,
  openFileIds,
  onBeforeWorkspaceBoundary,
  preferences,
  replaceCommentsByFileId,
  replaceWorkspace,
  resetCollaborationState,
  showToast,
  workspaceSource,
}: UseWorkspaceIoRuntimeOptions) {
  const projectIo = useProjectIoController({
    activeFile,
    roomFile,
    activeFileId,
    addFileFromContent,
    commentsByFileId,
    editorRef,
    files,
    folders,
    getActiveFileSnapshot,
    getWorkspaceSnapshot,
    openFileIds,
    onBeforeWorkspaceBoundary,
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
    getWorkspaceSnapshot,
    onBeforeWorkspaceBoundary,
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
