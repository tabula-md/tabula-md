import {
  Braces,
  Check,
  ChevronDown,
  Code2,
  Hash,
  List,
  MoreHorizontal,
  Plus,
  ToggleLeft,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  addFrontmatterValue,
  diffTextPatch,
  getFrontmatterProperties,
  removeFrontmatterValue,
  renameFrontmatterKey,
  updateFrontmatterValue,
  type FrontmatterProperty,
  type FrontmatterValueUpdate,
  type TextChange,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";
import type { MarkdownEditorHandle } from "./markdownEditorTypes";

const DEFAULT_VISIBLE_PROPERTY_COUNT = 5;

const propertyCopy = {
  en: {
    addProperty: "Add property",
    cancel: "Cancel",
    editInSource: "Edit in Source",
    empty: "Empty",
    fields: (count: number) => `${count} ${count === 1 ? "field" : "fields"}`,
    invalidKey: "Use letters, numbers, dots, dashes, or underscores.",
    items: (count: number) => `${count} ${count === 1 ? "item" : "items"}`,
    moreActions: (key: string) => `More actions for ${key}`,
    newItem: "New item",
    newPropertyName: "Property name",
    remove: "Remove property",
    removeItem: (value: string) => `Remove ${value}`,
    rename: "Rename property",
    save: "Save",
    showLess: "Show less",
    showMore: (count: number) => `Show ${count} more`,
    updateFailed: "Could not update this property. Open Source to repair the YAML.",
  },
  ko: {
    addProperty: "속성 추가",
    cancel: "취소",
    editInSource: "Source에서 편집",
    empty: "비어 있음",
    fields: (count: number) => `${count}개 필드`,
    invalidKey: "영문, 숫자, 점, 대시, 밑줄만 사용할 수 있습니다.",
    items: (count: number) => `${count}개 항목`,
    moreActions: (key: string) => `${key} 추가 작업`,
    newItem: "새 항목",
    newPropertyName: "속성 이름",
    remove: "속성 삭제",
    removeItem: (value: string) => `${value} 삭제`,
    rename: "속성 이름 변경",
    save: "저장",
    showLess: "접기",
    showMore: (count: number) => `${count}개 더 보기`,
    updateFailed: "속성을 수정하지 못했습니다. Source에서 YAML을 확인하세요.",
  },
};

const getCopy = (language: WorkspaceLanguage) =>
  language === "ko" ? propertyCopy.ko : propertyCopy.en;

const getPropertyIcon = (property: FrontmatterProperty) => {
  const props = { "aria-hidden": true, size: 16 } as const;
  switch (property.kind) {
    case "number":
      return <Hash {...props} />;
    case "boolean":
      return <ToggleLeft {...props} />;
    case "scalar-list":
    case "structured-list":
      return <List {...props} />;
    case "mapping":
      return <Braces {...props} />;
    default:
      return <Type {...props} />;
  }
};

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const getListItemFromInput = (items: unknown[], input: string) => {
  if (items.every((item) => typeof item === "string")) return input;
  if (items.every((item) => typeof item === "number")) {
    const next = Number(input);
    return Number.isFinite(next) ? next : undefined;
  }
  if (items.every((item) => typeof item === "boolean")) {
    if (input === "true") return true;
    if (input === "false") return false;
  }
  return undefined;
};

const closeActionMenu = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return;
  target.closest<HTMLDetailsElement>("details")?.removeAttribute("open");
};

export type DocumentPropertiesProps = {
  documentId: string;
  editorRef: React.RefObject<MarkdownEditorHandle | null>;
  language: WorkspaceLanguage;
  markdown: string;
  onChange: (nextValue: string | null, change?: TextChange) => void;
  onOpenSource?: () => void;
};

