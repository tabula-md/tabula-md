import type { WorkspaceFile } from "../workspaceStorage";
import {
  getEditorSearchResult,
  type SearchMatch,
  type SearchOptions,
} from "./editorSearchModel";

export type WorkspaceSearchResultGroup = {
  fileId: string;
  fileTitle: string;
  matches: SearchMatch[];
};

export type WorkspaceSearchResult = {
  error: string | null;
  groups: WorkspaceSearchResultGroup[];
  matchCount: number;
};

export const searchWorkspaceFiles = (
  files: WorkspaceFile[],
  query: string,
  options: SearchOptions,
): WorkspaceSearchResult => {
  const groups: WorkspaceSearchResultGroup[] = [];
  let matchCount = 0;

  for (const file of files) {
    const result = getEditorSearchResult(file.text, query, options);
    if (result.error) {
      return { error: result.error, groups: [], matchCount: 0 };
    }
    if (result.matches.length === 0) continue;

    groups.push({
      fileId: file.id,
      fileTitle: file.title,
      matches: result.matches,
    });
    matchCount += result.matches.length;
  }

  return { error: null, groups, matchCount };
};
