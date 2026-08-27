import {
  Check,
  ChevronDown,
  Code2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  addFrontmatterMarkdownValueAtPath,
  addFrontmatterValue,
  convertFrontmatterPropertyValue,
  formatFrontmatterPropertyDraft,
  getFrontmatterValueAtPath,
  parseFrontmatterPropertyDraft,
  removeFrontmatterMarkdownValueAtPath,
  removeFrontmatterValueAtPath,
  removeFrontmatterValue,
  renameFrontmatterMarkdownKeyAtPath,
  renameFrontmatterValuePathKey,
  renameFrontmatterKey,
  updateFrontmatterMarkdownValueAtPath,
  updateFrontmatterValueAtPath,
  updateFrontmatterValue,
  type FrontmatterProperty,
  type FrontmatterPropertyType,
  type FrontmatterValuePath,
  type TextChange,
} from "@tabula-md/tabula";
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from "../ui/Menu";
import { Combobox } from "../ui/Combobox";
import { InlineInput, InlineTextarea } from "../ui/InlineField";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";
import type { MarkdownEditorHandle } from "./markdownEditorTypes";
import { getDocumentPropertiesCopy } from "./documentPropertiesLocale";
import { DocumentPropertyTypeMenu } from "./DocumentPropertyTypeMenu";
import { StructuredPropertyValue } from "./DocumentStructuredPropertyValue";
import {
  getFrontmatterPropertySuggestion,
  getSuggestedFrontmatterPropertyState,
} from "./frontmatterPropertySuggestions";
import { useDocumentMetadataModel } from "./useDocumentMetadataModel";
import { useDocumentMetadataMutation } from "./useDocumentMetadataMutation";

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

type AddPropertyPhase = "idle" | "key" | "value";

export type DocumentPropertiesProps = {
  addPropertyRequestId?: number;
  documentId: string;
  editorRef: React.RefObject<MarkdownEditorHandle | null>;
  language: WorkspaceLanguage;
  markdown: string;
  onChange: (nextValue: string | null, change?: TextChange) => void;
  onPropertyAddRequestHandled?: () => void;
  onOpenSource?: () => void;
  variant?: "inline" | "drawer";
  workspaceMarkdownDocuments?: readonly string[];
};

