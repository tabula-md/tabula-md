import {
  Braces,
  CalendarDays,
  Check,
  CheckSquare2,
  ChevronDown,
  Code2,
  Hash,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  addFrontmatterValue,
  convertFrontmatterPropertyValue,
  diffTextPatch,
  formatFrontmatterPropertyDraft,
  getFrontmatterProperties,
  parseFrontmatterPropertyDraft,
  removeFrontmatterValue,
  renameFrontmatterKey,
  updateFrontmatterValue,
  type FrontmatterProperty,
  type FrontmatterPropertyType,
  type FrontmatterValueUpdate,
  type TextChange,
} from "@tabula-md/tabula";
import {
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "../ui/Menu";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";
import type { MarkdownEditorHandle } from "./markdownEditorTypes";

const DEFAULT_VISIBLE_PROPERTY_COUNT = 5;

const propertyCopy = {
  en: {
    addProperty: "Add property",
    cancel: "Cancel",
    changeType: (key: string) => `Change type for ${key}`,
    checkbox: "Checkbox",
    date: "Date",
    duplicateKey: "A property with this name already exists.",
    editInSource: "Edit in Source",
    empty: "Empty",
    fields: (count: number) => `${count} ${count === 1 ? "field" : "fields"}`,
    invalidKey: "Use a non-empty, single-line property name.",
    invalidValue: "Enter a value that matches the selected type.",
    list: "List",
    moreActions: (key: string) => `More actions for ${key}`,
    newItem: "New item",
    newPropertyName: "Property name",
    number: "Number",
    object: "Object",
    items: (count: number) => `${count} ${count === 1 ? "item" : "items"}`,
    propertyValue: "Property value",
    remove: "Remove property",
    removeItem: (value: string) => `Remove ${value}`,
    save: "Save",
    showLess: "Show less",
    showMore: (count: number) => `Show ${count} more`,
    text: "Text",
    updateFailed: "Could not update this property. Open Source to repair the YAML.",
  },
  ko: {
    addProperty: "속성 추가",
    cancel: "취소",
    changeType: (key: string) => `${key} 타입 변경`,
    checkbox: "체크박스",
    date: "날짜",
    duplicateKey: "같은 이름의 속성이 이미 있습니다.",
    editInSource: "Source에서 편집",
    empty: "비어 있음",
    fields: (count: number) => `${count}개 필드`,
    invalidKey: "비어 있지 않은 한 줄 이름을 입력하세요.",
    invalidValue: "선택한 타입에 맞는 값을 입력하세요.",
    list: "목록",
    moreActions: (key: string) => `${key} 추가 작업`,
    newItem: "새 항목",
    newPropertyName: "속성 이름",
    number: "숫자",
    object: "객체",
    items: (count: number) => `${count}개 항목`,
    propertyValue: "속성 값",
    remove: "속성 삭제",
    removeItem: (value: string) => `${value} 삭제`,
    save: "저장",
    showLess: "접기",
    showMore: (count: number) => `${count}개 더 보기`,
    text: "텍스트",
    updateFailed: "속성을 수정하지 못했습니다. Source에서 YAML을 확인하세요.",
  },
};

const getCopy = (language: WorkspaceLanguage) =>
  language === "ko" ? propertyCopy.ko : propertyCopy.en;

const propertyTypes: FrontmatterPropertyType[] = [
  "text",
  "number",
  "checkbox",
  "date",
  "list",
  "object",
];

const getTypeIcon = (type: FrontmatterPropertyType, size = 16) => {
  const props = { "aria-hidden": true, size } as const;
  switch (type) {
    case "number":
      return <Hash {...props} />;
    case "checkbox":
      return <CheckSquare2 {...props} />;
    case "date":
      return <CalendarDays {...props} />;
    case "list":
      return <List {...props} />;
    case "object":
      return <Braces {...props} />;
    default:
      return <Type {...props} />;
  }
};

const getTypeLabel = (
  type: FrontmatterPropertyType,
  copy: ReturnType<typeof getCopy>,
) => copy[type];

const isScalarList = (
  property: FrontmatterProperty,
): property is FrontmatterProperty & { value: Array<string | number | boolean> } =>
  property.kind === "scalar-list" && Array.isArray(property.value);

const getListItemFromInput = (
  items: Array<string | number | boolean>,
  index: number | null,
  input: string,
) => {
  const template = index === null ? items[0] : items[index];
  if (typeof template === "number") {
    const next = Number(input);
    return Number.isFinite(next) ? next : undefined;
  }
  if (typeof template === "boolean") {
    if (input === "true") return true;
    if (input === "false") return false;
    return undefined;
  }
  return input;
};

function PropertyTypeMenu({
  copy,
  label,
  onChange,
  value,
}: {
  copy: ReturnType<typeof getCopy>;
  label: string;
  onChange: (type: FrontmatterPropertyType) => void;
  value: FrontmatterPropertyType;
}) {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button className="document-property-type-trigger" type="button" aria-label={label}>
          {getTypeIcon(value)}
        </button>
      </MenuTrigger>
      <MenuContent align="start" ariaLabel={label} className="document-property-type-menu">
        <MenuRadioGroup
          value={value}
          onValueChange={(nextValue) => onChange(nextValue as FrontmatterPropertyType)}
        >
          {propertyTypes.map((type) => (
            <MenuRadioItem
              key={type}
              value={type}
              label={getTypeLabel(type, copy)}
            />
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  );
}

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
  const [listItemEditor, setListItemEditor] = useState<{
    key: string;
    index: number | null;
    draft: string;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<FrontmatterPropertyType>("text");
  const [newDraft, setNewDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editorInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const addKeyRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setExpanded(true);
    setShowAll(false);
    setEditingKey(null);
    setRenamingKey(null);
    setListItemEditor(null);
    setAdding(false);
    setError(null);
  }, [documentId]);

  useEffect(() => {
    if (adding) {
      addKeyRef.current?.focus();
      return;
    }
    editorInputRef.current?.focus();
    if (editorInputRef.current instanceof HTMLInputElement) {
      editorInputRef.current.select();
    }
  }, [adding, editingKey, listItemEditor, renamingKey]);

  if (model.status !== "valid") return null;

  const applyResult = (result: FrontmatterValueUpdate) => {
    if (!result.ok) {
      setError(
        result.reason === "invalid_key"
          ? copy.invalidKey
          : result.reason === "duplicate_key"
            ? copy.duplicateKey
            : copy.updateFailed,
      );
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

  const beginKeyEdit = (property: FrontmatterProperty) => {
    setRenamingKey(property.key);
    setEditingKey(null);
    setListItemEditor(null);
    setDraft(property.key);
    setError(null);
  };

  const commitKeyEdit = (property: FrontmatterProperty) => {
    if (renamingKey !== property.key) return;
    if (!draft.trim() || draft.trim() === property.key) {
      setRenamingKey(null);
      return;
    }
    if (applyResult(renameFrontmatterKey(markdown, property.key, draft))) {
      setRenamingKey(null);
    }
  };

  const beginValueEdit = (property: FrontmatterProperty) => {
    if (property.type === "checkbox") return;
    setEditingKey(property.key);
    setRenamingKey(null);
    setListItemEditor(null);
    setDraft(formatFrontmatterPropertyDraft(property.value, property.type));
    setError(null);
  };

  const commitValueEdit = (property: FrontmatterProperty) => {
    if (editingKey !== property.key) return;
    const result = parseFrontmatterPropertyDraft(draft, property.type);
    if (!result.ok) {
      setError(copy.invalidValue);
      return;
    }
    if (applyResult(updateFrontmatterValue(markdown, property.key, result.value))) {
      setEditingKey(null);
    }
  };

  const changePropertyType = (
    property: FrontmatterProperty,
    type: FrontmatterPropertyType,
  ) => {
    if (type === property.type) return;
    const result = convertFrontmatterPropertyValue(property.value, type);
    if (!result.ok) {
      setError(copy.invalidValue);
      return;
    }
    setEditingKey(null);
    setListItemEditor(null);
    applyResult(updateFrontmatterValue(markdown, property.key, result.value));
  };

  const commitListItem = (
    property: FrontmatterProperty & { value: Array<string | number | boolean> },
  ) => {
    if (!listItemEditor || listItemEditor.key !== property.key) return;
    const nextItem = getListItemFromInput(
      property.value,
      listItemEditor.index,
      listItemEditor.draft.trim(),
    );
    if (typeof nextItem === "undefined" || !listItemEditor.draft.trim()) {
      setError(copy.invalidValue);
      return;
    }
    const nextItems = [...property.value];
    if (listItemEditor.index === null) nextItems.push(nextItem);
    else nextItems[listItemEditor.index] = nextItem;
    if (applyResult(updateFrontmatterValue(markdown, property.key, nextItems))) {
      setListItemEditor(null);
    }
  };

  const resetAddForm = () => {
    setAdding(false);
    setNewKey("");
    setNewType("text");
    setNewDraft("");
    setError(null);
  };

  const changeNewType = (type: FrontmatterPropertyType) => {
    const converted = convertFrontmatterPropertyValue(undefined, type);
    if (!converted.ok) return;
    setNewType(type);
    setNewDraft(formatFrontmatterPropertyDraft(converted.value, type));
  };

  const commitAdd = () => {
    if (!newKey.trim()) return;
    const value = parseFrontmatterPropertyDraft(newDraft, newType);
    if (!value.ok) {
      setError(copy.invalidValue);
      return;
    }
    if (applyResult(addFrontmatterValue(markdown, newKey, value.value))) {
      const normalizedKey = newKey.trim();
      resetAddForm();
      setShowAll(true);
      setEditingKey(newType === "checkbox" ? null : normalizedKey);
      setDraft(formatFrontmatterPropertyDraft(value.value, newType));
    }
  };

  const cancelEditors = () => {
    setEditingKey(null);
    setRenamingKey(null);
    setListItemEditor(null);
    setError(null);
  };

  const handleKeyEditorKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    commit: () => void,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditors();
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };

  const handleValueEditorKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    commit: () => void,
    multiline = false,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditors();
    } else if (
      event.key === "Enter" &&
      (!multiline || event.metaKey || event.ctrlKey)
    ) {
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
              const scalarList = isScalarList(property);
              const isTagList = property.key.toLowerCase() === "tags" && scalarList;
              const isStructured = property.type === "object" ||
                (property.type === "list" && !scalarList);
              return (
                <div className="document-property-row" key={property.key}>
                  <PropertyTypeMenu
                    copy={copy}
                    label={copy.changeType(property.key)}
                    value={property.type}
                    onChange={(type) => changePropertyType(property, type)}
                  />

                  {renamingKey === property.key ? (
                    <input
                      ref={editorInputRef as React.RefObject<HTMLInputElement>}
                      className="document-property-key-input"
                      value={draft}
                      aria-label={copy.newPropertyName}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => commitKeyEdit(property)}
                      onKeyDown={(event) => handleKeyEditorKeyDown(
                        event,
                        () => commitKeyEdit(property),
                      )}
                    />
                  ) : (
                    <button
                      className="document-property-key"
                      type="button"
                      title={property.key}
                      onClick={() => beginKeyEdit(property)}
                    >
                      {property.key}
                    </button>
                  )}

                  <div className="document-property-value">
                    {property.type === "checkbox" ? (
                      <label className="document-property-boolean">
                        <input
                          type="checkbox"
                          checked={Boolean(property.value)}
                          onChange={(event) => applyResult(updateFrontmatterValue(
                            markdown,
                            property.key,
                            event.target.checked,
                          ))}
                        />
                        <span>{String(property.value)}</span>
                      </label>
                    ) : scalarList ? (
                      <div className="document-property-list-value">
                        {property.value.map((item, index) => (
                          listItemEditor?.key === property.key &&
                          listItemEditor.index === index ? (
                            <input
                              key={index}
                              ref={editorInputRef as React.RefObject<HTMLInputElement>}
                              className="document-property-chip-input"
                              value={listItemEditor.draft}
                              aria-label={`${property.key} ${index + 1}`}
                              onChange={(event) => setListItemEditor({
                                key: property.key,
                                index,
                                draft: event.target.value,
                              })}
                              onBlur={() => commitListItem(property)}
                              onKeyDown={(event) => handleKeyEditorKeyDown(
                                event,
                                () => commitListItem(property),
                              )}
                            />
                          ) : (
                            <span
                              className={`document-property-chip${isTagList ? " tag" : ""}`}
                              key={`${String(item)}-${index}`}
                            >
                              <button
                                className="document-property-chip-label"
                                type="button"
                                onClick={() => setListItemEditor({
                                  key: property.key,
                                  index,
                                  draft: String(item),
                                })}
                              >
                                {isTagList ? "#" : ""}{String(item)}
                              </button>
                              <button
                                type="button"
                                aria-label={copy.removeItem(String(item))}
                                onClick={() => applyResult(updateFrontmatterValue(
                                  markdown,
                                  property.key,
                                  property.value.filter((_, itemIndex) => itemIndex !== index),
                                ))}
                              >
                                <X size={13} aria-hidden="true" />
                              </button>
                            </span>
                          )
                        ))}
                        {listItemEditor?.key === property.key &&
                        listItemEditor.index === null ? (
                          <input
                            ref={editorInputRef as React.RefObject<HTMLInputElement>}
                            className="document-property-chip-input"
                            value={listItemEditor.draft}
                            placeholder={copy.newItem}
                            aria-label={`${copy.newItem}: ${property.key}`}
                            onChange={(event) => setListItemEditor({
                              key: property.key,
                              index: null,
                              draft: event.target.value,
                            })}
                            onBlur={() => commitListItem(property)}
                            onKeyDown={(event) => handleKeyEditorKeyDown(
                              event,
                              () => commitListItem(property),
                            )}
                          />
                        ) : (
                          <button
                            className="document-property-add-item"
                            type="button"
                            aria-label={`${copy.newItem}: ${property.key}`}
                            onClick={() => setListItemEditor({
                              key: property.key,
                              index: null,
                              draft: "",
                            })}
                          >
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ) : editingKey === property.key ? (
                      isStructured ? (
                        <textarea
                          ref={editorInputRef as React.RefObject<HTMLTextAreaElement>}
                          className="document-property-value-input structured"
                          rows={Math.min(8, Math.max(3, draft.split("\n").length))}
                          value={draft}
                          aria-label={`${property.key} value`}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => commitValueEdit(property)}
                          onKeyDown={(event) => handleValueEditorKeyDown(
                            event,
                            () => commitValueEdit(property),
                            true,
                          )}
                        />
                      ) : property.type === "text" ? (
                        <textarea
                          ref={editorInputRef as React.RefObject<HTMLTextAreaElement>}
                          className="document-property-value-input"
                          rows={1}
                          value={draft}
                          aria-label={`${property.key} value`}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => commitValueEdit(property)}
                          onKeyDown={(event) => handleValueEditorKeyDown(
                            event,
                            () => commitValueEdit(property),
                            true,
                          )}
                        />
                      ) : (
                        <input
                          ref={editorInputRef as React.RefObject<HTMLInputElement>}
                          className="document-property-value-input"
                          type={property.type === "date" && !draft.includes("T") ? "date" : "text"}
                          inputMode={property.type === "number" ? "decimal" : undefined}
                          value={draft}
                          aria-label={`${property.key} value`}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => commitValueEdit(property)}
                          onKeyDown={(event) => handleValueEditorKeyDown(
                            event,
                            () => commitValueEdit(property),
                          )}
                        />
                      )
                    ) : (
                      <button
                        className={`document-property-value-button${isStructured ? " structured" : ""}`}
                        type="button"
                        onClick={() => beginValueEdit(property)}
                      >
                        {isStructured
                          ? property.type === "object"
                            ? copy.fields(property.itemCount ?? 0)
                            : copy.items(property.itemCount ?? 0)
                          : String(property.value ?? "") || copy.empty}
                      </button>
                    )}
                  </div>

                  <MenuRoot>
                    <MenuTrigger asChild>
                      <button
                        className="document-property-actions-trigger"
                        type="button"
                        aria-label={copy.moreActions(property.key)}
                      >
                        <MoreHorizontal size={16} aria-hidden="true" />
                      </button>
                    </MenuTrigger>
                    <MenuContent
                      ariaLabel={copy.moreActions(property.key)}
                      className="document-property-actions-menu"
                    >
                      {onOpenSource && (
                        <MenuItem
                          icon={<Code2 size={15} />}
                          label={copy.editInSource}
                          onSelect={onOpenSource}
                        />
                      )}
                      <MenuItem
                        danger
                        icon={<Trash2 size={15} />}
                        label={copy.remove}
                        onSelect={() => applyResult(removeFrontmatterValue(markdown, property.key))}
                      />
                    </MenuContent>
                  </MenuRoot>
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
              <PropertyTypeMenu
                copy={copy}
                label={copy.changeType(newKey || copy.newPropertyName)}
                value={newType}
                onChange={changeNewType}
              />
              <input
                ref={addKeyRef}
                className="document-property-add-key"
                value={newKey}
                placeholder={copy.newPropertyName}
                aria-label={copy.newPropertyName}
                onChange={(event) => setNewKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    resetAddForm();
                  }
                }}
              />
              <div className="document-property-add-value">
                {newType === "checkbox" ? (
                  <label className="document-property-boolean">
                    <input
                      type="checkbox"
                      checked={newDraft === "true"}
                      onChange={(event) => setNewDraft(String(event.target.checked))}
                    />
                    <span>{newDraft}</span>
                  </label>
                ) : newType === "list" || newType === "object" ? (
                  <textarea
                    value={newDraft}
                    rows={3}
                    aria-label={copy.propertyValue}
                    onChange={(event) => setNewDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        resetAddForm();
                      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        commitAdd();
                      }
                    }}
                  />
                ) : (
                  <input
                    value={newDraft}
                    type={newType === "date" ? "date" : "text"}
                    inputMode={newType === "number" ? "decimal" : undefined}
                    placeholder={copy.empty}
                    aria-label={copy.propertyValue}
                    onChange={(event) => setNewDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        resetAddForm();
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        commitAdd();
                      }
                    }}
                  />
                )}
              </div>
              <button
                className="document-property-add-confirm"
                type="button"
                aria-label={copy.save}
                disabled={!newKey.trim()}
                onClick={commitAdd}
              >
                <Check size={16} aria-hidden="true" />
              </button>
              <button
                className="document-property-add-cancel"
                type="button"
                aria-label={copy.cancel}
                onClick={resetAddForm}
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
                setNewType("text");
                setNewDraft("");
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
