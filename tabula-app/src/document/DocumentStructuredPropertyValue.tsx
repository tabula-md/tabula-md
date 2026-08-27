import { ChevronRight, Plus, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  convertFrontmatterPropertyValue,
  formatFrontmatterPropertyDraft,
  getFrontmatterValueAtPath,
  getFrontmatterValueType,
  parseFrontmatterPropertyDraft,
  type FrontmatterProperty,
  type FrontmatterPropertyType,
  type FrontmatterValuePath,
} from "@tabula-md/tabula";
import { InlineInput, InlineTextarea } from "../ui/InlineField";
import type { DocumentPropertiesCopy } from "./documentPropertiesLocale";
import { DocumentPropertyTypeMenu } from "./DocumentPropertyTypeMenu";
import type { FrontmatterPropertyTypeHint } from "./frontmatterPropertySuggestions";

type StructuredValueEditor = {
  draft: string;
  isNew?: boolean;
  mode: "key" | "value";
  path: FrontmatterValuePath;
};

const getStructuredPathId = (path: FrontmatterValuePath) => JSON.stringify(path);

const getUniqueNestedKey = (value: Record<string, unknown>) => {
  if (!("property" in value)) return "property";
  let suffix = 2;
  while (`property ${suffix}` in value) suffix += 1;
  return `property ${suffix}`;
};

export function StructuredPropertyValue({
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
                <DocumentPropertyTypeMenu
                  copy={copy}
                  label={copy.changeType(String(key))}
                  value={type}
                  onChange={(nextType) => changeNestedType(path, nextType)}
                />

                {activeEditor?.mode === "key" ? (
                  <InlineInput
                    ref={editorRef as RefObject<HTMLInputElement>}
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
                        ref={editorRef as RefObject<HTMLTextAreaElement>}
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
                        ref={editorRef as RefObject<HTMLInputElement>}
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
