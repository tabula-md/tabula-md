import {
  useCallback,
  useMemo,
  type ChangeEventHandler,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { WorkspaceMenuSurfaceProps } from "./components/WorkspaceMenuSurface";
import type { TopPopover } from "../ui/uiTypes";
import type {
  WorkspaceLanguage,
  WorkspacePreferences,
  WorkspaceTheme,
} from "./state/useWorkspacePreferences";

type UseWorkspaceMenuControllerOptions = {
  importInputRef: RefObject<HTMLInputElement | null>;
  workspaceImportInputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  onAddFile: () => void;
  canClearWorkspace: boolean;
  canExportFile: boolean;
  canExportWorkspace: boolean;
  onClearWorkspace: () => void;
  onExportFile: () => void;
  onExportWorkspace: () => void;
  onCloseChrome: () => void;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onImportWorkspaceChange: ChangeEventHandler<HTMLInputElement>;
  onOpenAbout: () => void;
  onOpenHelp: () => void;
  preferences: WorkspacePreferences;
  preferencesOpen: boolean;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
  setPreferencesOpen: Dispatch<SetStateAction<boolean>>;
  setTopPopover: (popover: TopPopover) => void;
};

export function useWorkspaceMenuController({
  importInputRef,
  workspaceImportInputRef,
  isOpen,
  onAddFile,
  canClearWorkspace,
  canExportFile,
  canExportWorkspace,
  onClearWorkspace,
  onExportFile,
  onExportWorkspace,
  onCloseChrome,
  onImportFileChange,
  onImportWorkspaceChange,
  onOpenAbout,
  onOpenHelp,
  preferences,
  preferencesOpen,
  setPreferences,
  setPreferencesOpen,
  setTopPopover,
}: UseWorkspaceMenuControllerOptions) {
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

  const menuSurfaceProps: WorkspaceMenuSurfaceProps = useMemo(
    () => ({
      isOpen,
      preferencesOpen,
      theme: preferences.theme,
      language: preferences.language,
      importInputRef,
      workspaceImportInputRef,
      canClearWorkspace,
      canExportFile,
      canExportWorkspace,
      onImportFileChange,
      onImportWorkspaceChange,
      onClearWorkspace,
      onExportFile,
      onExportWorkspace,
      onCloseChrome,
      onTogglePreferences: togglePreferences,
      onChangeTheme: setTheme,
      onChangeLanguage: setLanguage,
      onAddFile,
      onOpenAbout,
      onOpenHelp,
    }),
    [
      importInputRef,
      workspaceImportInputRef,
      isOpen,
      onAddFile,
      canClearWorkspace,
      canExportFile,
      canExportWorkspace,
      onClearWorkspace,
      onExportFile,
      onExportWorkspace,
      onCloseChrome,
      onImportFileChange,
      onImportWorkspaceChange,
      onOpenAbout,
      onOpenHelp,
      preferences.language,
      preferences.theme,
      preferencesOpen,
      setLanguage,
      setTheme,
      togglePreferences,
    ],
  );

  return {
    menuSurfaceProps,
  };
}
