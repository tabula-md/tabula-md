import {
  getEditorSearchResultWithLimit,
  type SearchOptions,
} from "./editorSearchModel";

export type WorkspaceFileSearchEntry = {
  fileId: string;
  displayPath: string;
};

export type WorkspaceFileSearchResult = {
  error: string | null;
  files: WorkspaceFileSearchEntry[];
};

export const searchWorkspaceFileNames = (
  entries: readonly WorkspaceFileSearchEntry[],
  query: string,
  options: SearchOptions,
): WorkspaceFileSearchResult => {
  if (!query.trim()) return { error: null, files: [] };

  const files: WorkspaceFileSearchEntry[] = [];
  for (const entry of entries) {
    const result = getEditorSearchResultWithLimit(entry.displayPath, query, options, 1);
    if (result.error) return { error: result.error, files: [] };
    if (result.matches.length > 0) files.push(entry);
  }

  return { error: null, files };
};
