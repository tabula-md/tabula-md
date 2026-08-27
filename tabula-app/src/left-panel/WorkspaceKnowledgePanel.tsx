import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CircleOff, Search, SlidersHorizontal, X } from "lucide-react";
import { WorkspaceFileTypeIcon } from "../workspace/components/WorkspaceFileTypeIcon";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import {
  createWorkspaceKnowledgeFieldFilter,
  EMPTY_KNOWLEDGE_FACET_VALUE,
  getWorkspaceKnowledgeConceptDocuments,
  getWorkspaceKnowledgeDocumentReason,
  isWorkspaceKnowledgeFieldFilterActive,
  sanitizeWorkspaceKnowledgeFilters,
  type WorkspaceKnowledgeBrowseModel,
  type WorkspaceKnowledgeFacetField,
  type WorkspaceKnowledgeFieldFilter,
  type WorkspaceKnowledgeFilters,
} from "../workspace/workspaceKnowledgeBrowseModel";
import type { WorkspaceSearchIndexEntry } from "../workspace/workspaceSearchIndex";

type WorkspaceKnowledgePanelProps = {
  activeFileId: string;
  copy: WorkspaceInterfaceCopy["sidePanel"]["knowledge"];
  entries: readonly WorkspaceSearchIndexEntry[];
  filters: WorkspaceKnowledgeFilters;
  model: WorkspaceKnowledgeBrowseModel;
  onFiltersChange: (filters: WorkspaceKnowledgeFilters) => void;
  onSelectFile: (fileId: string) => void;
};

const emptyFilters = (): WorkspaceKnowledgeFilters => ({ fields: {} });

const cloneFieldFilter = (filter: WorkspaceKnowledgeFieldFilter): WorkspaceKnowledgeFieldFilter =>
  filter.kind === "select" ? { ...filter, values: [...filter.values] } : { ...filter };

const cloneFilters = (filters: WorkspaceKnowledgeFilters): WorkspaceKnowledgeFilters => ({
  fields: Object.fromEntries(
    Object.entries(filters.fields).map(([fieldKey, filter]) => [
      fieldKey,
      cloneFieldFilter(filter),
    ]),
  ),
});

const getFilterCount = (filters: WorkspaceKnowledgeFilters) =>
  Object.values(filters.fields).reduce((count, filter) => {
    if (filter.kind === "select") return count + filter.values.length;
    return count + (isWorkspaceKnowledgeFieldFilterActive(filter) ? 1 : 0);
  }, 0);

