import type { ChangeEventHandler, RefObject } from "react";
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
  workspaceImportInputRef: RefObject<HTMLInputElement | null>;
  onAddFile: () => void;
  onChangeLanguage: (language: WorkspaceLanguage) => void;
  onChangeTheme: (theme: WorkspaceTheme) => void;
  onCloseChrome: () => void;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onImportProjectChange: ChangeEventHandler<HTMLInputElement>;
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
  workspaceImportInputRef,
  onAddFile,
  onChangeLanguage,
  onChangeTheme,
  onCloseChrome,
  onImportFileChange,
  onImportProjectChange,
  onOpenAbout,
  onOpenHelp,
  onTogglePreferences,
}: WorkspaceMenuSurfaceProps) {
  const copy = getWorkspaceMenuCopy(language);
  const interfaceCopy = getWorkspaceInterfaceCopy(language);
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
      <input
        ref={workspaceImportInputRef}
        className="workspace-file-input"
        type="file"
        accept=".json,application/json"
        onChange={onImportProjectChange}
        aria-label={copy.actions.importProject}
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
        onImportProject={() => {
          onCloseChrome();
          workspaceImportInputRef.current?.click();
        }}
        onOpenAbout={onOpenAbout}
        onOpenHelp={onOpenHelp}
      />
    </>
  );
}
