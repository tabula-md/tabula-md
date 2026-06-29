import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { FileViewMode, ReadingWidth } from "../workspaceStorage";

export const WORKSPACE_PREFERENCES_KEY = "tabula.preferences.v1";

export type WorkspaceTheme = "light" | "dark";
export type WorkspaceLanguage = "en" | "ko";

export type WorkspacePreferences = {
  theme: WorkspaceTheme;
  language: WorkspaceLanguage;
  newFileViewMode: FileViewMode;
  readingWidth: ReadingWidth;
  lineWrapping: boolean;
  lineNumbers: boolean;
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  theme: "light",
  language: "en",
  newFileViewMode: "edit",
  readingWidth: "wide",
  lineWrapping: true,
  lineNumbers: true,
};

const isWorkspaceTheme = (value: unknown): value is WorkspaceTheme => value === "light" || value === "dark";

const isWorkspaceLanguage = (value: unknown): value is WorkspaceLanguage => value === "en" || value === "ko";

const isFileViewMode = (value: unknown): value is FileViewMode =>
  value === "edit" || value === "split" || value === "preview";

const isReadingWidth = (value: unknown): value is ReadingWidth =>
  value === "narrow" || value === "standard" || value === "wide";

export const parseWorkspacePreferences = (value: unknown): WorkspacePreferences => {
  const partialPreferences =
    value && typeof value === "object" ? (value as Partial<WorkspacePreferences>) : {};

  return {
    theme: isWorkspaceTheme(partialPreferences.theme)
      ? partialPreferences.theme
      : DEFAULT_WORKSPACE_PREFERENCES.theme,
    language: isWorkspaceLanguage(partialPreferences.language)
      ? partialPreferences.language
      : DEFAULT_WORKSPACE_PREFERENCES.language,
    newFileViewMode: isFileViewMode(partialPreferences.newFileViewMode)
      ? partialPreferences.newFileViewMode
      : DEFAULT_WORKSPACE_PREFERENCES.newFileViewMode,
    readingWidth: isReadingWidth(partialPreferences.readingWidth)
      ? partialPreferences.readingWidth
      : DEFAULT_WORKSPACE_PREFERENCES.readingWidth,
    lineWrapping:
      typeof partialPreferences.lineWrapping === "boolean"
        ? partialPreferences.lineWrapping
        : DEFAULT_WORKSPACE_PREFERENCES.lineWrapping,
    lineNumbers:
      typeof partialPreferences.lineNumbers === "boolean"
        ? partialPreferences.lineNumbers
        : DEFAULT_WORKSPACE_PREFERENCES.lineNumbers,
  };
};

export const readWorkspacePreferences = (storage: Storage = window.localStorage): WorkspacePreferences => {
  try {
    return parseWorkspacePreferences(JSON.parse(storage.getItem(WORKSPACE_PREFERENCES_KEY) ?? "{}"));
  } catch {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }
};

export const writeWorkspacePreferences = (
  preferences: WorkspacePreferences,
  storage: Storage = window.localStorage,
) => {
  storage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(preferences));
};

export function useWorkspacePreferences(): [
  WorkspacePreferences,
  Dispatch<SetStateAction<WorkspacePreferences>>,
] {
  const [workspacePreferences, setWorkspacePreferences] = useState<WorkspacePreferences>(() =>
    readWorkspacePreferences(),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = workspacePreferences.theme;
    document.documentElement.lang = workspacePreferences.language;
    document.documentElement.style.colorScheme = workspacePreferences.theme;
  }, [workspacePreferences.language, workspacePreferences.theme]);

  useEffect(() => {
    try {
      writeWorkspacePreferences(workspacePreferences);
    } catch {
      // Preferences are a local convenience, not required for document editing.
    }
  }, [workspacePreferences]);

  return [workspacePreferences, setWorkspacePreferences];
}
