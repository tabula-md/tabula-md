import type { WorkspaceFile } from "../workspaceStorage";
import {
  getEditorSearchResultWithLimit,
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
  truncated: boolean;
};

export const MAX_WORKSPACE_SEARCH_MATCHES = 500;
export const MAX_WORKSPACE_SEARCH_MATCHES_PER_FILE = 100;

export const searchWorkspaceFiles = (
  files: readonly Pick<WorkspaceFile, "id" | "text" | "title">[],
  query: string,
  options: SearchOptions,
): WorkspaceSearchResult => {
  const groups: WorkspaceSearchResultGroup[] = [];
  let matchCount = 0;
  let truncated = false;

  for (const file of files) {
    const remainingMatches = MAX_WORKSPACE_SEARCH_MATCHES - matchCount;
    if (remainingMatches <= 0) {
      truncated = true;
      break;
    }
    const result = getEditorSearchResultWithLimit(
      file.text,
      query,
      options,
      Math.min(MAX_WORKSPACE_SEARCH_MATCHES_PER_FILE, remainingMatches),
    );
    if (result.error) {
      return { error: result.error, groups: [], matchCount: 0, truncated: false };
    }
    if (result.matches.length === 0) continue;

    groups.push({
      fileId: file.id,
      fileTitle: file.title,
      matches: result.matches,
    });
    matchCount += result.matches.length;
    truncated ||= result.truncated;
  }

  return { error: null, groups, matchCount, truncated };
};
