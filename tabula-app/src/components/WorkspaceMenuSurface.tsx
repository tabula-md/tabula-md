import { useState, type ChangeEventHandler, type RefObject } from "react";
import { ModalSurface } from "./ui/ModalSurface";
import { WorkspaceMenu } from "./WorkspaceMenu";
import type {
  WorkspaceLanguage,
  WorkspaceTheme,
} from "../hooks/useWorkspacePreferences";
import { getWorkspaceMenuCopy } from "../workspaceLocale";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";

export type WorkspaceMenuSurfaceProps = {
  importInputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  language: WorkspaceLanguage;
  preferencesOpen: boolean;
  theme: WorkspaceTheme;
  canClearWorkspace: boolean;
  onAddFile: () => void;
  onChangeLanguage: (language: WorkspaceLanguage) => void;
  onChangeTheme: (theme: WorkspaceTheme) => void;
  onCloseChrome: () => void;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onClearWorkspace: () => void;
  onOpenAbout: () => void;
  onOpenHelp: () => void;
  onTogglePreferences: () => void;
};

export function WorkspaceMenuSurface({
  importInputRef,
  isOpen,
  language,
  preferencesOpen,
  theme,
  canClearWorkspace,
  onAddFile,
  onChangeLanguage,
  onChangeTheme,
  onCloseChrome,
  onImportFileChange,
  onClearWorkspace,
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
        aria-label={interfaceCopy.projectContext.files.openMarkdown}
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
        onOpenFile={() => {
          onCloseChrome();
          importInputRef.current?.click();
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
