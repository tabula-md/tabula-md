import type {
  ConnectionStatus,
  RoomDurability,
  RoomRecoveryMode,
} from "../collaboration/liveCollaboration";
import type { LiveFolderSaveStatus } from "./io/useWorkspaceFileIoController";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";
import type { WorkspaceState } from "./workspaceStorage";
import { createStarterWorkspaceState, syncUrlForLocalWorkspace } from "./workspaceStorage";
import { useEventCallback } from "../shared/useEventCallback";
import type { useAppToast } from "../ui/useAppToast";
import {
  getWorkspaceBoundaryCapabilities,
  resolveWorkspaceAuthority,
} from "./workspaceBoundaryPolicy";
import { getWorkspaceContextSummary } from "./workspaceContextSummary";

type PersistenceRuntime = {
  persistNow: (workspace: WorkspaceState) => Promise<void>;
  saveState: "saving" | "saved" | "error" | "suspended";
};

type UseWorkspaceBoundaryControllerOptions = {
  activeRoom: boolean;
  browserPersistence: PersistenceRuntime;
  clearFileHistory: () => void;
  closeFloatingChrome: () => void;
  collaboration: {
    connectionStatus: ConnectionStatus;
    durability: RoomDurability;
    recoveryMode: RoomRecoveryMode;
  } | null;
  copy: {
    clearWorkspace: { cleared: string; restored: string; undo: string };
    disconnectFolder: { disconnected: string };
  };
  disconnectFolder: () => void;
  folderBinding: {
    autoSave: boolean;
    label?: string;
    saveStatus: LiveFolderSaveStatus;
  } | null;
  getWorkspaceSnapshot: () => WorkspaceState;
  language: WorkspaceLanguage;
  onBeforeWorkspaceBoundary: () => void;
  replaceCommentsByFileId: (comments: WorkspaceState["commentsByFileId"]) => void;
  replaceKnowledgeBaseline: (baseline: WorkspaceState["knowledgeBaseline"]) => void;
  replaceWorkspace: (workspace: WorkspaceState) => unknown;
  showToast: ReturnType<typeof useAppToast>["showToast"];
};

export function useWorkspaceBoundaryController({
  activeRoom,
  browserPersistence,
  clearFileHistory,
  closeFloatingChrome,
  collaboration,
  copy,
  disconnectFolder,
  folderBinding,
  getWorkspaceSnapshot,
  language,
  onBeforeWorkspaceBoundary,
  replaceCommentsByFileId,
  replaceKnowledgeBaseline,
  replaceWorkspace,
  showToast,
}: UseWorkspaceBoundaryControllerOptions) {
  const authority = resolveWorkspaceAuthority({
    hasActiveRoom: activeRoom,
    hasLiveFolderBinding: Boolean(folderBinding),
  });
  const capabilities = getWorkspaceBoundaryCapabilities(authority);

  const disconnectLocalFolder = useEventCallback(() => {
    if (!capabilities.canUseLocalWorkspaceActions) return;
    disconnectFolder();
    showToast(copy.disconnectFolder.disconnected);
  });

  const clearLocalWorkspace = useEventCallback(async () => {
    if (!capabilities.canClearBrowserWorkspace) return;
    const previousWorkspace = getWorkspaceSnapshot();
    onBeforeWorkspaceBoundary();
    const starterWorkspace = createStarterWorkspaceState();
    await browserPersistence.persistNow(starterWorkspace);
    replaceWorkspace(starterWorkspace);
    replaceCommentsByFileId({});
    replaceKnowledgeBaseline(undefined);
    clearFileHistory();
    closeFloatingChrome();
    syncUrlForLocalWorkspace("replace");
    showToast(copy.clearWorkspace.cleared, "neutral", {
      actionLabel: copy.clearWorkspace.undo,
      onAction: async () => {
        onBeforeWorkspaceBoundary();
        await browserPersistence.persistNow(previousWorkspace);
        replaceWorkspace(previousWorkspace);
        replaceCommentsByFileId(previousWorkspace.commentsByFileId);
        replaceKnowledgeBaseline(previousWorkspace.knowledgeBaseline);
        clearFileHistory();
        closeFloatingChrome();
        syncUrlForLocalWorkspace("replace");
        showToast(copy.clearWorkspace.restored);
      },
    });
  });

  const contextSummary = getWorkspaceContextSummary(language, {
    authority,
    browserPersistence: {
      state: activeRoom ? "suspended" : browserPersistence.saveState,
    },
    folderBinding: folderBinding
      ? {
          label: folderBinding.label,
          writeMode: folderBinding.autoSave ? "automatic" : "manual",
          status: activeRoom ? "suspended" : folderBinding.saveStatus,
        }
      : null,
    collaboration,
  });

  return {
    authority,
    capabilities,
    clearLocalWorkspace,
    contextSummary,
    disconnectLocalFolder,
  };
}
