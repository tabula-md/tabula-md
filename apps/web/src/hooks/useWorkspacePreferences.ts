import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { FileViewMode, ReadingWidth } from "../workspaceStorage";

export const WORKSPACE_PREFERENCES_KEY = "tabula.preferences.v1";

export type WorkspacePreferences = {
  newFileViewMode: FileViewMode;
  readingWidth: ReadingWidth;
  lineWrapping: boolean;
  lineNumbers: boolean;
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  newFileViewMode: "edit",
  readingWidth: "wide",
  lineWrapping: true,
  lineNumbers: true,
};

const isFileViewMode = (value: unknown): value is FileViewMode =>
  value === "edit" || value === "split" || value === "preview";

const isReadingWidth = (value: unknown): value is ReadingWidth =>
  value === "narrow" || value === "standard" || value === "wide";

export const parseWorkspacePreferences = (value: unknown): WorkspacePreferences => {
  const partialPreferences =
    value && typeof value === "object" ? (value as Partial<WorkspacePreferences>) : {};

  return {
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
    try {
      writeWorkspacePreferences(workspacePreferences);
    } catch {
      // Preferences are a local convenience, not required for document editing.
    }
  }, [workspacePreferences]);

  return [workspacePreferences, setWorkspacePreferences];
}
