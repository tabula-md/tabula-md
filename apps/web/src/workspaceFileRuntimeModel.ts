import {
  README_FILE_ID,
  STARTER_README_MARKDOWN,
  type WorkspaceFile,
} from "./workspaceStorage";

export type WorkspaceFileCreationDraft = {
  title: string;
  text: string;
  viewMode: WorkspaceFile["viewMode"];
  overrides: Partial<WorkspaceFile>;
};

export function removeRecordKey<TValue>(
  record: Record<string, TValue>,
  key: string,
) {
  if (!(key in record)) {
    return record;
  }

  const { [key]: _removed, ...nextRecord } = record;
  return nextRecord;
}

export function restoreFileToList(
  files: WorkspaceFile[],
  restoredFile: WorkspaceFile,
  restoredIndex: number,
) {
  if (files.some((file) => file.id === restoredFile.id)) {
    return files;
  }

  const nextFiles = [...files];
  nextFiles.splice(Math.min(Math.max(0, restoredIndex), nextFiles.length), 0, restoredFile);
  return nextFiles;
}

export function restoreOpenFileId(
  openFileIds: string[],
  restoredFileId: string,
  previousOpenFileIds: string[],
) {
  if (
    !previousOpenFileIds.includes(restoredFileId) ||
    openFileIds.includes(restoredFileId)
  ) {
    return openFileIds;
  }

  const previousOpenIndex = previousOpenFileIds.indexOf(restoredFileId);
  const nextOpenFileIds = [...openFileIds];
  nextOpenFileIds.splice(
    Math.min(previousOpenIndex, nextOpenFileIds.length),
    0,
    restoredFileId,
  );
  return nextOpenFileIds;
}

export const normalizeWorkspaceFileTitleForLookup = (
  file: Pick<WorkspaceFile, "title">,
) => file.title.trim().toLowerCase().replace(/\.md$/, "");

export const findWorkspaceAboutFile = (files: WorkspaceFile[]) =>
  files.find((file) => file.id === README_FILE_ID) ??
  files.find((file) => normalizeWorkspaceFileTitleForLookup(file) === "readme");

export const getWorkspaceAboutFileDraft = (): WorkspaceFileCreationDraft => ({
  title: "README.md",
  text: STARTER_README_MARKDOWN,
  viewMode: "preview",
  overrides: {
    id: README_FILE_ID,
    lineNumbers: true,
    lineWrapping: true,
    readingWidth: "wide",
  },
});
