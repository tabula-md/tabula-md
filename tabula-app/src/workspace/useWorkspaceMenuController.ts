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
  canClearWorkspace: boolean;
  canExportWorkspace: boolean;
  onClearWorkspace: () => void;
  onExportWorkspace: () => void;
  workspaceName: string;
  onRenameWorkspace: (nextTitle: string) => boolean;
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
  canClearWorkspace,
  canExportWorkspace,
  onClearWorkspace,
  onExportWorkspace,
  workspaceName,
  onRenameWorkspace,
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
      canExportWorkspace,
      workspaceName,
      onImportFileChange,
      onImportWorkspaceChange,
      onClearWorkspace,
      onExportWorkspace,
      onRenameWorkspace,
      onCloseChrome,
      onTogglePreferences: togglePreferences,
      onChangeTheme: setTheme,
      onChangeLanguage: setLanguage,
      onOpenAbout,
      onOpenHelp,
    }),
    [
      importInputRef,
      workspaceImportInputRef,
      isOpen,
      canClearWorkspace,
      canExportWorkspace,
      onClearWorkspace,
      onExportWorkspace,
      workspaceName,
      onRenameWorkspace,
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
