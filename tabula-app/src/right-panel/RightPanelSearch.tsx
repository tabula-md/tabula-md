import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  getOkfFreshness,
  stripMarkdownExtension,
  type OkfFreshness,
  type OkfLifecycleStatus,
  type OkfTrustTier,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Hash,
  ListFilter,
  Search,
  SlidersHorizontal,
  TextQuote,
  X,
} from "lucide-react";
import {
  DEFAULT_SEARCH_OPTIONS,
  type SearchOptions,
} from "../editor/editorSearchModel";
import {
  getMetadataFacets,
  searchWorkspaceFiles,
  type MetadataFacet,
  type WorkspaceFileSearchEntry,
  type WorkspaceFileSearchMatch,
} from "../editor/workspaceFileSearchModel";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import {
  isEncodedBinaryWorkspaceSupportFile,
  isMarkdownWorkspacePath,
} from "../workspace/io/workspaceSupportFile";
import type { WorkspaceFile, WorkspaceFolder } from "../workspace/workspaceStorage";
import { getWorkspaceFileTabLabels } from "../workspace/workspaceDisplayTitles";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { MenuCheckboxItem, MenuContent, MenuRoot, MenuTrigger } from "../ui/Menu";
import { PanelEmptyState } from "./PanelEmptyState";

type RightPanelSearchProps = {
  copy: WorkspaceInterfaceCopy["sidePanel"]["search"];
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  index?: WorkspaceKnowledgeIndex;
  language: WorkspaceLanguage;
  onSelectFile: (fileId: string, range?: { from: number; to: number }) => void;
};

