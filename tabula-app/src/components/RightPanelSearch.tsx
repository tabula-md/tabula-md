import { useDeferredValue, useMemo, useState } from "react";
import { stripMarkdownExtension } from "@tabula-md/tabula";
import { Check, File, Search, SlidersHorizontal } from "lucide-react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import {
  DEFAULT_SEARCH_OPTIONS,
  type SearchOptions,
} from "../editor/editorSearchModel";
import {
  searchWorkspaceFileNames,
} from "../editor/workspaceFileSearchModel";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import { getWorkspaceFileTabLabels } from "../workspaceDisplayTitles";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import type { WorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { MenuCheckboxItem, MenuContent, MenuRoot, MenuTrigger } from "./ui/Menu";
import { PanelEmptyState } from "./right-panel/PanelEmptyState";

type RightPanelSearchProps = {
  copy: WorkspaceInterfaceCopy["sidePanel"]["search"];
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  language: WorkspaceLanguage;
  onSelectFile: (fileId: string) => void;
};

export function RightPanelSearch({
  copy,
  files,
  folders,
  language,
  onSelectFile,
}: RightPanelSearchProps) {
  const labels = getWorkspaceChromeCopy(language).documentControls;
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [options, setOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileLabels = useMemo(() => getWorkspaceFileTabLabels(files, folders), [files, folders]);
  const searchEntries = useMemo(() => files.map((file) => ({
    fileId: file.id,
    displayPath: stripMarkdownExtension(fileLabels.get(file.id)?.fullPath ?? file.title),
  })), [fileLabels, files]);
  const result = useMemo(
    () => searchWorkspaceFileNames(searchEntries, deferredQuery, options),
    [deferredQuery, options, searchEntries],
  );
  const hasQuery = deferredQuery.trim().length > 0;
  const hasActiveOptions = Object.values(options).some(Boolean);

  const toggleOption = (option: keyof SearchOptions) => {
    setOptions((current) => ({ ...current, [option]: !current[option] }));
  };

  return (
    <section className="right-panel-search" aria-label={copy.results}>
      <div className="right-panel-search-controls">
        <label className="right-panel-search-field">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            role="searchbox"
            inputMode="search"
            value={query}
            autoComplete="off"
            spellCheck={false}
            aria-label={copy.placeholder}
            aria-invalid={Boolean(result.error)}
            placeholder={copy.placeholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <MenuRoot open={settingsOpen} onOpenChange={setSettingsOpen}>
          <MenuTrigger asChild>
            <button
              className="right-panel-search-settings-trigger"
              type="button"
              aria-label={copy.settings}
              data-tooltip={copy.settings}
              aria-expanded={settingsOpen}
            >
              <SlidersHorizontal size={16} />
              {hasActiveOptions && (
                <span className="right-panel-control-status-dot" aria-hidden="true" />
              )}
            </button>
          </MenuTrigger>
          <MenuContent className="right-panel-search-settings" ariaLabel={copy.settings}>
            {([
              ["caseSensitive", "Aa", labels.matchCase],
              ["wholeWord", "wd", labels.matchWholeWord],
              ["regexp", ".*", labels.useRegularExpression],
            ] as const).map(([option, abbreviation, label]) => (
              <MenuCheckboxItem
                key={option}
                checked={options[option]}
                icon={options[option] ? <Check size={14} /> : undefined}
                label={label}
                trailing={<span aria-hidden="true">{abbreviation}</span>}
                onCheckedChange={() => toggleOption(option)}
                onSelect={(event) => event.preventDefault()}
              />
            ))}
          </MenuContent>
        </MenuRoot>
      </div>

      {result.error && <p className="right-panel-search-message error">{result.error}</p>}
      {hasQuery && !result.error && result.files.length === 0 && (
        <PanelEmptyState>{copy.noMatches}</PanelEmptyState>
      )}
      {result.files.length > 0 && (
        <div className="right-panel-search-results" aria-label={copy.results}>
          {result.files.map((file) => (
            <button
              className="right-panel-search-result"
              key={file.fileId}
              type="button"
              onClick={() => onSelectFile(file.fileId)}
            >
              <File size={16} aria-hidden="true" />
              <span>{file.displayPath}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
