import {
  useCallback,
  useMemo,
  type ChangeEventHandler,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { WorkspaceMenuSurfaceProps } from "../components/WorkspaceMenuSurface";
import type { TopPopover } from "../uiTypes";
import type { WorkspaceFile } from "../workspaceStorage";
import type {
  WorkspaceLanguage,
  WorkspacePreferences,
  WorkspaceTheme,
} from "./useWorkspacePreferences";

type UseWorkspaceMenuRuntimeOptions = {
  activeFile?: WorkspaceFile;
  importInputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  onAddFile: () => void;
  onCloseChrome: () => void;
  onDownloadFile: () => void;
  onDownloadProject: () => void;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onImportProjectChange: ChangeEventHandler<HTMLInputElement>;
  onOpenAbout: () => void;
  onOpenHelp: () => void;
  openSharePanel: () => void;
  preferences: WorkspacePreferences;
  preferencesOpen: boolean;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
  setPreferencesOpen: Dispatch<SetStateAction<boolean>>;
  setTopPopover: (popover: TopPopover) => void;
  workspaceImportInputRef: RefObject<HTMLInputElement | null>;
};

export function useWorkspaceMenuRuntime({
  activeFile,
  importInputRef,
  isOpen,
  onAddFile,
  onCloseChrome,
  onDownloadFile,
  onDownloadProject,
  onImportFileChange,
  onImportProjectChange,
  onOpenAbout,
  onOpenHelp,
  openSharePanel,
  preferences,
  preferencesOpen,
  setPreferences,
  setPreferencesOpen,
  setTopPopover,
  workspaceImportInputRef,
}: UseWorkspaceMenuRuntimeOptions) {
  const setTheme = useCallback((theme: WorkspaceTheme) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      theme,
    }));
  }, [setPreferences]);

  const setLanguage = useCallback((language: WorkspaceLanguage) => {
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      language,
    }));
  }, [setPreferences]);

  const togglePreferences = useCallback(() => {
    setPreferencesOpen((currentOpen) => !currentOpen);
    setTopPopover(null);
  }, [setPreferencesOpen, setTopPopover]);

  const openCollaboration = useCallback(() => {
    openSharePanel();
  }, [openSharePanel]);

  const menuSurfaceProps: WorkspaceMenuSurfaceProps = useMemo(
    () => ({
      isOpen,
      preferencesOpen,
      canExportCurrentFile: Boolean(activeFile),
      theme: preferences.theme,
      language: preferences.language,
      importInputRef,
      workspaceImportInputRef,
      onImportFileChange,
      onImportProjectChange,
      onCloseChrome,
      onTogglePreferences: togglePreferences,
      onChangeTheme: setTheme,
      onChangeLanguage: setLanguage,
      onAddFile,
      onDownloadFile,
      onDownloadProject,
      onOpenCollaboration: openCollaboration,
      onOpenAbout,
      onOpenHelp,
    }),
    [
      activeFile,
      importInputRef,
      isOpen,
      onAddFile,
      onCloseChrome,
      onDownloadFile,
      onDownloadProject,
      onImportFileChange,
      onImportProjectChange,
      onOpenAbout,
      onOpenHelp,
      openCollaboration,
      preferences.language,
      preferences.theme,
      preferencesOpen,
      setLanguage,
      setTheme,
      togglePreferences,
      workspaceImportInputRef,
    ],
  );

  return {
    menuSurfaceProps,
  };
}
