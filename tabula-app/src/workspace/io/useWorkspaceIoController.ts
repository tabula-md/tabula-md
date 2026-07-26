import type { RefObject } from "react";
import type { ConnectionStatus } from "../../collaboration/liveCollaboration";
import type { MarkdownEditorHandle } from "../../document/markdownEditorTypes";
import type {
  FileComment,
  InitialWorkspaceSnapshot,
  WorkspaceFile,
  WorkspaceState,
} from "../workspaceStorage";
import { useJsonShareImportController } from "../../share/useJsonShareImportController";
import { useWorkspaceFileIoController } from "./useWorkspaceFileIoController";
import type { WorkspacePreferences } from "../state/useWorkspacePreferences";
import type { WorkspaceKnowledgeBaseline } from "@tabula-md/tabula";

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
  knowledgeBaseline?: WorkspaceKnowledgeBaseline;
  replaceCommentsByFileId: (
    commentsByFileId: Record<string, FileComment[]>,
  ) => void;
  replaceKnowledgeBaseline: (baseline?: WorkspaceKnowledgeBaseline) => void;
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
  knowledgeBaseline,
  replaceCommentsByFileId,
  replaceKnowledgeBaseline,
  replaceWorkspace,
  resetCollaborationState,
  showToast,
  workspaceSource,
}: UseWorkspaceIoControllerOptions) {
  const workspaceFileIo = useWorkspaceFileIoController({
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
    knowledgeBaseline,
    replaceCommentsByFileId,
    replaceKnowledgeBaseline,
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
    language: preferences.language,
    onBeforeWorkspaceBoundary,
    replaceCommentsByFileId,
    replaceKnowledgeBaseline,
    replaceWorkspace,
    resetCollaborationState,
    showToast,
    workspaceSource,
  });

  return {
    ...workspaceFileIo,
    ...jsonShareImport,
  };
}
