import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  stripMarkdownExtension,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  File,
  ListFilter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import {
  DEFAULT_SEARCH_OPTIONS,
  type SearchOptions,
} from "../editor/editorSearchModel";
import {
  searchWorkspaceFiles,
} from "../editor/workspaceFileSearchModel";
import type { WorkspaceFile, WorkspaceFolder } from "../workspace/workspaceStorage";
import { getWorkspaceFileTabLabels } from "../workspace/workspaceDisplayTitles";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { MenuCheckboxItem, MenuContent, MenuRoot, MenuTrigger } from "../ui/Menu";
import { PanelEmptyState } from "./PanelEmptyState";

type RightPanelSearchProps = {
  copy: WorkspaceInterfaceCopy["sidePanel"]["search"];
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  index?: WorkspaceKnowledgeIndex;
  language: WorkspaceLanguage;
  onSelectFile: (fileId: string) => void;
};

type MetadataFacet = {
  value: string;
  count: number;
};

type MetadataFacetSectionProps = {
  facets: readonly MetadataFacet[];
  label: string;
  selected: ReadonlySet<string>;
  onToggleFacet: (value: string) => void;
};

const getMetadataFacets = (
  documentIdsByValue: ReadonlyMap<string, readonly string[]> | undefined,
) => [...(documentIdsByValue ?? [])]
  .map(([value, documentIds]) => ({ value, count: documentIds.length }))
  .sort((first, second) => first.value.localeCompare(second.value));

