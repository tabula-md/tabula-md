import {
  Braces,
  CalendarClock,
  CalendarDays,
  Check,
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  Code2,
  Hash,
  List,
  Minus,
  MoreHorizontal,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  addFrontmatterMarkdownValueAtPath,
  addFrontmatterValue,
  convertFrontmatterPropertyValue,
  diffTextPatch,
  formatFrontmatterPropertyDraft,
  getFrontmatterProperties,
  getFrontmatterValueAtPath,
  getFrontmatterValueType,
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
import { Combobox } from "../ui/Combobox";
import { InlineInput, InlineTextarea } from "../ui/InlineField";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";
import type { MarkdownEditorHandle } from "./markdownEditorTypes";
import { getDocumentPropertiesCopy, type DocumentPropertiesCopy } from "./documentPropertiesLocale";
import {
  frontmatterPropertySuggestions,
  getFrontmatterPropertySuggestion,
  getSuggestedFrontmatterPropertyState,
  getWorkspaceFrontmatterPropertySuggestions,
  type FrontmatterPropertyTypeHint,
} from "./frontmatterPropertySuggestions";

const propertyTypes: FrontmatterPropertyType[] = [
  "text",
  "number",
  "checkbox",
  "date",
  "datetime",
  "list",
  "object",
  "empty",
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
    case "datetime":
      return <CalendarClock {...props} />;
    case "list":
      return <List {...props} />;
    case "object":
      return <Braces {...props} />;
    case "empty":
      return <Minus {...props} />;
    default:
      return <Type {...props} />;
  }
};

const getTypeLabel = (
  type: FrontmatterPropertyType,
  copy: DocumentPropertiesCopy,
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
  copy: DocumentPropertiesCopy;
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
              icon={getTypeIcon(type, 15)}
              label={getTypeLabel(type, copy)}
            />
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  );
}

type StructuredValueEditor = {
  draft: string;
  isNew?: boolean;
  mode: "key" | "value";
  path: FrontmatterValuePath;
};

type AddPropertyPhase = "idle" | "key" | "value";

const getStructuredPathId = (path: FrontmatterValuePath) => JSON.stringify(path);

const getUniqueNestedKey = (value: Record<string, unknown>) => {
  if (!("property" in value)) return "property";
  let suffix = 2;
  while (`property ${suffix}` in value) suffix += 1;
  return `property ${suffix}`;
};

