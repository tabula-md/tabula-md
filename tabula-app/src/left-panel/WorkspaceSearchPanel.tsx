import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { DEFAULT_SEARCH_OPTIONS } from "../editor/editorSearchModel";
import { searchWorkspaceFiles } from "../editor/workspaceFileSearchModel";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import type { WorkspaceSearchIndexEntry } from "../workspace/workspaceSearchIndex";
import { WorkspaceFileTypeIcon } from "../workspace/components/WorkspaceFileTypeIcon";

type WorkspaceSearchPanelProps = {
  copy: WorkspaceInterfaceCopy["sidePanel"]["search"];
  entries: readonly WorkspaceSearchIndexEntry[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelectFile: (fileId: string) => void;
};

const SEARCH_RESULT_PAGE_SIZE = 40;

export function WorkspaceSearchPanel({
  copy,
  entries,
  query,
  onQueryChange,
  onSelectFile,
}: WorkspaceSearchPanelProps) {
  const [visibleLimit, setVisibleLimit] = useState(SEARCH_RESULT_PAGE_SIZE);
  const result = useMemo(
    () => searchWorkspaceFiles(entries, query, DEFAULT_SEARCH_OPTIONS),
    [entries, query],
  );
  const visibleResults = result.files.slice(0, visibleLimit);
  const hasQuery = query.trim().length > 0;

  return (
    <section className="left-panel-search" aria-label={copy.label}>
      <div className="left-panel-search-input">
        <Search size={15} aria-hidden="true" />
        <input
          autoFocus
          type="search"
          aria-label={copy.label}
          placeholder={copy.placeholder}
          value={query}
          onChange={(event) => {
            setVisibleLimit(SEARCH_RESULT_PAGE_SIZE);
            onQueryChange(event.target.value);
          }}
        />
        {query && (
          <button
            type="button"
            aria-label={copy.clearFilters}
            onClick={() => {
              setVisibleLimit(SEARCH_RESULT_PAGE_SIZE);
              onQueryChange("");
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="left-panel-search-summary" aria-live="polite">
        {hasQuery ? (result.error ?? copy.documentCount(result.files.length)) : copy.placeholder}
      </div>
      <div className="left-panel-search-results">
        {!entries.length && <p className="left-panel-search-empty">{copy.noDocuments}</p>}
        {entries.length > 0 && hasQuery && !result.error && !result.files.length && (
          <p className="left-panel-search-empty">{copy.noMatches}</p>
        )}
        {visibleResults.map((entry) => (
          <button
            key={entry.fileId}
            className="left-panel-search-result"
            type="button"
            aria-label={`${entry.title ?? entry.displayPath} · ${entry.displayPath}`}
            onClick={() => onSelectFile(entry.fileId)}
          >
            <WorkspaceFileTypeIcon kind={entry.iconKind} size={15} />
            <span>
              <strong>{entry.title}</strong>
              <small>{entry.displayPath}</small>
              {entry.preview && <small className="preview">{entry.preview}</small>}
            </span>
          </button>
        ))}
        {visibleLimit < result.files.length && (
          <button
            className="left-panel-search-more"
            type="button"
            onClick={() => setVisibleLimit((current) => current + SEARCH_RESULT_PAGE_SIZE)}
          >
            {copy.showDocuments(Math.min(
              SEARCH_RESULT_PAGE_SIZE,
              result.files.length - visibleLimit,
            ))}
          </button>
        )}
      </div>
    </section>
  );
}
