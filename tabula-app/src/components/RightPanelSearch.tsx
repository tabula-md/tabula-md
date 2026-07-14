import { useDeferredValue, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import {
  DEFAULT_SEARCH_OPTIONS,
  type SearchOptions,
} from "../editor/editorSearchModel";
import { searchWorkspaceFiles } from "../editor/workspaceSearchModel";
import type { WorkspaceFile } from "../workspaceStorage";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import type { WorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "./ui/Popover";

type RightPanelSearchProps = {
  copy: WorkspaceInterfaceCopy["sidePanel"]["search"];
  files: WorkspaceFile[];
  language: WorkspaceLanguage;
  onOpenResult: (fileId: string, start: number, end: number) => void;
};

export function RightPanelSearch({
  copy,
  files,
  language,
  onOpenResult,
}: RightPanelSearchProps) {
  const labels = getWorkspaceChromeCopy(language).documentControls;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [options, setOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const result = useMemo(
    () => searchWorkspaceFiles(files, deferredQuery, options),
    [deferredQuery, files, options],
  );
  const hasQuery = deferredQuery.trim().length > 0;

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

      {result.error && <p className="right-panel-search-message error">{result.error}</p>}
      {hasQuery && !result.error && result.matchCount === 0 && (
        <p className="right-panel-search-message">{copy.noMatches}</p>
      )}
      {result.matchCount > 0 && (
        <div className="right-panel-search-results" aria-label={copy.results}>
          {result.groups.map((group) => (
            <section key={group.fileId} className="right-panel-search-group">
              <h3>{group.fileTitle}</h3>
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
    </section>
  );
}
