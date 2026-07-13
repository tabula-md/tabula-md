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
import type {
  WorkspaceLanguage,
  WorkspacePreferences,
  WorkspaceTheme,
} from "./useWorkspacePreferences";

type UseWorkspaceMenuRuntimeOptions = {
  importInputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  onAddFile: () => void;
  canClearWorkspace: boolean;
  onClearWorkspace: () => void;
  onCloseChrome: () => void;
  onImportFileChange: ChangeEventHandler<HTMLInputElement>;
  onOpenAbout: () => void;
  onOpenHelp: () => void;
  preferences: WorkspacePreferences;
  preferencesOpen: boolean;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
  setPreferencesOpen: Dispatch<SetStateAction<boolean>>;
  setTopPopover: (popover: TopPopover) => void;
};

export function useWorkspaceMenuRuntime({
  importInputRef,
  isOpen,
  onAddFile,
  canClearWorkspace,
  onClearWorkspace,
  onCloseChrome,
  onImportFileChange,
  onOpenAbout,
  onOpenHelp,
  preferences,
  preferencesOpen,
  setPreferences,
  setPreferencesOpen,
  setTopPopover,
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

  const menuSurfaceProps: WorkspaceMenuSurfaceProps = useMemo(
    () => ({
      isOpen,
      preferencesOpen,
      theme: preferences.theme,
      language: preferences.language,
      importInputRef,
      canClearWorkspace,
      onImportFileChange,
      onClearWorkspace,
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
      isOpen,
      onAddFile,
      canClearWorkspace,
      onClearWorkspace,
      onCloseChrome,
      onImportFileChange,
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
