import { type FileViewMode, type ReadingWidth } from "./documentPrimitives";
import { normalizeWorkspaceFileTitle } from "./workspaceModel";

export type WorkspaceFilePreferenceDefaults<
  TViewMode extends string = FileViewMode,
  TReadingWidth extends string = ReadingWidth,
> = {
  newFileViewMode: TViewMode;
  readingWidth: TReadingWidth;
  lineWrapping: boolean;
  lineNumbers: boolean;
};

export type WorkspaceIoPreferenceOverrides<
  TViewMode extends string = FileViewMode,
  TReadingWidth extends string = ReadingWidth,
> = {
  viewMode: TViewMode;
  readingWidth: TReadingWidth;
  lineWrapping: boolean;
  lineNumbers: boolean;
};

export type TextFileDownloadDraft = {
  fileName: string;
  content: string;
  type: string;
};

export type WorkspaceIoFile = {
  title: string;
  text: string;
};

export type ImportedWorkspaceFileDraft<
  TViewMode extends string = FileViewMode,
  TReadingWidth extends string = ReadingWidth,
> = {
  title: string;
  text: string;
  viewMode: TViewMode;
  overrides: WorkspaceIoPreferenceOverrides<TViewMode, TReadingWidth>;
};

export function getNewFilePreferenceOverrides<
  TViewMode extends string,
  TReadingWidth extends string,
>(
  preferences: WorkspaceFilePreferenceDefaults<TViewMode, TReadingWidth>,
): WorkspaceIoPreferenceOverrides<TViewMode, TReadingWidth> {
  return {
    viewMode: preferences.newFileViewMode,
    readingWidth: preferences.readingWidth,
    lineWrapping: preferences.lineWrapping,
    lineNumbers: preferences.lineNumbers,
  };
}

export const isSupportedImportFileDescriptor = (
  file: Pick<File, "name" | "type">,
) => {
  const fileName = file.name.toLowerCase();
  return (
    fileName.endsWith(".md") ||
    fileName.endsWith(".markdown") ||
    file.type === "text/markdown" ||
    file.type === "text/plain"
  );
};

export const createCurrentFileDownloadDraft = (
  file: WorkspaceIoFile,
): TextFileDownloadDraft => ({
  fileName: file.title,
  content: file.text,
  type: "text/markdown;charset=utf-8",
});

export const createImportedWorkspaceFileDraft = <
  TViewMode extends string,
  TReadingWidth extends string,
>(
  fileName: string,
  text: string,
  preferences: WorkspaceFilePreferenceDefaults<TViewMode, TReadingWidth>,
): ImportedWorkspaceFileDraft<TViewMode, TReadingWidth> => ({
  title: normalizeWorkspaceFileTitle(fileName || "Imported.md"),
  text,
  viewMode: preferences.newFileViewMode,
  overrides: getNewFilePreferenceOverrides(preferences),
});