const getOpenableResource = (resource: string | undefined) => {
  if (!resource) return undefined;
  try {
    const url = new URL(resource);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};

function MetadataFacetSection({
  facets,
  label,
  selected,
  onToggleFacet,
}: MetadataFacetSectionProps) {
  if (facets.length === 0) return null;
  return (
    <section className="right-panel-search-facet-section" aria-label={label}>
      <h3>{label}</h3>
      <div className="right-panel-search-facet-list">
        {facets.map((facet) => (
          <button
            className="right-panel-search-facet"
            type="button"
            key={facet.value}
            aria-pressed={selected.has(facet.value)}
            onClick={() => onToggleFacet(facet.value)}
          >
            <span className="right-panel-search-facet-check" aria-hidden="true">
              <Check size={12} />
            </span>
            <span>{facet.value}</span>
            <span>{facet.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function RightPanelSearch({
  copy,
  files,
  folders,
  index,
  language,
  onSelectFile,
}: RightPanelSearchProps) {
  const labels = getWorkspaceChromeCopy(language).documentControls;
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [options, setOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterViewOpen, setFilterViewOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => new Set());
  const fileLabels = useMemo(() => getWorkspaceFileTabLabels(files, folders), [files, folders]);
  const searchEntries = useMemo(() => files.map((file) => ({
    fileId: file.id,
    displayPath: stripMarkdownExtension(fileLabels.get(file.id)?.fullPath ?? file.title),
    ...index?.analysesByDocumentId.get(file.id)?.knowledgeMetadata,
  })), [fileLabels, files, index]);
  const typeFacets = useMemo(
    () => getMetadataFacets(index?.documentIdsByType),
    [index],
  );
  const tagFacets = useMemo(
    () => getMetadataFacets(index?.documentIdsByTag),
    [index],
  );
  useEffect(() => {
    const available = new Set(typeFacets.map((facet) => facet.value));
    setSelectedTypes((current) => {
      const next = new Set([...current].filter((value) => available.has(value)));
      return next.size === current.size ? current : next;
    });
  }, [typeFacets]);
  useEffect(() => {
    const available = new Set(tagFacets.map((facet) => facet.value));
    setSelectedTags((current) => {
      const next = new Set([...current].filter((value) => available.has(value)));
      return next.size === current.size ? current : next;
    });
  }, [tagFacets]);
  const filters = useMemo(
    () => ({ types: selectedTypes, tags: selectedTags }),
    [selectedTags, selectedTypes],
  );
  const result = useMemo(
    () => searchWorkspaceFiles(searchEntries, deferredQuery, options, filters),
    [deferredQuery, filters, options, searchEntries],
  );
  const hasQuery = deferredQuery.trim().length > 0;
  const hasFilters = selectedTypes.size > 0 || selectedTags.size > 0;
  const hasActiveOptions = Object.values(options).some(Boolean);
  const hasMetadataFacets = typeFacets.length > 0 || tagFacets.length > 0;

  useEffect(() => {
    if (!hasMetadataFacets) setFilterViewOpen(false);
  }, [hasMetadataFacets]);

  const toggleOption = (option: keyof SearchOptions) => {
    setOptions((current) => ({ ...current, [option]: !current[option] }));
  };
  const toggleFacet = (
    setSelected: Dispatch<SetStateAction<Set<string>>>,
    value: string,
  ) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };
  const removeFacet = (
    setSelected: Dispatch<SetStateAction<Set<string>>>,
    value: string,
  ) => {
    setSelected((current) => {
      const next = new Set(current);
      next.delete(value);
      return next;
    });
  };
  const clearFilters = () => {
    setSelectedTypes(new Set());
    setSelectedTags(new Set());
  };

  return (
    <section
      className={`right-panel-search ${filterViewOpen ? "filter-view" : ""}`.trim()}
      aria-label={copy.results}
    >
      {filterViewOpen ? (
        <>
          <header className="right-panel-search-filter-header">
            <button
              className="right-panel-search-filter-back"
              type="button"
              aria-label={copy.backToResults}
              data-tooltip={copy.backToResults}
              onClick={() => setFilterViewOpen(false)}
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <h2>{copy.filters}</h2>
            <button
              className="right-panel-search-filter-reset"
              type="button"
              disabled={!hasFilters}
              onClick={clearFilters}
            >
              {copy.clearFilters}
            </button>
          </header>
          <div className="right-panel-search-filter-scroll">
            <MetadataFacetSection
              facets={typeFacets}
              label={copy.types}
              selected={selectedTypes}
              onToggleFacet={(value) => toggleFacet(setSelectedTypes, value)}
            />
            <MetadataFacetSection
              facets={tagFacets}
              label={copy.tags}
              selected={selectedTags}
              onToggleFacet={(value) => toggleFacet(setSelectedTags, value)}
            />
          </div>
          <footer className="right-panel-search-filter-footer">
            <button
              type="button"
              disabled={!hasQuery && !hasFilters}
              onClick={() => setFilterViewOpen(false)}
            >
              {!hasQuery && !hasFilters
                ? copy.chooseFilters
                : copy.showDocuments(result.files.length)}
            </button>
          </footer>
        </>
      ) : (
        <>
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
            <button
              className="right-panel-search-filter-trigger"
              type="button"
              aria-label={copy.filters}
              data-tooltip={copy.filters}
              disabled={!hasMetadataFacets}
              onClick={() => setFilterViewOpen(true)}
            >
              <ListFilter size={16} aria-hidden="true" />
              {hasFilters && (
                <span className="right-panel-control-status-dot" aria-hidden="true" />
              )}
            </button>
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

          <div className="right-panel-search-scroll">
            {hasFilters && (
              <div className="right-panel-search-active-filters" aria-label={copy.filters}>
                <div className="right-panel-search-filter-chips">
                  {[...selectedTypes].map((value) => {
                    const label = copy.typeFilter(value);
                    return (
                      <button
                        type="button"
                        key={`type:${value}`}
                        aria-label={copy.removeFilter(label)}
                        onClick={() => removeFacet(setSelectedTypes, value)}
                      >
                        <span>{label}</span>
                        <X size={12} aria-hidden="true" />
                      </button>
                    );
                  })}
                  {[...selectedTags].map((value) => {
                    const label = copy.tagFilter(value);
                    return (
                      <button
                        type="button"
                        key={`tag:${value}`}
                        aria-label={copy.removeFilter(label)}
                        onClick={() => removeFacet(setSelectedTags, value)}
                      >
                        <span>{label}</span>
                        <X size={12} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
                <button
                  className="right-panel-search-clear-filters"
                  type="button"
                  onClick={clearFilters}
                >
                  {copy.clearFilters}
                </button>
              </div>
            )}

            {result.error && <p className="right-panel-search-message error">{result.error}</p>}
            {(hasQuery || hasFilters) && !result.error && result.files.length > 0 && (
              <p className="right-panel-search-result-count">
                {copy.documentCount(result.files.length)}
              </p>
            )}
            {(hasQuery || hasFilters) && !result.error && result.files.length === 0 && (
              <PanelEmptyState>{copy.noMatches}</PanelEmptyState>
            )}
            {result.files.length > 0 && (
              <div className="right-panel-search-results" aria-label={copy.results}>
                {result.files.map((file) => {
                  const resource = getOpenableResource(file.resource);
                  return (
                    <div className="right-panel-search-result-row" key={file.fileId}>
                      <button
                        className="right-panel-search-result"
                        type="button"
                        onClick={() => onSelectFile(file.fileId)}
                      >
                        <File size={16} aria-hidden="true" />
                        <span>{file.displayPath}</span>
                      </button>
                      {resource && (
                        <a
                          className="right-panel-search-resource"
                          href={resource}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={copy.openResource(file.displayPath)}
                          data-tooltip={copy.openResource(file.displayPath)}
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
