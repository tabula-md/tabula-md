import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import {
  DEFAULT_SEARCH_OPTIONS,
  type SearchOptions,
} from "../editor/editorSearchModel";
import {
  searchWorkspaceFiles,
  type WorkspaceSearchResult,
} from "../editor/workspaceSearchModel";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import { getWorkspaceFileTabLabels } from "../workspaceDisplayTitles";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import type { WorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "./ui/Popover";
import { PanelEmptyState } from "./right-panel/PanelEmptyState";

type RightPanelSearchProps = {
  copy: WorkspaceInterfaceCopy["sidePanel"]["search"];
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  language: WorkspaceLanguage;
  onOpenResult: (fileId: string, start: number, end: number) => void;
};

export function RightPanelSearch({
  copy,
  files,
  folders,
  language,
  onOpenResult,
}: RightPanelSearchProps) {
  const labels = getWorkspaceChromeCopy(language).documentControls;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [options, setOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<WorkspaceSearchResult>(() =>
    searchWorkspaceFiles([], "", DEFAULT_SEARCH_OPTIONS),
  );
  const [searchWorker, setSearchWorker] = useState<Worker | null>(null);
  const workerFilesRef = useRef(new Map<string, { text: string; title: string }>());
  const latestRequestIdRef = useRef(0);
  const fileLabels = useMemo(() => getWorkspaceFileTabLabels(files, folders), [files, folders]);
  const hasQuery = deferredQuery.trim().length > 0;

  useEffect(() => {
    if (typeof Worker === "undefined") return undefined;
    const worker = new Worker(new URL("../workers/workspaceSearch.worker.ts", import.meta.url), {
      type: "module",
    });
    setSearchWorker(worker);
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (!searchWorker) return;
    const previousFiles = workerFilesRef.current;
    const nextFiles = new Map<string, { text: string; title: string }>();
    const changedFiles = files.flatMap((file) => {
      nextFiles.set(file.id, { text: file.text, title: file.title });
      const previous = previousFiles.get(file.id);
      return previous?.text === file.text && previous.title === file.title
        ? []
        : [{ id: file.id, text: file.text, title: file.title }];
    });
    const removedFileIds = Array.from(previousFiles.keys()).filter((fileId) => !nextFiles.has(fileId));
    workerFilesRef.current = nextFiles;
    searchWorker.postMessage({
      type: "sync-files",
      fileIds: files.map((file) => file.id),
      files: changedFiles,
      removedFileIds,
    });
  }, [files, searchWorker]);

  useEffect(() => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    if (!hasQuery) {
      setSearching(false);
      setResult(searchWorkspaceFiles([], "", options));
      return;
    }
    if (!searchWorker) {
      setSearching(false);
      setResult(searchWorkspaceFiles(files, deferredQuery, options));
      return;
    }
    setSearching(true);
    searchWorker.onmessage = (event: MessageEvent<{ requestId: number; result: WorkspaceSearchResult }>) => {
      if (event.data.requestId !== latestRequestIdRef.current) return;
      setResult(event.data.result);
      setSearching(false);
    };
    searchWorker.onerror = () => {
      if (requestId !== latestRequestIdRef.current) return;
      setResult(searchWorkspaceFiles(files, deferredQuery, options));
      setSearching(false);
    };
    searchWorker.postMessage({
      type: "search",
      options,
      query: deferredQuery,
      requestId,
    });
    return undefined;
  }, [deferredQuery, files, hasQuery, options, searchWorker]);

  const toggleOption = (option: keyof SearchOptions) => {
    setOptions((current) => ({ ...current, [option]: !current[option] }));
  };

  return (
    <section className="right-panel-search" aria-label={copy.results}>
      <div className="right-panel-search-controls">
        <label className="right-panel-search-field">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            autoComplete="off"
            spellCheck={false}
            aria-label={labels.search}
            aria-invalid={Boolean(result.error)}
            placeholder={labels.search}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <PopoverRoot open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <button
              className={settingsOpen ? "active" : ""}
              type="button"
              aria-label={copy.settings}
              data-tooltip={copy.settings}
              aria-pressed={settingsOpen}
            >
              <SlidersHorizontal size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="right-panel-search-settings" aria-label={copy.settings}>
            {([
              ["caseSensitive", "Aa", labels.matchCase],
              ["wholeWord", "wd", labels.matchWholeWord],
              ["regexp", ".*", labels.useRegularExpression],
            ] as const).map(([option, abbreviation, label]) => (
              <button
                key={option}
                className={options[option] ? "active" : ""}
                type="button"
                aria-pressed={options[option]}
                onClick={() => toggleOption(option)}
              >
                <span aria-hidden="true">{abbreviation}</span>
                <span>{label}</span>
              </button>
            ))}
          </PopoverContent>
        </PopoverRoot>
      </div>

      {files.length === 0 && <PanelEmptyState>{copy.noDocuments}</PanelEmptyState>}
      {!searching && result.error && <p className="right-panel-search-message error">{result.error}</p>}
      {files.length > 0 && hasQuery && !searching && !result.error && result.matchCount === 0 && (
        <PanelEmptyState>{copy.noMatches}</PanelEmptyState>
      )}
      {!searching && result.matchCount > 0 && (
        <div className="right-panel-search-results" aria-label={copy.results}>
          {result.groups.map((group) => (
            <section key={group.fileId} className="right-panel-search-group">
              <h3>{fileLabels.get(group.fileId)?.fullPath ?? group.fileTitle}</h3>
              {group.matches.map((match) => (
                <button
                  key={`${match.start}:${match.end}`}
                  type="button"
                  onClick={() => onOpenResult(group.fileId, match.start, match.end)}
                >
                  {match.preview}
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
      {!searching && result.truncated && (
        <p className="right-panel-search-message">{copy.resultsLimited(result.matchCount)}</p>
      )}
    </section>
  );
}