export function DocumentProperties({
  addPropertyRequestId,
  documentId,
  editorRef,
  language,
  markdown,
  onChange,
  onPropertyAddRequestHandled,
  onOpenSource,
  variant = "inline",
  workspaceMarkdownDocuments = [],
}: DocumentPropertiesProps) {
  const copy = getDocumentPropertiesCopy(language);
  const errorId = useId();
  const surfaceCopy = getWorkspaceSurfaceCopy(language);
  const { model, propertySuggestions } = useDocumentMetadataModel(
    markdown,
    workspaceMarkdownDocuments,
  );
  const [expanded, setExpanded] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [listItemEditor, setListItemEditor] = useState<{
    key: string;
    index: number | null;
    draft: string;
  } | null>(null);
  const [addPhase, setAddPhase] = useState<AddPropertyPhase>("idle");
  const adding = addPhase !== "idle";
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<FrontmatterPropertyType>("text");
  const [newDraft, setNewDraft] = useState("");
  const [newTypeWasChosen, setNewTypeWasChosen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const addFormRef = useRef<HTMLDivElement | null>(null);
  const addKeyRef = useRef<HTMLInputElement | null>(null);
  const addValueRef = useRef<HTMLInputElement | null>(null);
  const addConfirmRef = useRef<HTMLButtonElement | null>(null);
  const applyResult = useDocumentMetadataMutation({
    copy,
    editorRef,
    markdown,
    onChange,
    onError: setError,
  });

  useEffect(() => {
    setEditingKey(null);
    setRenamingKey(null);
    setListItemEditor(null);
    setAddPhase("idle");
    setNewTypeWasChosen(false);
    setError(null);
  }, [documentId]);

  useEffect(() => {
    if (typeof addPropertyRequestId !== "number") return;
    setExpanded(true);
    setEditingKey(null);
    setRenamingKey(null);
    setListItemEditor(null);
    setAddPhase("key");
    setNewKey("");
    setNewType("text");
    setNewDraft("");
    setNewTypeWasChosen(false);
    setError(null);
    onPropertyAddRequestHandled?.();
  }, [addPropertyRequestId, onPropertyAddRequestHandled]);

  useEffect(() => {
    if (addPhase === "key") {
      addKeyRef.current?.focus();
      return;
    }
    if (addPhase === "value") {
      if (newType === "object" || newType === "list") return;
      const target = newType === "empty" ? addConfirmRef.current : addValueRef.current;
      target?.focus();
      if (target instanceof HTMLInputElement && target.type !== "checkbox") target.select();
      return;
    }
    editorInputRef.current?.focus();
    if (editorInputRef.current instanceof HTMLInputElement) {
      editorInputRef.current.select();
    }
  }, [addPhase, editingKey, listItemEditor, markdown, newType, renamingKey]);

  useEffect(() => {
    if (!adding) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (addFormRef.current?.contains(target)) return;
      if (target.closest(".ui-combobox-popover, .document-property-type-menu")) return;
      setAddPhase("idle");
      setNewKey("");
      setNewType("text");
      setNewDraft("");
      setNewTypeWasChosen(false);
      setError(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [adding]);

  if (model.status === "invalid") {
    return (
      <section
        className={`document-properties document-properties-invalid${variant === "drawer" ? " document-properties-drawer" : ""}`}
        aria-label={surfaceCopy.frontmatter}
      >
        <div className="document-properties-invalid-state" role="status">
          <span>{copy.invalidMetadata}</span>
          {onOpenSource && (
            <button type="button" onClick={onOpenSource}>{copy.editInSource}</button>
          )}
        </div>
      </section>
    );
  }

  const beginKeyEdit = (property: FrontmatterProperty) => {
    setRenamingKey(property.key);
    setEditingKey(null);
    setListItemEditor(null);
    setDraft(property.key);
    setError(null);
  };

  const advanceToPropertyValue = (
    property: FrontmatterProperty,
    key: string,
  ) => {
    if (
      property.type === "empty" ||
      property.type === "checkbox" ||
      property.type === "object" ||
      property.type === "list"
    ) return;
    setEditingKey(key);
    setDraft(formatFrontmatterPropertyDraft(property.value, property.type));
  };

  const commitKeyEdit = (
    property: FrontmatterProperty,
    advanceToValue = false,
  ) => {
    if (renamingKey !== property.key) return;
    const nextKey = draft.trim();
    if (!nextKey || nextKey === property.key) {
      setRenamingKey(null);
      if (advanceToValue) advanceToPropertyValue(property, property.key);
      return;
    }
    if (applyResult(renameFrontmatterKey(markdown, property.key, draft))) {
      setRenamingKey(null);
      if (advanceToValue) advanceToPropertyValue(property, nextKey);
    }
  };

  const beginValueEdit = (property: FrontmatterProperty) => {
    if (
      property.type === "empty" ||
      property.type === "checkbox" ||
      property.type === "object" ||
      (property.type === "list" && !isScalarList(property))
    ) return;
    setEditingKey(property.key);
    setRenamingKey(null);
    setListItemEditor(null);
    setDraft(formatFrontmatterPropertyDraft(property.value, property.type));
    setError(null);
  };

  const commitValueEdit = (property: FrontmatterProperty, advance = false) => {
    if (editingKey !== property.key) return;
    const result = parseFrontmatterPropertyDraft(draft, property.type);
    if (!result.ok) {
      setError(copy.invalidValue);
      return;
    }
    if (applyResult(updateFrontmatterValue(markdown, property.key, result.value))) {
      setEditingKey(null);
      if (advance) {
        const propertyIndex = model.properties.findIndex(({ key }) => key === property.key);
        const nextProperty = model.properties[propertyIndex + 1];
        if (nextProperty) {
          window.requestAnimationFrame(() => advanceToPropertyValue(nextProperty, nextProperty.key));
        }
      }
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
    setAddPhase("idle");
    setNewKey("");
    setNewType("text");
    setNewDraft("");
    setNewTypeWasChosen(false);
    setError(null);
  };

  const beginAdd = () => {
    setAddPhase("key");
    setNewKey("");
    setNewType("text");
    setNewDraft("");
    setNewTypeWasChosen(false);
    setError(null);
  };

  const changeNewType = (type: FrontmatterPropertyType) => {
    const converted = convertFrontmatterPropertyValue(undefined, type);
    if (!converted.ok) return;
    setNewTypeWasChosen(true);
    setNewType(type);
    setNewDraft(formatFrontmatterPropertyDraft(converted.value, type));
  };

  const changeNewKey = (key: string) => {
    setNewKey(key);
    if (newTypeWasChosen) return;
    const suggestion = propertySuggestions.find(
      ({ key: suggestionKey }) => suggestionKey.toLowerCase() === key.trim().toLowerCase(),
    );
    const suggestedState = suggestion ?? getSuggestedFrontmatterPropertyState(key);
    setNewType(suggestedState.type);
    setNewDraft(suggestedState.draft);
    setError(null);
  };

  const getNewStructuredValue = () => {
    if (newType !== "list" && newType !== "object") return null;
    const parsed = parseFrontmatterPropertyDraft(newDraft, newType);
    return parsed.ok ? parsed.value : null;
  };

  const applyNewStructuredValue = (value: unknown) => {
    setNewDraft(formatFrontmatterPropertyDraft(value, newType));
    setError(null);
    return true;
  };

  const updateNewStructuredValue = (path: FrontmatterValuePath, value: unknown) => {
    const currentValue = getNewStructuredValue();
    if (currentValue === null) return false;
    const result = updateFrontmatterValueAtPath(currentValue, path, value);
    return result.ok ? applyNewStructuredValue(result.value) : false;
  };

  const addNewStructuredValue = (
    parentPath: FrontmatterValuePath,
    segment: string | number,
    value: unknown,
  ) => {
    const currentValue = getNewStructuredValue();
    if (currentValue === null) return false;
    const parent = getFrontmatterValueAtPath(currentValue, parentPath);
    if (Array.isArray(parent) && typeof segment === "number") {
      const nextParent = [...parent];
      nextParent.splice(segment, 0, value);
      return updateNewStructuredValue(parentPath, nextParent);
    }
    if (parent && typeof parent === "object" && !Array.isArray(parent) &&
      typeof segment === "string") {
      return updateNewStructuredValue(parentPath, {
        ...(parent as Record<string, unknown>),
        [segment]: value,
      });
    }
    return false;
  };

  const removeNewStructuredValue = (path: FrontmatterValuePath) => {
    const currentValue = getNewStructuredValue();
    if (currentValue === null) return false;
    const result = removeFrontmatterValueAtPath(currentValue, path);
    return result.ok ? applyNewStructuredValue(result.value) : false;
  };

  const renameNewStructuredKey = (path: FrontmatterValuePath, nextKey: string) => {
    const currentValue = getNewStructuredValue();
    if (currentValue === null) return false;
    const result = renameFrontmatterValuePathKey(currentValue, path, nextKey);
    return result.ok ? applyNewStructuredValue(result.value) : false;
  };

  const commitAdd = () => {
    if (!newKey.trim()) return;
    if (
      newType !== "empty" &&
      newType !== "checkbox" &&
      newType !== "list" &&
      newType !== "object" &&
      !newDraft.trim()
    ) {
      setError(copy.invalidValue);
      return;
    }
    const value = parseFrontmatterPropertyDraft(newDraft, newType);
    if (!value.ok) {
      setError(copy.invalidValue);
      return;
    }
    if (applyResult(addFrontmatterValue(markdown, newKey, value.value))) {
      resetAddForm();
    }
  };

  const advanceAddToValue = (key = newKey) => {
    if (!key.trim()) return;
    setAddPhase("value");
    setError(null);
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
      (!multiline || !event.shiftKey)
    ) {
      event.preventDefault();
      commit();
    }
  };

  // An empty YAML envelope has no distinct meaning in Write. Treat it like
  // absent metadata so imported `--- / ---` documents and new documents share
  // the same visible empty state.
  const hasFrontmatter = model.status === "valid" && model.properties.length > 0;
  const availablePropertySuggestions = propertySuggestions.filter(
      (suggestion) => !model.properties.some(
      (property) => property.key.toLowerCase() === suggestion.key.toLowerCase(),
    ),
  );
  const newValueIsPresent =
    newType === "empty" ||
    newType === "checkbox" ||
    newType === "list" ||
    newType === "object" ||
    Boolean(newDraft.trim());
  const canCommitAdd = Boolean(newKey.trim()) && newValueIsPresent;

  return (
    <section
      className={`document-properties${hasFrontmatter ? "" : " document-properties-empty"}${variant === "drawer" ? " document-properties-drawer" : ""}`}
      aria-label={surfaceCopy.frontmatter}
      aria-describedby={error ? errorId : undefined}
    >
      {variant !== "drawer" && hasFrontmatter && (
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
        </button>
      )}

      {(variant === "drawer" || !hasFrontmatter || expanded) && (
        <div className="document-properties-body">
          <div className="document-properties-list">
            {model.properties.map((property, propertyIndex) => {
              const scalarList = isScalarList(property);
              const isTagList = property.key.toLowerCase() === "tags" && scalarList;
              const isStructured = property.type === "object" ||
                (property.type === "list" && !scalarList);
              const isLastProperty = propertyIndex === model.properties.length - 1;
              return (
                <div className="document-property-row" key={property.key}>
                  <DocumentPropertyTypeMenu
                    copy={copy}
                    label={copy.changeType(property.key)}
                    value={property.type}
                    onChange={(type) => changePropertyType(property, type)}
                  />

                  {renamingKey === property.key ? (
                    <InlineInput
                      ref={editorInputRef as React.RefObject<HTMLInputElement>}
                      className="document-property-key-input"
                      value={draft}
                      aria-label={copy.newPropertyName}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => commitKeyEdit(property)}
                      onKeyDown={(event) => handleKeyEditorKeyDown(
                        event,
                        () => commitKeyEdit(property, true),
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
                            <InlineInput
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
                          <InlineInput
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
                    ) : isStructured ? (
                      <StructuredPropertyValue
                        copy={copy}
                        property={property}
                        typeHints={getFrontmatterPropertySuggestion(property.key)?.typeHints}
                        onError={setError}
                        onAddValue={(parentPath, segment, value) => applyResult(
                          addFrontmatterMarkdownValueAtPath(
                            markdown,
                            [property.key, ...parentPath],
                            segment,
                            value,
                          ),
                        )}
                        onRemoveValue={(path) => applyResult(
                          removeFrontmatterMarkdownValueAtPath(
                            markdown,
                            [property.key, ...path],
                          ),
                        )}
                        onRenameKey={(path, nextKey) => applyResult(
                          renameFrontmatterMarkdownKeyAtPath(
                            markdown,
                            [property.key, ...path],
                            nextKey,
                          ),
                        )}
                        onUpdateValue={(path, value) => applyResult(
                          updateFrontmatterMarkdownValueAtPath(
                            markdown,
                            [property.key, ...path],
                            value,
                          ),
                        )}
                      />
                    ) : editingKey === property.key ? (
                      property.type === "text" ? (
                        <InlineTextarea
                          ref={editorInputRef as React.RefObject<HTMLTextAreaElement>}
                          className="document-property-value-input"
                          rows={1}
                          value={draft}
                          aria-label={`${property.key} value`}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => commitValueEdit(property)}
                          onKeyDown={(event) => handleValueEditorKeyDown(
                            event,
                            () => commitValueEdit(property, true),
                            true,
                          )}
                        />
                      ) : (
                        <InlineInput
                          ref={editorInputRef as React.RefObject<HTMLInputElement>}
                          className="document-property-value-input"
                          type={property.type === "date" ? "date" : "text"}
                          inputMode={property.type === "number" ? "decimal" : undefined}
                          value={draft}
                          placeholder={property.type === "datetime"
                            ? copy.timestampPlaceholder
                            : undefined}
                          aria-label={`${property.key} value`}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => commitValueEdit(property)}
                          onKeyDown={(event) => handleValueEditorKeyDown(
                            event,
                            () => commitValueEdit(property, true),
                          )}
                        />
                      )
                    ) : (
                      <button
                        className={`document-property-value-button${isStructured ? " structured" : ""}`}
                        type="button"
                        disabled={property.type === "empty"}
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

                  <div className="document-property-row-actions">
                    {isLastProperty && !adding && (
                      <button
                        className="document-properties-add-icon"
                        type="button"
                        aria-label={copy.addProperty}
                        onClick={beginAdd}
                      >
                        <Plus size={15} aria-hidden="true" />
                      </button>
                    )}
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
                </div>
              );
            })}
          </div>

          {adding ? (
            <div className="document-property-add-form" ref={addFormRef}>
              <DocumentPropertyTypeMenu
                copy={copy}
                label={copy.changeType(newKey || copy.newPropertyName)}
                value={newType}
                onChange={changeNewType}
              />
              <Combobox
                ref={addKeyRef}
                className="document-property-add-key-combobox"
                inputClassName="ui-inline-field document-property-add-key"
                value={newKey}
                options={availablePropertySuggestions.map((suggestion) => ({
                  description: suggestion.usageCount
                    ? `${copy.usedInDocuments(suggestion.usageCount)}${suggestion.hasMixedTypes ? ` · ${copy.mixedTypes}` : ""}`
                    : suggestion.description,
                  label: suggestion.key,
                  value: suggestion.key,
                }))}
                emptyLabel={copy.noSuggestions}
                groupLabel={copy.suggestedFields}
                placeholder={copy.newPropertyName}
                aria-label={copy.newPropertyName}
                onValueChange={changeNewKey}
                onCommit={advanceAddToValue}
                onFocus={() => setAddPhase("key")}
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
                      ref={addValueRef}
                      type="checkbox"
                      checked={newDraft === "true"}
                      onFocus={() => setAddPhase("value")}
                      onChange={(event) => setNewDraft(String(event.target.checked))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitAdd();
                        }
                      }}
                    />
                    <span>{newDraft}</span>
                  </label>
                ) : newType === "empty" ? (
                  <span className="document-property-add-collection">{copy.empty}</span>
                ) : newType === "list" || newType === "object" ? (
                  (() => {
                    const value = getNewStructuredValue();
                    if (value === null) {
                      return <span className="document-property-add-collection">{copy.invalidValue}</span>;
                    }
                    const property: FrontmatterProperty = {
                      key: newKey,
                      kind: newType === "list" ? "structured-list" : "mapping",
                      type: newType,
                      value,
                      itemCount: Array.isArray(value)
                        ? value.length
                        : Object.keys(value as Record<string, unknown>).length,
                    };
                    return (
                      <StructuredPropertyValue
                        key={`${newKey}:${newType}`}
                        autoFocusFirstValue={addPhase === "value"}
                        copy={copy}
                        property={property}
                        typeHints={newTypeWasChosen
                          ? undefined
                          : propertySuggestions.find(({ key }) =>
                            key.toLowerCase() === newKey.trim().toLowerCase())?.typeHints}
                        onError={setError}
                        onAddValue={addNewStructuredValue}
                        onRemoveValue={removeNewStructuredValue}
                        onRenameKey={renameNewStructuredKey}
                        onUpdateValue={updateNewStructuredValue}
                      />
                    );
                  })()
                ) : (
                  <InlineInput
                    ref={addValueRef}
                    value={newDraft}
                    type={newType === "date" ? "date" : "text"}
                    inputMode={newType === "number" ? "decimal" : undefined}
                    placeholder={newType === "datetime" ? copy.timestampPlaceholder : copy.empty}
                    aria-label={copy.propertyValue}
                    onFocus={() => setAddPhase("value")}
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
                ref={addConfirmRef}
                className="document-property-add-confirm"
                type="button"
                aria-label={copy.save}
                disabled={!canCommitAdd}
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
          ) : model.properties.length === 0 ? (
            <button
              className="document-properties-add"
              type="button"
              onClick={beginAdd}
            >
              <Plus size={16} aria-hidden="true" />
              {copy.addProperty}
            </button>
          ) : null}

          {error && (
            <p className="document-properties-error" id={errorId} role="alert">
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