export function WorkspaceKnowledgePanel({
  activeFileId,
  copy,
  entries,
  filters,
  model,
  onFiltersChange,
  onSelectFile,
}: WorkspaceKnowledgePanelProps) {
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFilterFocusRef = useRef(false);
  const [query, setQuery] = useState("");
  const [draftFilters, setDraftFilters] = useState<WorkspaceKnowledgeFilters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>();
  const concepts = useMemo(
    () => getWorkspaceKnowledgeConceptDocuments(entries, model, query, filters),
    [entries, filters, model, query],
  );
  const activeFilterCount = getFilterCount(filters);
  const draftFilterCount = getFilterCount(draftFilters);
  const hasQueryOrFilters = Boolean(query.trim() || activeFilterCount);
  const selectedField = model.fields.find((field) => field.key === selectedFieldKey);
  const selectedFilter = selectedField
    ? draftFilters.fields[selectedField.key] ?? createWorkspaceKnowledgeFieldFilter(selectedField)
    : undefined;
  const suggestedFields = model.fields.filter(({ suggested }) => suggested);
  const otherFields = model.fields.filter(({ suggested }) => !suggested);

  const setFieldFilter = (fieldKey: string, filter?: WorkspaceKnowledgeFieldFilter) => {
    setDraftFilters((current) => {
      const fields = { ...current.fields };
      if (filter) fields[fieldKey] = filter;
      else delete fields[fieldKey];
      return { fields };
    });
  };
  const toggleSelectFilter = (fieldKey: string, valueKey: string) => {
    const current = draftFilters.fields[fieldKey];
    const selected = current?.kind === "select" ? current.values : [];
    const values = selected.includes(valueKey)
      ? selected.filter((value) => value !== valueKey)
      : [...selected, valueKey];
    setFieldFilter(fieldKey, values.length > 0 ? { kind: "select", values } : undefined);
  };
  const removeFilter = (fieldKey: string, valueKey?: string) => {
    const current = filters.fields[fieldKey];
    if (!current) return;
    const fields = { ...filters.fields };
    if (current.kind === "select" && valueKey) {
      const values = current.values.filter((value) => value !== valueKey);
      if (values.length > 0) fields[fieldKey] = { ...current, values };
      else delete fields[fieldKey];
    } else {
      delete fields[fieldKey];
    }
    onFiltersChange({ fields });
  };
  const getValueLabel = (value: { key: string; label: string }) =>
    value.key === EMPTY_KNOWLEDGE_FACET_VALUE ? copy.emptyValue : value.label;
  const renderValueLabel = (value: { key: string; label: string }) => (
    value.key === EMPTY_KNOWLEDGE_FACET_VALUE ? (
      <span className="left-panel-knowledge-no-value">
        <CircleOff size={13} aria-hidden="true" />
        <span>{copy.emptyValue}</span>
      </span>
    ) : <span>{value.label}</span>
  );
  const getConditionLabel = (
    field: WorkspaceKnowledgeFacetField,
    filter: Exclude<WorkspaceKnowledgeFieldFilter, { kind: "select" }>,
  ) => {
    const value = filter.operator === "empty"
      ? copy.emptyValue
      : filter.kind === "boolean"
        ? filter.value ? copy.trueValue : copy.falseValue
        : filter.value;
    return [field.label, value].filter(Boolean).join(" · ");
  };
  const activeFacets = model.fields.flatMap((field): Array<{
    field: WorkspaceKnowledgeFacetField;
    key: string;
    label: string;
    noValue: boolean;
    valueKey?: string;
  }> => {
    const filter = filters.fields[field.key];
    if (!filter || !isWorkspaceKnowledgeFieldFilterActive(filter)) return [];
    if (filter.kind !== "select") {
      return [{
        field,
        key: field.key,
        label: getConditionLabel(field, filter),
        noValue: filter.operator === "empty",
      }];
    }
    return field.values.filter((value) => filter.values.includes(value.key)).map((value) => ({
      field,
      key: `${field.key}:${value.key}`,
      label: `${field.label} · ${getValueLabel(value)}`,
      noValue: value.key === EMPTY_KNOWLEDGE_FACET_VALUE,
      valueKey: value.key,
    }));
  });
  const closeFilters = () => {
    restoreFilterFocusRef.current = true;
    setFilterOpen(false);
    setSelectedFieldKey(undefined);
  };
  const applyFilters = () => {
    onFiltersChange(sanitizeWorkspaceKnowledgeFilters(draftFilters, model));
    closeFilters();
  };
  const openFilters = () => {
    setDraftFilters(cloneFilters(filters));
    setFilterOpen(true);
    setSelectedFieldKey(undefined);
  };

  useLayoutEffect(() => {
    if (filterOpen || !restoreFilterFocusRef.current) return;
    restoreFilterFocusRef.current = false;
    filterButtonRef.current?.focus();
  }, [filterOpen]);

  useEffect(() => {
    if (selectedFieldKey && !selectedField) setSelectedFieldKey(undefined);
  }, [selectedField, selectedFieldKey]);

  useEffect(() => {
    const sanitized = sanitizeWorkspaceKnowledgeFilters(filters, model);
    if (JSON.stringify(sanitized) !== JSON.stringify(filters)) onFiltersChange(sanitized);
  }, [filters, model, onFiltersChange]);

  useEffect(() => {
    if (!filterOpen) return;
    const dismissWithKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (selectedFieldKey) {
        setSelectedFieldKey(undefined);
        return;
      }
      closeFilters();
    };
    document.addEventListener("keydown", dismissWithKeyboard, true);
    return () => document.removeEventListener("keydown", dismissWithKeyboard, true);
  }, [filterOpen, selectedFieldKey]);

  const renderFieldRows = (fields: readonly WorkspaceKnowledgeFacetField[]) => fields.map((field) => {
    const filter = draftFilters.fields[field.key];
    return (
      <button key={field.key} type="button" onClick={() => setSelectedFieldKey(field.key)}>
        <span>{field.label}</span>
        <span className="left-panel-knowledge-filter-field-status">
          {isWorkspaceKnowledgeFieldFilterActive(filter)
            ? <Check size={13} aria-hidden="true" />
            : null}
          <ChevronRight size={13} aria-hidden="true" />
        </span>
      </button>
    );
  });

  const renderConditionEditor = () => {
    if (!selectedField || !selectedFilter) return null;
    if (selectedFilter.kind === "select") {
      return (
        <div className="left-panel-knowledge-filter-menu values" role="group" aria-label={selectedField.label}>
          {selectedField.values.map((value) => {
            const pressed = selectedFilter.values.includes(value.key);
            return (
              <button
                key={value.key}
                type="button"
                aria-label={value.key === EMPTY_KNOWLEDGE_FACET_VALUE
                  ? `${selectedField.label} · ${copy.emptyValue}`
                  : value.label}
                aria-pressed={pressed}
                onClick={() => toggleSelectFilter(selectedField.key, value.key)}
              >
                {renderValueLabel(value)}
                <span className="left-panel-knowledge-filter-check">
                  {pressed && <Check size={13} aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    const isValueSelected = (value: WorkspaceKnowledgeFacetField["values"][number]) => {
      if (value.key === EMPTY_KNOWLEDGE_FACET_VALUE) return selectedFilter.operator === "empty";
      if (selectedFilter.kind === "text") {
        return selectedFilter.operator === "equals" && selectedFilter.value === value.label;
      }
      if (selectedFilter.kind === "date") {
        return selectedFilter.operator === "on" &&
          selectedFilter.value.slice(0, 10) === value.label.slice(0, 10);
      }
      if (selectedFilter.kind === "number") {
        return selectedFilter.operator === "equals" && selectedFilter.value === value.label;
      }
      return selectedFilter.operator === "equals" &&
        selectedFilter.value === (value.key === "boolean:true");
    };
    const selectValue = (value: WorkspaceKnowledgeFacetField["values"][number]) => {
      if (isValueSelected(value)) {
        setFieldFilter(selectedField.key);
        return;
      }
      if (value.key === EMPTY_KNOWLEDGE_FACET_VALUE) {
        if (selectedFilter.kind === "text") {
          setFieldFilter(selectedField.key, { kind: "text", operator: "empty", value: "" });
        } else if (selectedFilter.kind === "date") {
          setFieldFilter(selectedField.key, { kind: "date", operator: "empty", value: "" });
        } else if (selectedFilter.kind === "number") {
          setFieldFilter(selectedField.key, { kind: "number", operator: "empty", value: "" });
        } else {
          setFieldFilter(selectedField.key, { kind: "boolean", operator: "empty" });
        }
        return;
      }
      if (selectedFilter.kind === "text") {
        setFieldFilter(selectedField.key, { kind: "text", operator: "equals", value: value.label });
      } else if (selectedFilter.kind === "date") {
        setFieldFilter(selectedField.key, { kind: "date", operator: "on", value: value.label.slice(0, 10) });
      } else if (selectedFilter.kind === "number") {
        setFieldFilter(selectedField.key, { kind: "number", operator: "equals", value: value.label });
      } else {
        setFieldFilter(selectedField.key, {
          kind: "boolean",
          operator: "equals",
          value: value.key === "boolean:true",
        });
      }
    };
    return (
      <div className="left-panel-knowledge-filter-menu values" role="group" aria-label={selectedField.label}>
        {selectedField.values.map((value) => {
          const pressed = isValueSelected(value);
          return (
            <button
              key={value.key}
              type="button"
              aria-label={value.key === EMPTY_KNOWLEDGE_FACET_VALUE
                ? `${selectedField.label} · ${copy.emptyValue}`
                : value.label}
              aria-pressed={pressed}
              onClick={() => selectValue(value)}
            >
              {renderValueLabel(value)}
              <span className="left-panel-knowledge-filter-check">
                {pressed && <Check size={13} aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <section className="left-panel-knowledge" aria-label={copy.label}>
      {filterOpen ? (
        <div className="left-panel-knowledge-filter-view" aria-label={copy.filters}>
          <header className="left-panel-knowledge-filter-header">
            <div>
              {selectedField ? (
                <button className="back" type="button" aria-label={copy.backToFields} onClick={() => setSelectedFieldKey(undefined)}>
                  <ChevronLeft size={14} aria-hidden="true" />
                  <span>{selectedField.label}</span>
                </button>
              ) : (
                <span>{copy.filters}</span>
              )}
            </div>
            <button className="close" type="button" aria-label={copy.closeFilters} data-tooltip={copy.closeFilters} onClick={closeFilters}>
              <X size={15} aria-hidden="true" />
            </button>
          </header>

          <div className="left-panel-knowledge-filter-content">
            {selectedField ? renderConditionEditor() : model.fields.length > 0 ? (
              <>
                {suggestedFields.length > 0 && (
                  <section className="left-panel-knowledge-filter-section" aria-label={copy.suggestedFields}>
                    <span>{copy.suggestedFields}</span>
                    <div className="left-panel-knowledge-filter-menu fields" role="group" aria-label={copy.suggestedFields}>
                      {renderFieldRows(suggestedFields)}
                    </div>
                  </section>
                )}
                {otherFields.length > 0 && (
                  <section className="left-panel-knowledge-filter-section" aria-label={copy.allFields}>
                    <span>{copy.allFields}</span>
                    <div className="left-panel-knowledge-filter-menu fields" role="group" aria-label={copy.allFields}>
                      {renderFieldRows(otherFields)}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <p className="left-panel-knowledge-filter-empty">{copy.noFilterFields}</p>
            )}
          </div>

          <footer className={`left-panel-knowledge-filter-footer${draftFilterCount > 0 ? " has-clear" : ""}`}>
            {draftFilterCount > 0 && (
              <button className="clear" type="button" onClick={() => setDraftFilters(emptyFilters())}>
                {copy.clearFilters}
              </button>
            )}
            <button className="apply" type="button" onClick={applyFilters}>{copy.applyFilters}</button>
          </footer>
        </div>
      ) : (
        <>
          <div className="left-panel-knowledge-toolbar">
            <label className="left-panel-knowledge-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                aria-label={copy.searchPlaceholder}
                placeholder={copy.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              ref={filterButtonRef}
              className={activeFilterCount > 0 ? "active" : undefined}
              type="button"
              aria-label={activeFilterCount > 0 ? copy.filters : copy.addFilter}
              aria-expanded={false}
              data-tooltip={activeFilterCount > 0 ? copy.filters : copy.addFilter}
              onClick={openFilters}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
            </button>
          </div>

          {activeFacets.length > 0 && (
            <div className="left-panel-knowledge-active-filters" aria-label={copy.filters}>
              {activeFacets.map(({ field, key, label, noValue, valueKey }) => (
                <button
                  key={key}
                  type="button"
                  aria-label={copy.removeFilter(label)}
                  data-tooltip={label}
                  onClick={() => removeFilter(field.key, valueKey)}
                >
                  {noValue && <CircleOff className="left-panel-knowledge-no-value-icon" size={12} aria-hidden="true" />}
                  <span>{label}</span>
                  <X size={11} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          <div className="left-panel-knowledge-list">
            {concepts.map((entry) => {
              const reason = getWorkspaceKnowledgeDocumentReason(entry, model, query, filters);
              return (
                <button
                  key={entry.fileId}
                  className={`left-panel-knowledge-concept${entry.fileId === activeFileId ? " active" : ""}`}
                  type="button"
                  aria-label={`${entry.title ?? entry.displayPath} · ${entry.displayPath}`}
                  onClick={() => onSelectFile(entry.fileId)}
                >
                  <span className="left-panel-knowledge-document-icon">
                    <WorkspaceFileTypeIcon kind="markdown" size={15} />
                  </span>
                  <span className="left-panel-knowledge-concept-content">
                    <span className="left-panel-knowledge-concept-title">{entry.title ?? entry.displayPath}</span>
                    {reason && <small>{reason}</small>}
                  </span>
                </button>
              );
            })}

            {concepts.length === 0 && (
              <p className="left-panel-knowledge-state">
                {hasQueryOrFilters ? copy.filteredEmpty : copy.noConcepts}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