function StructuredPropertyValue({
  autoFocusFirstValue = false,
  copy,
  onAddValue,
  onError,
  onRemoveValue,
  onRenameKey,
  onUpdateValue,
  property,
  typeHints,
}: {
  autoFocusFirstValue?: boolean;
  copy: DocumentPropertiesCopy;
  onAddValue: (
    parentPath: FrontmatterValuePath,
    segment: string | number,
    value: unknown,
  ) => boolean;
  onError: (message: string | null) => void;
  onRemoveValue: (path: FrontmatterValuePath) => boolean;
  onRenameKey: (path: FrontmatterValuePath, nextKey: string) => boolean;
  onUpdateValue: (path: FrontmatterValuePath, value: unknown) => boolean;
  property: FrontmatterProperty;
  typeHints?: FrontmatterPropertyTypeHint[];
}) {
  const rootPathId = getStructuredPathId([]);
  const [expandedPaths, setExpandedPaths] = useState(() => new Set([rootPathId]));
  const [editor, setEditor] = useState<StructuredValueEditor | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, FrontmatterPropertyType>>({});
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const autoFocusHandledRef = useRef(false);
  const rootAddRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    editorRef.current?.focus();
    if (editorRef.current instanceof HTMLInputElement) editorRef.current.select();
  }, [editor]);

  const togglePath = (path: FrontmatterValuePath) => {
    const pathId = getStructuredPathId(path);
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(pathId)) next.delete(pathId);
      else next.add(pathId);
      return next;
    });
  };

  const applyNestedValue = (path: FrontmatterValuePath, value: unknown) => {
    const applied = onUpdateValue(path, value);
    if (applied) onError(null);
    return applied;
  };

  const getNestedType = (path: FrontmatterValuePath, value: unknown) => {
    const pathId = getStructuredPathId(path);
    if (typeOverrides[pathId]) return typeOverrides[pathId];
    const normalizedPath = path.map((segment) => typeof segment === "number" ? 0 : segment);
    const hint = typeHints?.find(({ path: hintPath }) =>
      getStructuredPathId(hintPath) === pathId ||
      getStructuredPathId(hintPath) === getStructuredPathId(normalizedPath));
    return hint?.type ?? getFrontmatterValueType(value);
  };

  const getEditableValueEntries = (
    collection: unknown,
    parentPath: FrontmatterValuePath = [],
  ): Array<{ path: FrontmatterValuePath; value: unknown }> => {
    const entries: Array<[string | number, unknown]> = Array.isArray(collection)
      ? collection.map((value, index) => [index, value])
      : collection && typeof collection === "object"
        ? Object.entries(collection as Record<string, unknown>)
        : [];
    return entries.flatMap(([key, value]) => {
      const path = [...parentPath, key];
      const type = getNestedType(path, value);
      if (type === "object" || type === "list") {
        return getEditableValueEntries(value, path);
      }
      return type === "checkbox" || type === "empty" ? [] : [{ path, value }];
    });
  };

  useEffect(() => {
    if (!autoFocusFirstValue) {
      autoFocusHandledRef.current = false;
      return;
    }
    if (autoFocusHandledRef.current) return;
    autoFocusHandledRef.current = true;

    const first = getEditableValueEntries(property.value)[0];
    if (first) {
      const type = getNestedType(first.path, first.value);
      setEditor({
        draft: formatFrontmatterPropertyDraft(first.value, type),
        mode: "value",
        path: first.path,
      });
      return;
    }
    rootAddRef.current?.focus();
  }, [autoFocusFirstValue, property.value]);

  const commitEditor = (advance = false) => {
    if (!editor) return;
    if (editor.mode === "key") {
      if (onRenameKey(editor.path, editor.draft)) {
        if (advance) {
          const nextPath = [
            ...editor.path.slice(0, -1),
            editor.draft.trim(),
          ];
          const value = getFrontmatterValueAtPath(property.value, editor.path);
          const type = getNestedType(editor.path, value);
          setEditor({
            draft: formatFrontmatterPropertyDraft(value, type),
            mode: "value",
            path: nextPath,
          });
        } else {
          setEditor(null);
        }
        onError(null);
      }
      return;
    }

    const currentValue = getFrontmatterValueAtPath(property.value, editor.path);
    const type = getNestedType(editor.path, currentValue);
    const parsed = parseFrontmatterPropertyDraft(editor.draft, type);
    if (!parsed.ok) {
      onError(copy.invalidValue);
      return;
    }
    if (!applyNestedValue(editor.path, parsed.value)) return;
    if (advance) {
      const entries = getEditableValueEntries(property.value);
      const currentIndex = entries.findIndex(({ path }) =>
        getStructuredPathId(path) === getStructuredPathId(editor.path));
      const next = currentIndex >= 0 ? entries[currentIndex + 1] : undefined;
      if (next) {
        const nextType = getNestedType(next.path, next.value);
        setEditor({
          draft: formatFrontmatterPropertyDraft(next.value, nextType),
          mode: "value",
          path: next.path,
        });
        return;
      }
    }
    setEditor(null);
  };

  const removeNestedValue = (path: FrontmatterValuePath) => {
    if (!onRemoveValue(path)) {
      onError(copy.updateFailed);
      return;
    }
    // Array indexes are part of the YAML path. Resetting nested expansion after
    // removal prevents an index shift from expanding the wrong sibling.
    setExpandedPaths(new Set([rootPathId]));
    onError(null);
  };

  const changeNestedType = (
    path: FrontmatterValuePath,
    type: FrontmatterPropertyType,
  ) => {
    const currentValue = getFrontmatterValueAtPath(property.value, path);
    const converted = convertFrontmatterPropertyValue(currentValue, type);
    if (!converted.ok || !applyNestedValue(path, converted.value)) {
      onError(copy.invalidValue);
      return;
    }
    setTypeOverrides((current) => ({
      ...current,
      [getStructuredPathId(path)]: type,
    }));
    setEditor(null);
  };

  const addNestedValue = (path: FrontmatterValuePath, collection: unknown) => {
    if (Array.isArray(collection)) {
      const segment = collection.length;
      const nextPath = [...path, segment];
      if (onAddValue(path, segment, "")) {
        setEditor({ draft: "", isNew: true, mode: "value", path: nextPath });
      }
      return;
    }
    if (collection && typeof collection === "object") {
      const key = getUniqueNestedKey(collection as Record<string, unknown>);
      const nextPath = [...path, key];
      if (onAddValue(path, key, "")) {
        setEditor({ draft: key, isNew: true, mode: "key", path: nextPath });
      }
    }
  };

  const handleEditorKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (editor?.isNew) removeNestedValue(editor.path);
      setEditor(null);
      onError(null);
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commitEditor(true);
    }
  };

  const renderChildren = (collection: unknown, parentPath: FrontmatterValuePath) => {
    const entries: Array<[string | number, unknown]> = Array.isArray(collection)
      ? collection.map((value, index) => [index, value])
      : collection && typeof collection === "object"
        ? Object.entries(collection as Record<string, unknown>)
        : [];

    return (
      <div className="document-property-nested-children">
        {entries.map(([key, value]) => {
          const path = [...parentPath, key];
          const pathId = getStructuredPathId(path);
          const type = getNestedType(path, value);
          const isCollection = type === "list" || type === "object";
          const isExpanded = expandedPaths.has(pathId);
          const activeEditor = editor && getStructuredPathId(editor.path) === pathId
            ? editor
            : null;
          const count = Array.isArray(value)
            ? value.length
            : value && typeof value === "object"
              ? Object.keys(value).length
              : 0;

          return (
            <div className="document-property-nested-branch" key={pathId}>
              <div className="document-property-nested-row">
                <PropertyTypeMenu
                  copy={copy}
                  label={copy.changeType(String(key))}
                  value={type}
                  onChange={(nextType) => changeNestedType(path, nextType)}
                />

                {activeEditor?.mode === "key" ? (
                  <InlineInput
                    ref={editorRef as React.RefObject<HTMLInputElement>}
                    className="document-property-key-input"
                    value={activeEditor.draft}
                    aria-label={copy.newPropertyName}
                    onChange={(event) => setEditor({ ...activeEditor, draft: event.target.value })}
                    onBlur={() => commitEditor()}
                    onKeyDown={handleEditorKeyDown}
                  />
                ) : (
                  <button
                    className={`document-property-nested-key${typeof key === "number" ? " index" : ""}`}
                    type="button"
                    onClick={() => {
                      if (typeof key === "string") {
                        setEditor({ draft: key, mode: "key", path });
                      }
                    }}
                  >
                    {typeof key === "number" ? key + 1 : key}
                  </button>
                )}

                <div className="document-property-nested-value">
                  {type === "checkbox" ? (
                    <label className="document-property-boolean">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(event) => applyNestedValue(path, event.target.checked)}
                      />
                      <span>{String(value)}</span>
                    </label>
                  ) : isCollection ? (
                    <button
                      className="document-property-collection-toggle"
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => togglePath(path)}
                    >
                      <ChevronRight size={15} aria-hidden="true" />
                      {type === "object" ? copy.fields(count) : copy.items(count)}
                    </button>
                  ) : activeEditor?.mode === "value" ? (
                    type === "text" ? (
                      <InlineTextarea
                        ref={editorRef as React.RefObject<HTMLTextAreaElement>}
                        className="document-property-value-input"
                        rows={1}
                        value={activeEditor.draft}
                        aria-label={`${String(key)} value`}
                        onChange={(event) => setEditor({ ...activeEditor, draft: event.target.value })}
                        onBlur={() => commitEditor()}
                        onKeyDown={handleEditorKeyDown}
                      />
                    ) : (
                      <InlineInput
                        ref={editorRef as React.RefObject<HTMLInputElement>}
                        className="document-property-value-input"
                        type={type === "date" ? "date" : "text"}
                        inputMode={type === "number" ? "decimal" : undefined}
                        value={activeEditor.draft}
                        placeholder={type === "datetime" ? copy.timestampPlaceholder : undefined}
                        aria-label={`${String(key)} value`}
                        onChange={(event) => setEditor({ ...activeEditor, draft: event.target.value })}
                        onBlur={() => commitEditor()}
                        onKeyDown={handleEditorKeyDown}
                      />
                    )
                  ) : (
                    <button
                      className="document-property-value-button"
                      type="button"
                      disabled={type === "empty"}
                      title={String(value ?? "")}
                      onClick={() => setEditor({
                        draft: formatFrontmatterPropertyDraft(value, type),
                        mode: "value",
                        path,
                      })}
                    >
                      {String(value ?? "") || copy.empty}
                    </button>
                  )}
                </div>

                <button
                  className="document-property-nested-remove"
                  type="button"
                  aria-label={copy.removeItem(String(key))}
                  onClick={() => removeNestedValue(path)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>

              {isCollection && isExpanded && renderChildren(value, path)}
            </div>
          );
        })}

        <button
          ref={parentPath.length === 0 ? rootAddRef : undefined}
          className="document-property-nested-add"
          type="button"
          onClick={() => addNestedValue(parentPath, collection)}
        >
          <Plus size={14} aria-hidden="true" />
          {Array.isArray(collection) ? copy.addItem : copy.addField}
        </button>
      </div>
    );
  };

  const rootExpanded = expandedPaths.has(rootPathId);
  return (
    <div className="document-property-structured-value">
      <button
        className="document-property-collection-toggle"
        type="button"
        aria-expanded={rootExpanded}
        onClick={() => togglePath([])}
      >
        <ChevronRight size={15} aria-hidden="true" />
        {property.type === "object"
          ? copy.fields(property.itemCount ?? 0)
          : copy.items(property.itemCount ?? 0)}
      </button>
      {rootExpanded && renderChildren(property.value, [])}
    </div>
  );
}

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
  const surfaceCopy = getWorkspaceSurfaceCopy(language);
  const model = useMemo(() => getFrontmatterProperties(markdown), [markdown]);
  const propertySuggestions = useMemo(() => {
    const workspaceSuggestions = getWorkspaceFrontmatterPropertySuggestions(
      workspaceMarkdownDocuments,
    );
    const workspaceKeys = new Set(workspaceSuggestions.map(({ key }) => key.toLowerCase()));
    return [
      ...workspaceSuggestions,
      ...frontmatterPropertySuggestions.filter(({ key }) => !workspaceKeys.has(key)),
    ];
  }, [workspaceMarkdownDocuments]);
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
      allowFrontmatterChanges: true,
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
      (property) => property.key.toLowerCase() === suggestion.key,
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
                  <PropertyTypeMenu
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
                            () => commitValueEdit(property),
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
                            () => commitValueEdit(property),
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
              <PropertyTypeMenu
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
                    ? copy.usedInDocuments(suggestion.usageCount)
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
