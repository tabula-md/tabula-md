import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getBrowserStorage, readBrowserStorage, writeBrowserStorage } from "../browserStorage";
import type { FileViewMode, ReadingWidth } from "../workspaceStorage";

export const WORKSPACE_PREFERENCES_KEY = "tabula.preferences.v1";

export type WorkspaceTheme = "system" | "light" | "dark";
export type ResolvedWorkspaceTheme = Exclude<WorkspaceTheme, "system">;
export type WorkspaceLanguage = "en" | "ko" | "ja" | "zh" | "es" | "fr" | "de";

export const SUPPORTED_WORKSPACE_LANGUAGES: WorkspaceLanguage[] = [
  "en",
  "ko",
  "ja",
  "zh",
  "es",
  "fr",
  "de",
];

export type WorkspacePreferences = {
  theme: WorkspaceTheme;
  language: WorkspaceLanguage;
  newFileViewMode: FileViewMode;
  readingWidth: ReadingWidth;
  lineWrapping: boolean;
  lineNumbers: boolean;
  syncScrolling: boolean;
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  theme: "system",
  language: "en",
  newFileViewMode: "edit",
  readingWidth: "wide",
  lineWrapping: true,
  lineNumbers: true,
  syncScrolling: true,
};

const isWorkspaceTheme = (value: unknown): value is WorkspaceTheme =>
  value === "system" || value === "light" || value === "dark";

const isWorkspaceLanguage = (value: unknown): value is WorkspaceLanguage =>
  typeof value === "string" &&
  SUPPORTED_WORKSPACE_LANGUAGES.includes(value as WorkspaceLanguage);

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
    syncScrolling:
      typeof partialPreferences.syncScrolling === "boolean"
        ? partialPreferences.syncScrolling
        : DEFAULT_WORKSPACE_PREFERENCES.syncScrolling,
  };
};

export const readWorkspacePreferences = (storage?: Pick<Storage, "getItem">): WorkspacePreferences => {
  try {
    const value = readBrowserStorage(
      storage ?? getBrowserStorage("localStorage"),
      WORKSPACE_PREFERENCES_KEY,
    );
    return parseWorkspacePreferences(JSON.parse(value ?? "{}"));
  } catch {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }
};

export const writeWorkspacePreferences = (
  preferences: WorkspacePreferences,
  storage?: Pick<Storage, "setItem">,
) => {
  return writeBrowserStorage(
    storage ?? getBrowserStorage("localStorage"),
    WORKSPACE_PREFERENCES_KEY,
    JSON.stringify(preferences),
  );
};

const getSystemTheme = (): ResolvedWorkspaceTheme => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const resolveWorkspaceTheme = (theme: WorkspaceTheme): ResolvedWorkspaceTheme =>
  theme === "system" ? getSystemTheme() : theme;

const subscribeToSystemTheme = (listener: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return undefined;
  }

  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  colorSchemeQuery.addEventListener("change", listener);
  return () => colorSchemeQuery.removeEventListener("change", listener);
};

export function useWorkspacePreferences(): [
  WorkspacePreferences,
  Dispatch<SetStateAction<WorkspacePreferences>>,
] {
  const [workspacePreferences, setWorkspacePreferences] = useState<WorkspacePreferences>(() =>
    readWorkspacePreferences(),
  );

  useEffect(() => {
    const applyTheme = () => {
      const resolvedTheme = resolveWorkspaceTheme(workspacePreferences.theme);
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themePreference = workspacePreferences.theme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };

    applyTheme();

    if (workspacePreferences.theme !== "system") {
      return undefined;
    }

    return subscribeToSystemTheme(applyTheme);
  }, [workspacePreferences.theme]);

  useEffect(() => {
    document.documentElement.lang = workspacePreferences.language;
  }, [workspacePreferences.language]);

  useEffect(() => {
    writeWorkspacePreferences(workspacePreferences);
  }, [workspacePreferences]);

  return [workspacePreferences, setWorkspacePreferences];
}
