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
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CornerDownLeft,
  File,
  FileText,
  ListFilter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DEFAULT_SEARCH_OPTIONS,
  type SearchOptions,
} from "../../editor/editorSearchModel";
import {
  getMetadataFacets,
  searchWorkspaceFiles,
  type MetadataFacet,
  type WorkspaceFileSearchEntry,
  type WorkspaceFileSearchMatch,
} from "../../editor/workspaceFileSearchModel";
import { MenuCheckboxItem, MenuContent, MenuRoot, MenuTrigger } from "../../ui/Menu";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceFileTabLabels } from "../workspaceDisplayTitles";
import { getWorkspaceFilePresentation } from "../workspaceFilePresentation";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import type { WorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import { getKnowledgePanelCopy } from "../knowledgePanelLocale";

type WorkspaceDeepSearchProps = {
  copy: WorkspaceInterfaceCopy["sidePanel"]["search"];
  paletteCopy: WorkspaceInterfaceCopy["sidePanel"]["commandPalette"];
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  index?: WorkspaceKnowledgeIndex;
  language: WorkspaceLanguage;
  onBack: () => void;
  onSelectFile: (fileId: string) => void;
};

type FacetSectionProps = {
  facets: readonly MetadataFacet[];
  emptyMessage: string;
  label: string;
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
};

function FacetSection({
  facets,
  emptyMessage,
  label,
  selected,
  onToggle,
}: FacetSectionProps) {
  return (
    <section className="workspace-deep-search-facet" aria-label={label}>
      <h3>{label}</h3>
      <div>
        {facets.length === 0 ? (
          <p>{emptyMessage}</p>
        ) : facets.map((facet) => (
          <button
            type="button"
            key={facet.value}
            aria-pressed={selected.has(facet.value)}
            onClick={() => onToggle(facet.value)}
          >
            <span aria-hidden="true"><Check size={12} /></span>
            <span>{facet.value}</span>
            <span>{facet.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const HighlightedText = ({
  children,
  query,
  caseSensitive,
  enabled,
}: {
  children: string;
  query: string;
  caseSensitive: boolean;
  enabled: boolean;
}) => {
  const needle = query.trim();
  if (!enabled || !needle) return children;
  const source = caseSensitive ? children : children.toLocaleLowerCase();
  const target = caseSensitive ? needle : needle.toLocaleLowerCase();
  const index = source.indexOf(target);
  if (index < 0) return children;
  return (
    <>
      {children.slice(0, index)}
      <mark>{children.slice(index, index + needle.length)}</mark>
      {children.slice(index + needle.length)}
    </>
  );
};

export function WorkspaceDeepSearch({
  copy,
  paletteCopy,
  files,
  folders,
  index,
  language,
  onBack,
  onSelectFile,
}: WorkspaceDeepSearchProps) {
  const labels = getWorkspaceChromeCopy(language).documentControls;
  const metadataCopy = getKnowledgePanelCopy(language);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [options, setOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterViewOpen, setFilterViewOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
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
  const filesById = useMemo(
    () => new Map(files.map((file) => [file.id, file])),
    [files],
  );
  const searchEntries = useMemo(
    () => files.map((file): WorkspaceFileSearchEntry => {
      const analysis = index?.analysesByDocumentId.get(file.id);
      const metadata = analysis?.knowledgeMetadata;
      const presentation = getWorkspaceFilePresentation(file);
      return {
        fileId: file.id,
        displayPath: stripMarkdownExtension(
          fileLabels.get(file.id)?.fullPath ?? file.title,
        ),
        title: analysis?.title,
        description: metadata?.description,
        type: metadata?.type ?? (
          presentation.kind === "asset" ? presentation.format : undefined
        ),
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
        markdown: presentation.kind === "markdown" || presentation.viewer === "text"
          ? file.text
          : undefined,
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
  const hasFilters = selectedTypes.size > 0 ||
    selectedTags.size > 0 ||
    selectedStatuses.size > 0 ||
    selectedTrustTiers.size > 0 ||
    selectedFreshness.size > 0;
  const filters = useMemo(() => ({
    types: selectedTypes,
    tags: selectedTags,
    statuses: selectedStatuses,
    trustTiers: selectedTrustTiers,
    freshness: selectedFreshness,
  }), [
    selectedFreshness,
    selectedStatuses,
    selectedTags,
    selectedTrustTiers,
    selectedTypes,
  ]);
  const result = useMemo(
    () => searchWorkspaceFiles(searchEntries, deferredQuery, options, filters),
    [deferredQuery, filters, options, searchEntries],
  );
  const matchesByFileId = useMemo(
    () => new Map(result.matches.map((match) => [match.file.fileId, match])),
    [result.matches],
  );
  const hasQuery = deferredQuery.trim().length > 0;
  const visibleFiles = hasQuery || hasFilters ? result.files : [];
  const hasActiveOptions = Object.values(options).some(Boolean);

  useEffect(() => setActiveIndex(0), [deferredQuery, hasFilters]);

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
  useEffect(() => keepAvailable(statusFacets, setSelectedStatuses), [statusFacets]);
  useEffect(() => keepAvailable(trustFacets, setSelectedTrustTiers), [trustFacets]);
  useEffect(() => keepAvailable(freshnessFacets, setSelectedFreshness), [freshnessFacets]);

  const toggleFacet = <TValue extends string>(
    setSelected: Dispatch<SetStateAction<Set<TValue>>>,
    value: TValue,
  ) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
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
  const moveActive = (offset: -1 | 1) => {
    if (visibleFiles.length === 0) return;
    setActiveIndex((current) => {
      const next = (current + offset + visibleFiles.length) % visibleFiles.length;
      window.requestAnimationFrame(() => {
        document.getElementById(`workspace-search-result-${next}`)?.scrollIntoView({
          block: "nearest",
        });
      });
      return next;
    });
  };
  const selectActive = () => {
    const file = visibleFiles[Math.min(activeIndex, visibleFiles.length - 1)];
    if (file) onSelectFile(file.fileId);
  };
  const filterChip = (
    prefix: string,
    value: string,
    onRemove: () => void,
  ) => (
    <button type="button" key={`${prefix}-${value}`} onClick={onRemove}>
      <span>{prefix}: {value}</span>
      <X size={11} aria-hidden="true" />
    </button>
  );

  if (filterViewOpen) {
    return (
      <section className="workspace-deep-search filter-view">
        <header className="workspace-deep-search-filter-header">
          <button type="button" aria-label={copy.backToResults} onClick={() => setFilterViewOpen(false)}>
            <ArrowLeft size={16} />
          </button>
          <h2>{copy.filters}</h2>
          <button type="button" disabled={!hasFilters} onClick={clearFilters}>
            {copy.clearFilters}
          </button>
        </header>
        <div className="workspace-deep-search-filter-scroll">
          <FacetSection
            facets={typeFacets}
            emptyMessage={copy.noFacetValues}
            label={copy.types}
            selected={selectedTypes}
            onToggle={(value) => toggleFacet(setSelectedTypes, value)}
          />
          <FacetSection
            facets={tagFacets}
            emptyMessage={copy.noFacetValues}
            label={copy.tags}
            selected={selectedTags}
            onToggle={(value) => toggleFacet(setSelectedTags, value)}
          />
          <FacetSection
            facets={statusFacets}
            emptyMessage={copy.noFacetValues}
            label={metadataCopy.status}
            selected={selectedStatuses}
            onToggle={(value) => toggleFacet(setSelectedStatuses, value as OkfLifecycleStatus)}
          />
          <FacetSection
            facets={trustFacets}
            emptyMessage={copy.noFacetValues}
            label={metadataCopy.trust}
            selected={selectedTrustTiers}
            onToggle={(value) => toggleFacet(setSelectedTrustTiers, value as OkfTrustTier)}
          />
          <FacetSection
            facets={freshnessFacets}
            emptyMessage={copy.noFacetValues}
            label={metadataCopy.freshness}
            selected={selectedFreshness}
            onToggle={(value) => toggleFacet(setSelectedFreshness, value as OkfFreshness)}
          />
        </div>
        <footer className="workspace-deep-search-filter-footer">
          <button type="button" onClick={() => setFilterViewOpen(false)}>
            {copy.showDocuments(visibleFiles.length)}
          </button>
        </footer>
      </section>
    );
  }

  return (
    <section className="workspace-deep-search">
      <header className="workspace-deep-search-header">
        <button
          className="workspace-deep-search-back"
          type="button"
          aria-label={copy.backToLauncher}
          data-tooltip={copy.backToLauncher}
          onClick={onBack}
        >
          <ArrowLeft size={16} />
        </button>
        <label className="workspace-deep-search-field">
          <Search size={18} aria-hidden="true" />
          <input
            data-modal-initial-focus
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-label={copy.label}
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="workspace-deep-search-results"
            aria-activedescendant={visibleFiles.length > 0
              ? `workspace-search-result-${Math.min(activeIndex, visibleFiles.length - 1)}`
              : undefined}
            placeholder={copy.label}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                moveActive(event.key === "ArrowDown" ? 1 : -1);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                selectActive();
              }
            }}
          />
        </label>
        {files.length > 0 && <div className="workspace-deep-search-controls">
          <button
            type="button"
            aria-label={copy.filters}
            aria-pressed={hasFilters}
            onClick={() => setFilterViewOpen(true)}
          >
            <ListFilter size={15} />
            <span>{copy.filters}</span>
          </button>
          <MenuRoot open={settingsOpen} onOpenChange={setSettingsOpen}>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label={copy.settings}
                aria-pressed={hasActiveOptions}
              >
                <SlidersHorizontal size={15} />
                <span>{copy.settings}</span>
              </button>
            </MenuTrigger>
            <MenuContent className="workspace-deep-search-settings" ariaLabel={copy.settings}>
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
        </div>}
      </header>

      {hasFilters && (
        <div className="workspace-deep-search-chips" aria-label={copy.filters}>
          {[...selectedTypes].map((value) => filterChip(copy.types.slice(0, -1), value, () =>
            toggleFacet(setSelectedTypes, value)))}
          {[...selectedTags].map((value) => filterChip(copy.tags.slice(0, -1), value, () =>
            toggleFacet(setSelectedTags, value)))}
          {[...selectedStatuses].map((value) => filterChip(metadataCopy.status, value, () =>
            toggleFacet(setSelectedStatuses, value)))}
          {[...selectedTrustTiers].map((value) => filterChip(metadataCopy.trust, value, () =>
            toggleFacet(setSelectedTrustTiers, value)))}
          {[...selectedFreshness].map((value) => filterChip(metadataCopy.freshness, value, () =>
            toggleFacet(setSelectedFreshness, value)))}
        </div>
      )}

      <div
        className="workspace-deep-search-results"
        id="workspace-deep-search-results"
        role="listbox"
      >
        {!hasQuery && !hasFilters ? (
          <div className="workspace-deep-search-empty">
            <Search size={18} aria-hidden="true" />
            <p>{files.length === 0 ? copy.noDocuments : copy.hint}</p>
          </div>
        ) : result.error ? (
          <p className="workspace-deep-search-message error">{result.error}</p>
        ) : visibleFiles.length === 0 ? (
          <p className="workspace-deep-search-message">{copy.noMatches}</p>
        ) : visibleFiles.map((file, index) => {
          const match = matchesByFileId.get(file.fileId);
          const title = file.title?.trim() || file.displayPath.split("/").at(-1) || file.displayPath;
          const path = file.displayPath === title ? undefined : file.displayPath;
          const context = getVisibleContext(match, title, file.displayPath);
          const presentation = getWorkspaceFilePresentation(
            filesById.get(file.fileId) ?? {
              title: file.displayPath,
              text: file.markdown ?? "",
            },
          );
          const selected = activeIndex === index;
          return (
            <button
              className="workspace-deep-search-result"
              id={`workspace-search-result-${index}`}
              type="button"
              role="option"
              key={file.fileId}
              aria-selected={selected}
              data-active={selected || undefined}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => onSelectFile(file.fileId)}
            >
              <span className="workspace-deep-search-result-icon" aria-hidden="true">
                {presentation.kind === "markdown" ? <FileText size={16} /> : <File size={16} />}
              </span>
              <span className="workspace-deep-search-result-copy">
                <span className="workspace-deep-search-result-title">
                  <HighlightedText
                    query={deferredQuery}
                    caseSensitive={options.caseSensitive}
                    enabled={!options.regexp && match?.field === "title"}
                  >
                    {title}
                  </HighlightedText>
                </span>
                {path && (
                  <span className="workspace-deep-search-result-path">
                    <HighlightedText
                      query={deferredQuery}
                      caseSensitive={options.caseSensitive}
                      enabled={!options.regexp && match?.field === "path"}
                    >
                      {path}
                    </HighlightedText>
                  </span>
                )}
                {context && (
                  <span className="workspace-deep-search-result-context">
                    <HighlightedText
                      query={deferredQuery}
                      caseSensitive={options.caseSensitive}
                      enabled={!options.regexp}
                    >
                      {context}
                    </HighlightedText>
                  </span>
                )}
              </span>
              {match && (
                <span className="workspace-deep-search-result-kind">
                  {copy.matchLabels[match.field]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <footer className="workspace-deep-search-footer">
        <span>{hasQuery || hasFilters ? copy.documentCount(visibleFiles.length) : ""}</span>
        <span aria-hidden="true">
          <span><ArrowUp size={12} /><ArrowDown size={12} /> {paletteCopy.navigate}</span>
          <span><CornerDownLeft size={12} /> {paletteCopy.open}</span>
        </span>
      </footer>
    </section>
  );
}

const getVisibleContext = (
  match: WorkspaceFileSearchMatch | undefined,
  title: string,
  path: string,
) => {
  if (!match?.snippet || match.field === "title" || match.field === "path") return undefined;
  const snippet = match.snippet.trim();
  if (!snippet || snippet === title || snippet === path) return undefined;
  return snippet;
};
