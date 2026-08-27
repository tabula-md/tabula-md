import { useState, type ChangeEventHandler, type RefObject } from "react";
import { ModalSurface } from "../../ui/ModalSurface";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { WorkspacePreferencesDialog } from "./WorkspacePreferencesDialog";
import type {
  WorkspaceLanguage,
  WorkspaceTheme,
} from "../state/useWorkspacePreferences";
import { getWorkspaceMenuCopy } from "../workspaceLocale";
import type { WorkspaceContextSummaryViewModel } from "../workspaceContextSummary";

export type WorkspaceMenuSurfaceProps = {
  importInputRef: RefObject<HTMLInputElement | null>;
  workspaceImportInputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  language: WorkspaceLanguage;
  preferencesOpen: boolean;
  theme: WorkspaceTheme;
  canUseLocalWorkspaceActions: boolean;
  canClearBrowserWorkspace: boolean;
  canExportWorkspace: boolean;
  onChangeLanguage: (language: WorkspaceLanguage) => void;
  onChangeTheme: (theme: WorkspaceTheme) => void;
  onCloseChrome: () => void;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onImportWorkspaceChange: ChangeEventHandler<HTMLInputElement>;
  onOpenLiveWorkspace?: () => void;
  onSaveLiveWorkspace?: () => void;
  onReviewLiveFolderConflict?: () => void;
  onDisconnectLiveWorkspace?: () => void;
  liveFolderAutoSave?: boolean;
  onToggleLiveFolderAutoSave?: () => void;
  collaborationActive?: boolean;
  onRetryCollaboration?: () => void;
  onClearWorkspace: () => void | Promise<void>;
  onExportWorkspace: () => void;
  onTogglePreferences: () => void;
  workspaceContextSummary: WorkspaceContextSummaryViewModel;
};

export function WorkspaceMenuSurface({
  workspaceImportInputRef,
  isOpen,
  language,
  preferencesOpen,
  theme,
  canUseLocalWorkspaceActions,
  canClearBrowserWorkspace,
  canExportWorkspace,
  onChangeLanguage,
  onChangeTheme,
  onCloseChrome,
  onOpenLiveWorkspace,
  onSaveLiveWorkspace,
  onReviewLiveFolderConflict,
  onDisconnectLiveWorkspace,
  liveFolderAutoSave,
  onToggleLiveFolderAutoSave,
  collaborationActive,
  onRetryCollaboration,
  onClearWorkspace,
  onExportWorkspace,
  onTogglePreferences,
  workspaceContextSummary,
}: WorkspaceMenuSurfaceProps) {
  const copy = getWorkspaceMenuCopy(language);
  const [confirmation, setConfirmation] = useState<"clear" | "disconnect" | null>(null);
  const [clearPending, setClearPending] = useState(false);
  const closeConfirmation = () => setConfirmation(null);
  const confirmClearWorkspace = async () => {
    setClearPending(true);
    try {
      await onClearWorkspace();
      closeConfirmation();
    } finally {
      setClearPending(false);
    }
  };
  const confirmDisconnectFolder = () => {
    onDisconnectLiveWorkspace?.();
    closeConfirmation();
  };

  return (
    <>
      <WorkspaceMenu
        isOpen={isOpen}
        language={language}
        onImportWorkspace={canUseLocalWorkspaceActions ? () => {
          onCloseChrome();
          workspaceImportInputRef.current?.click();
        } : undefined}
        onOpenLiveWorkspace={canUseLocalWorkspaceActions && onOpenLiveWorkspace
          ? () => {
              onCloseChrome();
              onOpenLiveWorkspace();
            }
          : undefined}
        onSaveLiveWorkspace={canUseLocalWorkspaceActions && onSaveLiveWorkspace
          ? () => {
              onCloseChrome();
              onSaveLiveWorkspace();
            }
          : undefined}
        onReviewLiveFolderConflict={canUseLocalWorkspaceActions && onReviewLiveFolderConflict
          ? () => {
              onCloseChrome();
              onReviewLiveFolderConflict();
            }
          : undefined}
        collaborationActive={collaborationActive}
        onRetryCollaboration={onRetryCollaboration ? () => {
          onCloseChrome();
          onRetryCollaboration();
        } : undefined}
        onDisconnectLiveWorkspace={canUseLocalWorkspaceActions && onDisconnectLiveWorkspace
          ? () => {
              onCloseChrome();
              setConfirmation("disconnect");
            }
          : undefined}
        liveFolderAutoSave={liveFolderAutoSave}
        onToggleLiveFolderAutoSave={canUseLocalWorkspaceActions
          ? onToggleLiveFolderAutoSave
          : undefined}
        onExportWorkspace={canExportWorkspace ? () => {
          onCloseChrome();
          onExportWorkspace();
        } : undefined}
        onClearWorkspace={canClearBrowserWorkspace ? () => {
          onCloseChrome();
          setConfirmation("clear");
        } : undefined}
        workspaceContextSummary={workspaceContextSummary}
      />

      {preferencesOpen && (
        <WorkspacePreferencesDialog
          language={language}
          theme={theme}
          onChangeLanguage={onChangeLanguage}
          onChangeTheme={onChangeTheme}
          onClose={onTogglePreferences}
        />
      )}

      {confirmation === "disconnect" && onDisconnectLiveWorkspace && (
        <ModalSurface
          ariaLabelledBy="disconnect-folder-title"
          className="clear-workspace-modal"
          onClose={closeConfirmation}
        >
          <header className="share-modal-header compact">
            <h2 id="disconnect-folder-title">{copy.disconnectFolder.title}</h2>
            <p>{copy.disconnectFolder.description}</p>
          </header>
          <div className="share-modal-actions clear-workspace-actions">
            <button
              type="button"
              className="share-modal-secondary"
              data-modal-initial-focus
              disabled={clearPending}
              onClick={closeConfirmation}
            >
              {copy.disconnectFolder.cancel}
            </button>
            <button
              type="button"
              className="share-modal-primary"
              onClick={confirmDisconnectFolder}
            >
              {copy.disconnectFolder.confirm}
            </button>
          </div>
        </ModalSurface>
      )}
      {confirmation === "clear" && canClearBrowserWorkspace && (
        <ModalSurface
          ariaLabelledBy="clear-workspace-title"
          className="clear-workspace-modal"
          onClose={closeConfirmation}
        >
          <header className="share-modal-header compact">
            <h2 id="clear-workspace-title">{copy.clearWorkspace.title}</h2>
            <p>{copy.clearWorkspace.description}</p>
          </header>
          <div className="share-modal-actions clear-workspace-actions">
            <button
              type="button"
              className="share-modal-secondary"
              data-modal-initial-focus
              onClick={closeConfirmation}
            >
              {copy.clearWorkspace.cancel}
            </button>
            <button
              type="button"
              className="share-modal-danger"
              disabled={clearPending}
              onClick={confirmClearWorkspace}
            >
              {copy.clearWorkspace.confirm}
            </button>
          </div>
        </ModalSurface>
      )}
    </>
  );
}
