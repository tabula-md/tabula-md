import type { RefObject } from "react";
import type { ConnectionStatus } from "../collaboration/liveCollaboration";
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

type UseWorkspaceIoControllerOptions = {
  activeFile?: WorkspaceFile;
  isRoomSession: boolean;
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
    nextStatus: ConnectionStatus,
  ) => void;
  showToast: (
    message: string,
    tone?: "neutral" | "error",
    options?: { actionLabel?: string; onAction?: () => void },
  ) => void;
  workspaceSource: InitialWorkspaceSnapshot["source"];
};

export function useWorkspaceIoController({
  activeFile,
  isRoomSession,
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
}: UseWorkspaceIoControllerOptions) {
  const projectIo = useProjectIoController({
    activeFile,
    isRoomSession,
    activeFileId,
    addFileFromContent,
    clearFileHistory,
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
    showToast,
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