export function DocumentProperties({
  documentId,
  editorRef,
  language,
  markdown,
  onChange,
  onOpenSource,
}: DocumentPropertiesProps) {
  const copy = getCopy(language);
  const surfaceCopy = getWorkspaceSurfaceCopy(language);
  const model = useMemo(() => getFrontmatterProperties(markdown), [markdown]);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editorInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setExpanded(true);
    setShowAll(false);
    setEditingKey(null);
    setRenamingKey(null);
    setAdding(false);
    setError(null);
  }, [documentId]);

  useEffect(() => {
    editorInputRef.current?.focus();
    if (editorInputRef.current instanceof HTMLInputElement) {
      editorInputRef.current.select();
    }
  }, [adding, editingKey, renamingKey]);

  if (model.status !== "valid") return null;

  const applyResult = (result: FrontmatterValueUpdate) => {
    if (!result.ok) {
      setError(result.reason === "invalid_key" ? copy.invalidKey : copy.updateFailed);
      return false;
    }
    if (result.markdown === markdown) return true;
    const patch = diffTextPatch(markdown, result.markdown);
    const applied = editorRef.current?.applyLocalTextPatches([patch], undefined, {
      focus: false,
      isolateHistory: true,
    }) ?? false;
    if (!applied) onChange(result.markdown, { patches: [patch] });
    setError(null);
    return true;
  };

  const beginValueEdit = (property: FrontmatterProperty) => {
    if (property.kind !== "text" && property.kind !== "number") return;
    setEditingKey(property.key);
    setRenamingKey(null);
    setDraft(String(property.value ?? ""));
    setError(null);
  };

  const commitValueEdit = (property: FrontmatterProperty) => {
    if (editingKey !== property.key) return;
    let value: string | number = draft;
    if (property.kind === "number") {
      const number = Number(draft);
      if (!draft.trim() || !Number.isFinite(number)) {
        setError(copy.updateFailed);
        return;
      }
      value = number;
    }
    if (applyResult(updateFrontmatterValue(markdown, property.key, value))) {
      setEditingKey(null);
    }
  };

  const handleEditorKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    commit: () => void,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setEditingKey(null);
      setRenamingKey(null);
      setAdding(false);
      setError(null);
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit();
    }
  };

  const visibleProperties = showAll
    ? model.properties
    : model.properties.slice(0, DEFAULT_VISIBLE_PROPERTY_COUNT);
  const hiddenCount = model.properties.length - visibleProperties.length;

  return (
    <section className="document-properties" aria-label={surfaceCopy.frontmatter}>
      <button
        className="document-properties-heading"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <ChevronDown
          className="document-properties-chevron"
          size={16}
          aria-hidden="true"
        />
        <span>{surfaceCopy.frontmatter}</span>
        <span className="document-properties-count">{model.properties.length}</span>
      </button>

      {expanded && (
        <div className="document-properties-body">
          <div className="document-properties-list">
            {visibleProperties.map((property) => {
              const value = property.value;
              const isTagList = property.key.toLowerCase() === "tags" && isStringList(value);
              return (
                <div className="document-property-row" key={property.key}>
                  <span className="document-property-kind" title={property.kind}>
                    {getPropertyIcon(property)}
                  </span>

                  {renamingKey === property.key ? (
                    <input
                      ref={editorInputRef as React.RefObject<HTMLInputElement>}
                      className="document-property-key-input"
                      value={draft}
                      aria-label={copy.rename}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => {
                        if (!draft.trim() || draft.trim() === property.key) {
                          setRenamingKey(null);
                          return;
                        }
                        if (applyResult(renameFrontmatterKey(markdown, property.key, draft))) {
                          setRenamingKey(null);
                        }
                      }}
                      onKeyDown={(event) => handleEditorKeyDown(event, () => {
                        if (applyResult(renameFrontmatterKey(markdown, property.key, draft))) {
                          setRenamingKey(null);
                        }
                      })}
                    />
                  ) : (
                    <span className="document-property-key" title={property.key}>
                      {property.key}
                    </span>
                  )}

                  <div className="document-property-value">
                    {property.kind === "boolean" ? (
                      <label className="document-property-boolean">
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(event) => applyResult(updateFrontmatterValue(
                            markdown,
                            property.key,
                            event.target.checked,
                          ))}
                        />
                        <span>{String(value)}</span>
                      </label>
                    ) : property.kind === "text" || property.kind === "number" ? (
                      editingKey === property.key ? (
                        property.kind === "text" ? (
                          <textarea
                            ref={editorInputRef as React.RefObject<HTMLTextAreaElement>}
                            className="document-property-value-input"
                            rows={1}
                            value={draft}
                            aria-label={`${property.key} value`}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => commitValueEdit(property)}
                            onKeyDown={(event) => handleEditorKeyDown(
                              event,
                              () => commitValueEdit(property),
                            )}
                          />
                        ) : (
                          <input
                            ref={editorInputRef as React.RefObject<HTMLInputElement>}
                            className="document-property-value-input"
                            inputMode="decimal"
                            value={draft}
                            aria-label={`${property.key} value`}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => commitValueEdit(property)}
                            onKeyDown={(event) => handleEditorKeyDown(
                              event,
                              () => commitValueEdit(property),
                            )}
                          />
                        )
                      ) : (
                        <button
                          className="document-property-value-button"
                          type="button"
                          onClick={() => beginValueEdit(property)}
                        >
                          {String(value) || copy.empty}
                        </button>
                      )
                    ) : property.kind === "scalar-list" && Array.isArray(value) ? (
                      <div className="document-property-list-value">
                        {value.map((item, index) => (
                          <span
                            className={`document-property-chip${isTagList ? " tag" : ""}`}
                            key={`${String(item)}-${index}`}
                          >
                            {isTagList ? "#" : ""}{String(item)}
                            {property.editable && (
                              <button
                                type="button"
                                aria-label={copy.removeItem(String(item))}
                                onClick={() => applyResult(updateFrontmatterValue(
                                  markdown,
                                  property.key,
                                  value.filter((_, itemIndex) => itemIndex !== index),
                                ))}
                              >
                                <X size={13} aria-hidden="true" />
                              </button>
                            )}
                          </span>
                        ))}
                        {editingKey === property.key ? (
                          <input
                            ref={editorInputRef as React.RefObject<HTMLInputElement>}
                            className="document-property-chip-input"
                            value={draft}
                            placeholder={copy.newItem}
                            aria-label={`${copy.newItem}: ${property.key}`}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => {
                              if (!draft.trim()) {
                                setEditingKey(null);
                                return;
                              }
                              const nextItem = getListItemFromInput(value, draft.trim());
                              if (typeof nextItem === "undefined") {
                                setError(copy.updateFailed);
                                return;
                              }
                              if (applyResult(updateFrontmatterValue(
                                markdown,
                                property.key,
                                [...value, nextItem],
                              ))) setEditingKey(null);
                            }}
                            onKeyDown={(event) => handleEditorKeyDown(event, () => {
                              const nextItem = getListItemFromInput(value, draft.trim());
                              if (typeof nextItem === "undefined") {
                                setError(copy.updateFailed);
                                return;
                              }
                              if (applyResult(updateFrontmatterValue(
                                markdown,
                                property.key,
                                [...value, nextItem],
                              ))) setEditingKey(null);
                            })}
                          />
                        ) : property.editable ? (
                          <button
                            className="document-property-add-item"
                            type="button"
                            aria-label={`${copy.newItem}: ${property.key}`}
                            onClick={() => {
                              setEditingKey(property.key);
                              setDraft("");
                            }}
                          >
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    ) : property.kind === "empty" ? (
                      <span className="document-property-empty">{copy.empty}</span>
                    ) : (
                      <details className="document-property-structured">
                        <summary>
                          {property.kind === "mapping"
                            ? copy.fields(property.itemCount ?? 0)
                            : copy.items(property.itemCount ?? 0)}
                        </summary>
                        <pre>{JSON.stringify(value, null, 2)}</pre>
                      </details>
                    )}
                  </div>

                  <details className="document-property-actions">
                    <summary role="button" aria-label={copy.moreActions(property.key)}>
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </summary>
                    <div className="document-property-actions-menu">
                      <button
                        type="button"
                        onClick={(event) => {
                          closeActionMenu(event.currentTarget);
                          setRenamingKey(property.key);
                          setEditingKey(null);
                          setDraft(property.key);
                        }}
                      >
                        <Type size={15} aria-hidden="true" />
                        {copy.rename}
                      </button>
                      {onOpenSource && (
                        <button
                          type="button"
                          onClick={(event) => {
                            closeActionMenu(event.currentTarget);
                            onOpenSource();
                          }}
                        >
                          <Code2 size={15} aria-hidden="true" />
                          {copy.editInSource}
                        </button>
                      )}
                      <button
                        className="danger"
                        type="button"
                        onClick={(event) => {
                          closeActionMenu(event.currentTarget);
                          applyResult(removeFrontmatterValue(markdown, property.key));
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        {copy.remove}
                      </button>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>

          {model.properties.length > DEFAULT_VISIBLE_PROPERTY_COUNT && (
            <button
              className="document-properties-show-more"
              type="button"
              onClick={() => setShowAll((current) => !current)}
            >
              {showAll ? copy.showLess : copy.showMore(hiddenCount)}
            </button>
          )}

          {adding ? (
            <div className="document-property-add-form">
              <Type size={16} aria-hidden="true" />
              <input
                ref={editorInputRef as React.RefObject<HTMLInputElement>}
                value={newKey}
                placeholder={copy.newPropertyName}
                aria-label={copy.newPropertyName}
                onChange={(event) => setNewKey(event.target.value)}
                onKeyDown={(event) => handleEditorKeyDown(event, () => {
                  if (!newKey.trim()) return;
                  if (applyResult(addFrontmatterValue(markdown, newKey, ""))) {
                    const normalizedKey = newKey.trim();
                    setAdding(false);
                    setNewKey("");
                    setShowAll(true);
                    setEditingKey(normalizedKey);
                    setDraft("");
                  }
                })}
              />
              <button
                className="document-property-add-confirm"
                type="button"
                aria-label={copy.save}
                disabled={!newKey.trim()}
                onClick={() => {
                  if (applyResult(addFrontmatterValue(markdown, newKey, ""))) {
                    const normalizedKey = newKey.trim();
                    setAdding(false);
                    setNewKey("");
                    setShowAll(true);
                    setEditingKey(normalizedKey);
                    setDraft("");
                  }
                }}
              >
                <Check size={16} aria-hidden="true" />
              </button>
              <button
                className="document-property-add-cancel"
                type="button"
                aria-label={copy.cancel}
                onClick={() => {
                  setAdding(false);
                  setNewKey("");
                  setError(null);
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              className="document-properties-add"
              type="button"
              onClick={() => {
                setAdding(true);
                setNewKey("");
                setError(null);
              }}
            >
              <Plus size={16} aria-hidden="true" />
              {copy.addProperty}
            </button>
          )}

          {error && (
            <p className="document-properties-error" role="alert">
              {error}
              {onOpenSource && (
                <button type="button" onClick={onOpenSource}>{copy.editInSource}</button>
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
