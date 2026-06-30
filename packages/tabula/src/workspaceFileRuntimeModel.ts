export type WorkspaceFileTitleLike = {
  title: string;
};

export type WorkspaceFileIdentity = {
  id: string;
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

export function restoreFileToList<TFile extends WorkspaceFileIdentity>(
  files: TFile[],
  restoredFile: TFile,
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
  file: WorkspaceFileTitleLike,
) => file.title.trim().toLowerCase().replace(/\.md$/, "");
