import { useState, type ChangeEventHandler, type RefObject } from "react";
import { ModalSurface } from "../../ui/ModalSurface";
import { WorkspaceMenu } from "./WorkspaceMenu";
import type {
  WorkspaceLanguage,
  WorkspaceTheme,
} from "../state/useWorkspacePreferences";
import { getWorkspaceMenuCopy } from "../workspaceLocale";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";

export type WorkspaceMenuSurfaceProps = {
  importInputRef: RefObject<HTMLInputElement | null>;
  workspaceImportInputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  language: WorkspaceLanguage;
  preferencesOpen: boolean;
  theme: WorkspaceTheme;
  canClearWorkspace: boolean;
  canExportFile: boolean;
  canExportWorkspace: boolean;
  onAddFile: () => void;
  onChangeLanguage: (language: WorkspaceLanguage) => void;
  onChangeTheme: (theme: WorkspaceTheme) => void;
  onCloseChrome: () => void;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onImportWorkspaceChange: ChangeEventHandler<HTMLInputElement>;
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
  canClearWorkspace,
  canExportFile,
  canExportWorkspace,
  onAddFile,
  onChangeLanguage,
  onChangeTheme,
  onCloseChrome,
  onImportFileChange,
  onImportWorkspaceChange,
  onClearWorkspace,
  onExportFile,
  onExportWorkspace,
  onOpenAbout,
  onOpenHelp,
  onTogglePreferences,
}: WorkspaceMenuSurfaceProps) {
  const copy = getWorkspaceMenuCopy(language);
  const interfaceCopy = getWorkspaceInterfaceCopy(language);
  const [clearWorkspaceOpen, setClearWorkspaceOpen] = useState(false);
  const closeClearWorkspace = () => setClearWorkspaceOpen(false);
  const confirmClearWorkspace = () => {
    onClearWorkspace();
    closeClearWorkspace();
  };
  return (
    <>
      <input
        ref={importInputRef}
        className="workspace-file-input"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={onImportFileChange}
        aria-label={interfaceCopy.sidePanel.files.openMarkdown}
      />
      <input
        ref={workspaceImportInputRef}
        className="workspace-file-input"
        type="file"
        accept=".md,text/markdown"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={onImportWorkspaceChange}
        aria-label={copy.emptyState.openWorkspace}
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
        onImportWorkspace={canClearWorkspace ? () => {
          onCloseChrome();
          workspaceImportInputRef.current?.click();
        } : undefined}
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
        onClearWorkspace={canClearWorkspace ? () => {
          onCloseChrome();
          setClearWorkspaceOpen(true);
        } : undefined}
        onOpenAbout={onOpenAbout}
        onOpenHelp={onOpenHelp}
      />
      {clearWorkspaceOpen && canClearWorkspace && (
        <ModalSurface
          ariaLabelledBy="clear-workspace-title"
          className="clear-workspace-modal"
          onClose={closeClearWorkspace}
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
              onClick={closeClearWorkspace}
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
