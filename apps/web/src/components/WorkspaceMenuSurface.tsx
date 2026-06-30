import type { ChangeEventHandler, RefObject } from "react";
import { WorkspaceMenu } from "./WorkspaceMenu";
import type {
  WorkspaceLanguage,
  WorkspaceTheme,
} from "../hooks/useWorkspacePreferences";

export type WorkspaceMenuSurfaceProps = {
  canExportCurrentFile: boolean;
  importInputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  language: WorkspaceLanguage;
  preferencesOpen: boolean;
  theme: WorkspaceTheme;
  workspaceImportInputRef: RefObject<HTMLInputElement | null>;
  onAddFile: () => void;
  onChangeLanguage: (language: WorkspaceLanguage) => void;
  onChangeTheme: (theme: WorkspaceTheme) => void;
  onCloseChrome: () => void;
  onDownloadFile: () => void;
  onDownloadProject: () => void;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onImportProjectChange: ChangeEventHandler<HTMLInputElement>;
  onOpenAbout: () => void;
  onOpenCollaboration: () => void;
  onOpenHelp: () => void;
  onTogglePreferences: () => void;
};

export function WorkspaceMenuSurface({
  canExportCurrentFile,
  importInputRef,
  isOpen,
  language,
  preferencesOpen,
  theme,
  workspaceImportInputRef,
  onAddFile,
  onChangeLanguage,
  onChangeTheme,
  onCloseChrome,
  onDownloadFile,
  onDownloadProject,
  onImportFileChange,
  onImportProjectChange,
  onOpenAbout,
  onOpenCollaboration,
  onOpenHelp,
  onTogglePreferences,
}: WorkspaceMenuSurfaceProps) {
  return (
    <>
      <input
        ref={importInputRef}
        className="workspace-file-input"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={onImportFileChange}
        aria-label="Import file"
      />
      <input
        ref={workspaceImportInputRef}
        className="workspace-file-input"
        type="file"
        accept=".json,application/json"
        onChange={onImportProjectChange}
        aria-label="Import project file"
      />
      <WorkspaceMenu
        isOpen={isOpen}
        preferencesOpen={preferencesOpen}
        canExportCurrentFile={canExportCurrentFile}
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
        onImportProject={() => {
          onCloseChrome();
          workspaceImportInputRef.current?.click();
        }}
        onDownloadFile={() => {
          onDownloadFile();
          onCloseChrome();
        }}
        onDownloadProject={() => {
          onDownloadProject();
          onCloseChrome();
        }}
        onOpenCollaboration={onOpenCollaboration}
        onOpenAbout={onOpenAbout}
        onOpenHelp={onOpenHelp}
      />
    </>
  );
}
