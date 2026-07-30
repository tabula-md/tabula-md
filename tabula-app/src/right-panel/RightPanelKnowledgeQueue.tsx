import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  OkfFreshness,
  OkfLifecycleStatus,
  OkfTrustTier,
  WorkspaceKnowledgeHealthIssueCode,
} from "@tabula-md/tabula";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListFilter,
} from "lucide-react";
import {
  getMetadataFacets,
  type MetadataFacet,
} from "../editor/workspaceFileSearchModel";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";
import type { KnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import {
  createWorkspaceKnowledgeReviewFilters,
  filterWorkspaceKnowledgeReviewEntries,
  sortWorkspaceKnowledgeReviewEntries,
  type WorkspaceKnowledgeReviewEntry,
  type WorkspaceKnowledgeReviewSort,
} from "../workspace/workspaceKnowledgeReviewQueueModel";
import { PanelEmptyState } from "./PanelEmptyState";

type RightPanelKnowledgeQueueProps = {
  activeFileId: string;
  compatibilityCopy: KnowledgeCompatibilityCopy;
  copy: KnowledgePanelCopy;
  entries: readonly WorkspaceKnowledgeReviewEntry[];
  onBack: () => void;
  onSelectFile: (fileId: string) => void;
};

type FacetSectionProps<TValue extends string> = {
  facets: readonly MetadataFacet<TValue>[];
  label: string;
  selected: ReadonlySet<TValue>;
  valueLabel: (value: TValue) => string;
  onToggle: (value: TValue) => void;
};

const toggleSetValue = <TValue extends string>(
  setter: Dispatch<SetStateAction<Set<TValue>>>,
  value: TValue,
) => setter((current) => {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
});

function FacetSection<TValue extends string>({
  facets,
  label,
  selected,
  valueLabel,
  onToggle,
}: FacetSectionProps<TValue>) {
  if (facets.length === 0) return null;
  return (
    <section className="right-knowledge-queue-facet" aria-label={label}>
      <h3>{label}</h3>
      <div>
        {facets.map((facet) => (
          <button
            type="button"
            key={facet.value}
            aria-pressed={selected.has(facet.value)}
            onClick={() => onToggle(facet.value)}
          >
            <span className="right-knowledge-queue-facet-check" aria-hidden="true">
              <Check size={11} />
            </span>
            <span>{valueLabel(facet.value)}</span>
            <span>{facet.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const priorityClass = (entry: WorkspaceKnowledgeReviewEntry) =>
  `priority-${entry.priority}`;

export function RightPanelKnowledgeQueue({
  activeFileId,
  compatibilityCopy,
  copy,
  entries,
  onBack,
  onSelectFile,
}: RightPanelKnowledgeQueueProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<WorkspaceKnowledgeReviewSort>("severity");
  const [lifecycle, setLifecycle] = useState<Set<OkfLifecycleStatus>>(
    () => new Set(),
  );
  const [trust, setTrust] = useState<Set<OkfTrustTier>>(() => new Set());
  const [freshness, setFreshness] = useState<Set<OkfFreshness>>(
    () => new Set(),
  );
  const [healthIssues, setHealthIssues] = useState<
    Set<WorkspaceKnowledgeHealthIssueCode>
  >(() => new Set());
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const filters = useMemo(
    () => createWorkspaceKnowledgeReviewFilters({
      lifecycle,
      trust,
      freshness,
      healthIssues,
    }),
    [freshness, healthIssues, lifecycle, trust],
  );
  const visibleEntries = useMemo(
    () => sortWorkspaceKnowledgeReviewEntries(
      filterWorkspaceKnowledgeReviewEntries(entries, filters),
      sort,
    ),
    [entries, filters, sort],
  );
  const lifecycleFacets = useMemo(
    () => getMetadataFacets(entries, (entry) => entry.lifecycle),
    [entries],
  );
  const trustFacets = useMemo(
    () => getMetadataFacets(entries, (entry) => entry.trust),
    [entries],
  );
  const freshnessFacets = useMemo(
    () => getMetadataFacets(entries, (entry) => entry.freshness),
    [entries],
  );
  const healthFacets = useMemo(
    () => getMetadataFacets(
      entries,
      (entry) => entry.healthIssues.map((issue) => issue.code),
    ),
    [entries],
  );
  const activeIndex = visibleEntries.findIndex(
    (entry) => entry.documentId === activeFileId,
  );
  useEffect(() => {
    rowRefs.current.get(activeFileId)?.scrollIntoView({ block: "nearest" });
  }, [activeFileId, visibleEntries]);
  const hasFilters = lifecycle.size > 0 ||
    trust.size > 0 ||
    freshness.size > 0 ||
    healthIssues.size > 0;
  const resetFilters = () => {
    setLifecycle(new Set());
    setTrust(new Set());
    setFreshness(new Set());
    setHealthIssues(new Set());
  };
  const selectRelative = (offset: -1 | 1) => {
    if (visibleEntries.length === 0) return;
    const nextIndex = activeIndex < 0
      ? 0
      : Math.min(
          visibleEntries.length - 1,
          Math.max(0, activeIndex + offset),
        );
    const entry = visibleEntries[nextIndex];
    if (entry) onSelectFile(entry.documentId);
  };

  return (
    <section
      className="right-knowledge-queue"
      aria-labelledby="right-knowledge-queue-title"
    >
      <header className="right-knowledge-queue-header">
        <button
          type="button"
          aria-label={copy.backToDocument}
          title={copy.backToDocument}
          onClick={onBack}
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <span>
          <h2 id="right-knowledge-queue-title">{copy.reviewQueue}</h2>
          <small>{copy.reviewQueueDescription}</small>
        </span>
      </header>

      <div className="right-knowledge-queue-controls">
        <button
          type="button"
          className={hasFilters ? "active" : ""}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((current) => !current)}
        >
          <ListFilter size={14} aria-hidden="true" />
          <span>{filtersOpen ? copy.closeFilters : copy.filters}</span>
          {hasFilters && <span className="right-knowledge-queue-filter-count">
            {lifecycle.size + trust.size + freshness.size + healthIssues.size}
          </span>}
        </button>
        <label>
          <span>{copy.sortBy}</span>
          <select
            aria-label={copy.sortBy}
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as WorkspaceKnowledgeReviewSort);
            }}
          >
            <option value="severity">{copy.sortSeverity}</option>
            <option value="review-date">{copy.sortReviewDate}</option>
            <option value="path">{copy.sortPath}</option>
            <option value="owner">{copy.sortOwner}</option>
          </select>
        </label>
      </div>

      {filtersOpen && (
        <div className="right-knowledge-queue-filters">
          <div className="right-knowledge-queue-filter-actions">
            <span>{copy.showResults(visibleEntries.length)}</span>
            <button type="button" disabled={!hasFilters} onClick={resetFilters}>
              {copy.clearFilters}
            </button>
          </div>
          <FacetSection
            facets={lifecycleFacets}
            label={copy.lifecycle}
            selected={lifecycle}
            valueLabel={copy.lifecycleLabel}
            onToggle={(value) => toggleSetValue(setLifecycle, value)}
          />
          <FacetSection
            facets={trustFacets}
            label={copy.trust}
            selected={trust}
            valueLabel={copy.trustLabel}
            onToggle={(value) => toggleSetValue(setTrust, value)}
          />
          <FacetSection
            facets={freshnessFacets}
            label={copy.freshness}
            selected={freshness}
            valueLabel={copy.freshnessLabel}
            onToggle={(value) => toggleSetValue(setFreshness, value)}
          />
          <FacetSection
            facets={healthFacets}
            label={copy.healthIssue}
            selected={healthIssues}
            valueLabel={copy.healthIssueLabel}
            onToggle={(value) => toggleSetValue(setHealthIssues, value)}
          />
        </div>
      )}

      <div className="right-knowledge-queue-list">
        {visibleEntries.length === 0 ? (
          <PanelEmptyState>{copy.noReviewDocuments}</PanelEmptyState>
        ) : visibleEntries.map((entry) => {
          const messages = [
            ...(entry.lifecycleConcern && entry.lifecycle
              ? [`${copy.lifecycle}: ${copy.lifecycleLabel(entry.lifecycle)}`]
              : []),
            ...(entry.trustConcern && entry.trust
              ? [`${copy.trust}: ${copy.trustLabel(entry.trust)}`]
              : []),
            ...(entry.freshnessConcern && entry.freshness
              ? [`${copy.freshness}: ${copy.freshnessLabel(entry.freshness)}`]
              : []),
            ...entry.compatibilityIssues.map(compatibilityCopy.issue),
            ...entry.healthIssues.map(compatibilityCopy.healthIssue),
          ].filter((message, index, all) => all.indexOf(message) === index);
          const priorityLabel = entry.priority === "required"
            ? copy.priorityRequired
            : entry.priority === "attention"
            ? copy.priorityAttention
            : copy.priorityNotice;
          return (
            <button
              ref={(button) => {
                if (button) rowRefs.current.set(entry.documentId, button);
                else rowRefs.current.delete(entry.documentId);
              }}
              type="button"
              className={`right-knowledge-queue-row ${priorityClass(entry)}`}
              key={entry.documentId}
              aria-current={entry.documentId === activeFileId ? "page" : undefined}
              onClick={() => onSelectFile(entry.documentId)}
            >
              <span className="right-knowledge-queue-row-heading">
                <FileText size={14} aria-hidden="true" />
                <strong>{entry.title}</strong>
                <span>{priorityLabel}</span>
              </span>
              <span className="right-knowledge-queue-path">{entry.path}</span>
              {(entry.owner || entry.reviewDate) && (
                <span className="right-knowledge-queue-metadata">
                  {entry.owner && `${copy.owner}: ${entry.owner}`}
                  {entry.owner && entry.reviewDate && " · "}
                  {entry.reviewDate && `${copy.reviewDate}: ${entry.reviewDate}`}
                </span>
              )}
              <span className="right-knowledge-queue-issues">
                {messages.map((message) => <span key={message}>{message}</span>)}
              </span>
            </button>
          );
        })}
      </div>

      <footer className="right-knowledge-queue-navigation">
        <button
          type="button"
          aria-label={copy.previousDocument}
          title={copy.previousDocument}
          disabled={visibleEntries.length === 0 || activeIndex === 0}
          onClick={() => selectRelative(-1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span>
          {copy.reviewPosition(
            activeIndex >= 0 ? activeIndex + 1 : 0,
            visibleEntries.length,
          )}
        </span>
        <button
          type="button"
          aria-label={copy.nextDocument}
          title={copy.nextDocument}
          disabled={
            visibleEntries.length === 0 ||
            activeIndex === visibleEntries.length - 1
          }
          onClick={() => selectRelative(1)}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}