type MetadataFacetSectionProps = {
  facets: readonly MetadataFacet[];
  emptyMessage: string;
  label: string;
  selected: ReadonlySet<string>;
  onToggleFacet: (value: string) => void;
};

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
  emptyMessage,
  label,
  selected,
  onToggleFacet,
}: MetadataFacetSectionProps) {
  return (
    <section className="right-panel-search-facet-section" aria-label={label}>
      <h3>{label}</h3>
      <div className="right-panel-search-facet-list">
        {facets.length === 0 ? (
          <p className="right-panel-search-facet-empty">{emptyMessage}</p>
        ) : facets.map((facet) => (
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
  const metadataCopy = getKnowledgePanelCopy(language);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [options, setOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterViewOpen, setFilterViewOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<OkfLifecycleStatus>>(
    () => new Set(),
  );
  const [selectedTrustTiers, setSelectedTrustTiers] = useState<Set<OkfTrustTier>>(
    () => new Set(),
  );
  const [selectedFreshness, setSelectedFreshness] = useState<Set<OkfFreshness>>(
    () => new Set(),
  );
  const fileLabels = useMemo(
    () => getWorkspaceFileTabLabels(files, folders),
    [files, folders],
  );
  const searchEntries = useMemo(
    () => files.map((file): WorkspaceFileSearchEntry => {
      const analysis = index?.analysesByDocumentId.get(file.id);
      const metadata = analysis?.knowledgeMetadata;
      const isMarkdown = isMarkdownWorkspacePath(file.title);
      const basename = file.title.split("/").at(-1)?.toLocaleLowerCase();
      const isTextSupportFile = !isMarkdown &&
        !isEncodedBinaryWorkspaceSupportFile(file.title, file.text);
      const extension = file.title.split(".").at(-1);
      return {
        fileId: file.id,
        displayPath: stripMarkdownExtension(
          fileLabels.get(file.id)?.fullPath ?? file.title,
        ),
        browseByDefault: Boolean(
          analysis && basename !== "index.md" && basename !== "log.md",
        ),
        contentKind: isMarkdown ? "markdown" : isTextSupportFile ? "text" : undefined,
        content: isMarkdown || isTextSupportFile ? file.text : undefined,
        format: isMarkdown ? "Markdown" : extension?.toLocaleUpperCase(),
        title: analysis?.title,
        description: metadata?.description,
        type: metadata?.type,
        tags: metadata?.tags,
        resource: metadata?.resource,
        sourceValues: metadata?.sources.flatMap((source) => [
          source.id,
          source.title,
          source.author,
          source.resource,
        ].filter((value): value is string => Boolean(value))),
        generatedBy: metadata?.generated?.by,
        verifiedBy: metadata?.verified.map((event) => event.by),
        status: metadata?.type ? metadata.status : undefined,
        trustTier: metadata?.type ? metadata.trustTier : undefined,
        freshness: metadata?.type ? getOkfFreshness(metadata) : undefined,
      };
    }),
    [fileLabels, files, index],
  );
  const typeFacets = useMemo(
    () => getMetadataFacets(searchEntries, (entry) => entry.type),
    [searchEntries],
  );
  const tagFacets = useMemo(
    () => getMetadataFacets(searchEntries, (entry) => entry.tags),
    [searchEntries],
  );
  const statusFacets = useMemo(
    () => getMetadataFacets(searchEntries, (entry) => entry.status),
    [searchEntries],
  );
  const trustFacets = useMemo(
    () => getMetadataFacets(searchEntries, (entry) => entry.trustTier),
    [searchEntries],
  );
  const freshnessFacets = useMemo(
    () => getMetadataFacets(searchEntries, (entry) => entry.freshness),
    [searchEntries],
  );
  const filters = useMemo(
    () => ({
      types: selectedTypes,
      tags: selectedTags,
      statuses: selectedStatuses,
      trustTiers: selectedTrustTiers,
      freshness: selectedFreshness,
    }),
    [
      selectedFreshness,
      selectedStatuses,
      selectedTags,
      selectedTrustTiers,
      selectedTypes,
    ],
  );
  const result = useMemo(
    () => searchWorkspaceFiles(searchEntries, deferredQuery, options, filters),
    [deferredQuery, filters, options, searchEntries],
  );
  const hasQuery = deferredQuery.trim().length > 0;
  const hasFilters = selectedTypes.size > 0 ||
    selectedTags.size > 0 ||
    selectedStatuses.size > 0 ||
    selectedTrustTiers.size > 0 ||
    selectedFreshness.size > 0;
  const visibleEntries = hasQuery || hasFilters
    ? result.files
    : searchEntries.filter((entry) => entry.browseByDefault);
  type VisibleDestination = {
    file: WorkspaceFileSearchEntry;
    match?: WorkspaceFileSearchMatch;
    index: number;
  };
  const visibleDestinations = useMemo<VisibleDestination[]>(
    () => visibleEntries.flatMap((file): VisibleDestination[] => {
    const matches = hasQuery ? result.matchesByFileId.get(file.fileId) ?? [] : [];
    return matches.length > 0
      ? matches.map((match, index) => ({ file, match, index }))
      : [{ file, match: undefined, index: 0 }];
    }),
    [hasQuery, result.matchesByFileId, visibleEntries],
  );
  const hasActiveOptions = Object.values(options).some(Boolean);

  const keepAvailable = <TValue extends string>(
    values: readonly MetadataFacet[],
    setSelected: Dispatch<SetStateAction<Set<TValue>>>,
  ) => {
    const available = new Set(values.map((facet) => facet.value));
    setSelected((current) => {
      const next = new Set([...current].filter((value) => available.has(value)));
      return next.size === current.size ? current : next;
    });
  };
  useEffect(() => keepAvailable(typeFacets, setSelectedTypes), [typeFacets]);
  useEffect(() => keepAvailable(tagFacets, setSelectedTags), [tagFacets]);
  useEffect(
    () => keepAvailable(statusFacets, setSelectedStatuses),
    [statusFacets],
  );
  useEffect(
    () => keepAvailable(trustFacets, setSelectedTrustTiers),
    [trustFacets],
  );
  useEffect(
    () => keepAvailable(freshnessFacets, setSelectedFreshness),
    [freshnessFacets],
  );

  const toggleFacet = <TValue extends string>(
    setSelected: Dispatch<SetStateAction<Set<TValue>>>,
    value: TValue,
  ) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };
  const removeFacet = <TValue extends string>(
    setSelected: Dispatch<SetStateAction<Set<TValue>>>,
    value: TValue,
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
    setSelectedStatuses(new Set());
    setSelectedTrustTiers(new Set());
    setSelectedFreshness(new Set());
  };
  const toggleOption = (option: keyof SearchOptions) => {
    setOptions((current) => ({ ...current, [option]: !current[option] }));
  };
  const facetChip = (
    prefix: string,
    value: string,
    onRemove: () => void,
  ) => {
    const label = `${prefix}: ${value}`;
    return (
      <button
        type="button"
        key={label}
        aria-label={copy.removeFilter(label)}
        onClick={onRemove}
      >
        <span>{label}</span>
        <X size={12} aria-hidden="true" />
      </button>
    );
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
              emptyMessage={copy.noFacetValues}
              facets={typeFacets}
              label={copy.types}
              selected={selectedTypes}
              onToggleFacet={(value) => toggleFacet(setSelectedTypes, value)}
            />
            <MetadataFacetSection
              emptyMessage={copy.noFacetValues}
              facets={tagFacets}
              label={copy.tags}
              selected={selectedTags}
              onToggleFacet={(value) => toggleFacet(setSelectedTags, value)}
            />
            <MetadataFacetSection
              emptyMessage={copy.noFacetValues}
              facets={statusFacets}
              label={metadataCopy.status}
              selected={selectedStatuses}
              onToggleFacet={(value) =>
                toggleFacet(setSelectedStatuses, value as OkfLifecycleStatus)}
            />
            <MetadataFacetSection
              emptyMessage={copy.noFacetValues}
              facets={trustFacets}
              label={metadataCopy.trust}
              selected={selectedTrustTiers}
              onToggleFacet={(value) =>
                toggleFacet(setSelectedTrustTiers, value as OkfTrustTier)}
            />
            <MetadataFacetSection
              emptyMessage={copy.noFacetValues}
              facets={freshnessFacets}
              label={metadataCopy.freshness}
              selected={selectedFreshness}
              onToggleFacet={(value) =>
                toggleFacet(setSelectedFreshness, value as OkfFreshness)}
            />
          </div>
          <footer className="right-panel-search-filter-footer">
            <button type="button" onClick={() => setFilterViewOpen(false)}>
              {copy.showDocuments(visibleEntries.length)}
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
                autoFocus
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
                  {[...selectedTypes].map((value) =>
                    facetChip(copy.types.slice(0, -1), value, () =>
                      removeFacet(setSelectedTypes, value)))}
                  {[...selectedTags].map((value) =>
                    facetChip(copy.tags.slice(0, -1), value, () =>
                      removeFacet(setSelectedTags, value)))}
                  {[...selectedStatuses].map((value) =>
                    facetChip(metadataCopy.status, value, () =>
                      removeFacet(setSelectedStatuses, value)))}
                  {[...selectedTrustTiers].map((value) =>
                    facetChip(metadataCopy.trust, value, () =>
                      removeFacet(setSelectedTrustTiers, value)))}
                  {[...selectedFreshness].map((value) =>
                    facetChip(metadataCopy.freshness, value, () =>
                      removeFacet(setSelectedFreshness, value)))}
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

            {result.error && (
              <p className="right-panel-search-message error">{result.error}</p>
            )}
            {(hasQuery || hasFilters) && !result.error && visibleEntries.length === 0 && (
              <PanelEmptyState>{copy.noMatches}</PanelEmptyState>
            )}
            {visibleDestinations.length > 0 && (
              <>
                <p className="right-panel-search-result-count">
                  {copy.documentCount(visibleDestinations.length)}
                </p>
                <div className="right-panel-search-results" aria-label={copy.results}>
                  {visibleDestinations.map(({ file, match, index }) => {
                    const resource = getOpenableResource(file.resource);
                    const title = file.title?.trim() ||
                      file.displayPath.split("/").at(-1) ||
                      file.displayPath;
                    const range = match?.from === undefined || match.to === undefined ||
                        file.contentKind !== "markdown"
                      ? undefined
                      : { from: match.from, to: match.to };
                    const matchIcon = match?.kind === "heading"
                      ? <Hash size={13} aria-hidden="true" />
                      : match?.kind === "passage"
                        ? <TextQuote size={13} aria-hidden="true" />
                        : match?.kind === "metadata"
                          ? <SlidersHorizontal size={13} aria-hidden="true" />
                          : match?.kind === "document"
                            ? <FileText size={13} aria-hidden="true" />
                            : null;
                    return (
                      <div
                        className="right-panel-search-result-row"
                        key={`${file.fileId}-${match?.kind ?? "browse"}-${match?.from ?? index}-${index}`}
                      >
                        <button
                          className="right-panel-search-result"
                          type="button"
                          aria-label={match?.label
                            ? `${file.displayPath}: ${match.label}`
                            : file.displayPath}
                          data-search-result-kind={match?.kind ?? "document"}
                          onClick={() => onSelectFile(file.fileId, range)}
                        >
                          <span className="right-panel-search-result-copy">
                            <span className="right-panel-search-result-title">{title}</span>
                            <span className="right-panel-search-result-path">
                              {file.displayPath}
                            </span>
                            {match?.preview && match.kind !== "document" ? (
                              <span className="right-panel-search-result-match">
                                {matchIcon}
                                <span>{match.preview}</span>
                              </span>
                            ) : file.description ? (
                              <span className="right-panel-search-result-description">
                                {file.description}
                              </span>
                            ) : null}
                            <span className="right-panel-search-result-metadata">
                              {file.type || file.format || copy.untyped}
                            </span>
                          </span>
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
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
