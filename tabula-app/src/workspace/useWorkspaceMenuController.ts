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
import type { WorkspaceContextSummaryViewModel } from "./workspaceContextSummary";

type UseWorkspaceMenuControllerOptions = {
  importInputRef: RefObject<HTMLInputElement | null>;
  workspaceImportInputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  canUseLocalWorkspaceActions: boolean;
  canClearBrowserWorkspace: boolean;
  canExportWorkspace: boolean;
  onClearWorkspace: () => void | Promise<void>;
  onExportWorkspace: () => void;
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
  preferences: WorkspacePreferences;
  preferencesOpen: boolean;
  setPreferences: Dispatch<SetStateAction<WorkspacePreferences>>;
  setPreferencesOpen: Dispatch<SetStateAction<boolean>>;
  setTopPopover: (popover: TopPopover) => void;
  workspaceContextSummary: WorkspaceContextSummaryViewModel;
};

export function useWorkspaceMenuController({
  importInputRef,
  workspaceImportInputRef,
  isOpen,
  canUseLocalWorkspaceActions,
  canClearBrowserWorkspace,
  canExportWorkspace,
  onClearWorkspace,
  onExportWorkspace,
  onCloseChrome,
  onImportFileChange,
  onImportWorkspaceChange,
  onOpenLiveWorkspace,
  onSaveLiveWorkspace,
  onReviewLiveFolderConflict,
  onDisconnectLiveWorkspace,
  liveFolderAutoSave,
  onToggleLiveFolderAutoSave,
  collaborationActive,
  onRetryCollaboration,
  preferences,
  preferencesOpen,
  setPreferences,
  setPreferencesOpen,
  setTopPopover,
  workspaceContextSummary,
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
      canUseLocalWorkspaceActions,
      canClearBrowserWorkspace,
      canExportWorkspace,
      onImportFileChange,
      onImportWorkspaceChange,
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
      onCloseChrome,
      onTogglePreferences: togglePreferences,
      onChangeTheme: setTheme,
      onChangeLanguage: setLanguage,
      workspaceContextSummary,
    }),
    [
      importInputRef,
      workspaceImportInputRef,
      isOpen,
      canUseLocalWorkspaceActions,
      canClearBrowserWorkspace,
      canExportWorkspace,
      onClearWorkspace,
      onExportWorkspace,
      onCloseChrome,
      onImportFileChange,
      onImportWorkspaceChange,
      onOpenLiveWorkspace,
      onSaveLiveWorkspace,
      onReviewLiveFolderConflict,
      onDisconnectLiveWorkspace,
      liveFolderAutoSave,
      onToggleLiveFolderAutoSave,
      collaborationActive,
      onRetryCollaboration,
      preferences.language,
      preferences.theme,
      preferencesOpen,
      setLanguage,
      setTheme,
      togglePreferences,
      workspaceContextSummary,
    ],
  );

  return {
    menuSurfaceProps,
  };
}
