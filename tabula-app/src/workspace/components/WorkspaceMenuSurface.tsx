import { useState, type ChangeEventHandler, type RefObject } from "react";
import { ModalSurface } from "../../ui/ModalSurface";
import { WorkspaceMenu } from "./WorkspaceMenu";
import type {
  WorkspaceLanguage,
  WorkspaceTheme,
} from "../state/useWorkspacePreferences";
import { getWorkspaceMenuCopy } from "../workspaceLocale";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
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
  canExportFile: boolean;
  canExportWorkspace: boolean;
  onAddFile: () => void;
  onChangeLanguage: (language: WorkspaceLanguage) => void;
  onChangeTheme: (theme: WorkspaceTheme) => void;
  onCloseChrome: () => void;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onImportWorkspaceChange: ChangeEventHandler<HTMLInputElement>;
  onOpenLiveWorkspace?: () => void;
  onSaveLiveWorkspace?: () => void;
  onDisconnectLiveWorkspace?: () => void;
  liveFolderAutoSave?: boolean;
  onToggleLiveFolderAutoSave?: () => void;
  contextSummary: WorkspaceContextSummaryViewModel;
  onClearWorkspace: () => void;
  onExportFile: () => void;
  onExportWorkspace: () => void;
  onOpenAbout: () => void;
  onOpenHelp: () => void;
  onTogglePreferences: () => void;
};

export function WorkspaceMenuSurface({
  importInputRef,
  workspaceImportInputRef,
  isOpen,
  language,
  preferencesOpen,
  theme,
  canUseLocalWorkspaceActions,
  canClearBrowserWorkspace,
  canExportFile,
  canExportWorkspace,
  onAddFile,
  onChangeLanguage,
  onChangeTheme,
  onCloseChrome,
  onImportFileChange,
  onImportWorkspaceChange,
  onOpenLiveWorkspace,
  onSaveLiveWorkspace,
  onDisconnectLiveWorkspace,
  liveFolderAutoSave,
  onToggleLiveFolderAutoSave,
  contextSummary,
  onClearWorkspace,
  onExportFile,
  onExportWorkspace,
  onOpenAbout,
  onOpenHelp,
  onTogglePreferences,
}: WorkspaceMenuSurfaceProps) {
  const copy = getWorkspaceMenuCopy(language);
  const interfaceCopy = getWorkspaceInterfaceCopy(language);
  const [confirmation, setConfirmation] = useState<"clear" | "disconnect" | null>(null);
  const closeConfirmation = () => setConfirmation(null);
  const confirmClearWorkspace = () => {
    onClearWorkspace();
    closeConfirmation();
  };
  const confirmDisconnectFolder = () => {
    onDisconnectLiveWorkspace?.();
    closeConfirmation();
  };
  return (
    <>
      <input
        ref={importInputRef}
        className="ui-input-surface workspace-file-input"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={onImportFileChange}
        aria-label={interfaceCopy.sidePanel.files.openMarkdown}
      />
      <input
        ref={workspaceImportInputRef}
        className="ui-input-surface workspace-file-input"
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={onImportWorkspaceChange}
        aria-label={copy.actions.importWorkspace}
      />
      <WorkspaceMenu
        isOpen={isOpen}
        preferencesOpen={preferencesOpen}
        theme={theme}
        language={language}
        onTogglePreferences={onTogglePreferences}
        onChangeTheme={onChangeTheme}
        onChangeLanguage={onChangeLanguage}
        onAddFile={onAddFile}
        onImportFile={() => {
          onCloseChrome();
          importInputRef.current?.click();
        }}
        onImportWorkspace={canUseLocalWorkspaceActions ? () => {
          onCloseChrome();
          workspaceImportInputRef.current?.click();
        } : undefined}
        onOpenLiveWorkspace={canUseLocalWorkspaceActions
          ? onOpenLiveWorkspace
          : undefined}
        onSaveLiveWorkspace={canUseLocalWorkspaceActions
          ? onSaveLiveWorkspace
          : undefined}
        onDisconnectLiveWorkspace={onDisconnectLiveWorkspace
          ? () => {
              onCloseChrome();
              setConfirmation("disconnect");
            }
          : undefined}
        liveFolderAutoSave={liveFolderAutoSave}
        onToggleLiveFolderAutoSave={canUseLocalWorkspaceActions
          ? onToggleLiveFolderAutoSave
          : undefined}
        contextSummary={contextSummary}
        canExportFile={canExportFile}
        canExportWorkspace={canExportWorkspace}
        onExportFile={() => {
          onCloseChrome();
          onExportFile();
        }}
        onExportWorkspace={() => {
          onCloseChrome();
          onExportWorkspace();
        }}
        onClearWorkspace={canClearBrowserWorkspace ? () => {
          onCloseChrome();
          setConfirmation("clear");
        } : undefined}
        onOpenAbout={onOpenAbout}
        onOpenHelp={onOpenHelp}
      />
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
