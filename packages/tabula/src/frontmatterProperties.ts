import { parseDocument, stringify } from "yaml";
import { inspectFrontmatterData } from "./markdown/parse";

export type FrontmatterScalar = string | number | boolean;

export type FrontmatterPropertyKind =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "empty"
  | "scalar-list"
  | "structured-list"
  | "mapping";

export type FrontmatterPropertyType =
  | "text"
  | "number"
  | "checkbox"
  | "date"
  | "datetime"
  | "empty"
  | "list"
  | "object";

export type FrontmatterProperty = {
  key: string;
  kind: FrontmatterPropertyKind;
  type: FrontmatterPropertyType;
  value: unknown;
  itemCount?: number;
};

export type FrontmatterPropertiesModel = {
  status: "absent" | "valid" | "invalid";
  properties: FrontmatterProperty[];
  bodyOffset: number;
};

export type FrontmatterPropertyValueResult =
  | { ok: true; value: unknown }
  | { ok: false };

export type FrontmatterValuePath = readonly (string | number)[];

export type FrontmatterValueMutationResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      reason: "duplicate_key" | "invalid_key" | "invalid_path";
    };

const isScalar = (value: unknown): value is FrontmatterScalar =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

const isDateValue = (value: unknown): value is string =>
  typeof value === "string" &&
  ISO_DATE_PATTERN.test(value) &&
  !Number.isNaN(Date.parse(value));

const isDateTimeValue = (value: unknown): value is string =>
  typeof value === "string" &&
  ISO_DATETIME_PATTERN.test(value) &&
  !Number.isNaN(Date.parse(value));

const getPropertyKind = (value: unknown): FrontmatterPropertyKind => {
  if (value === null || typeof value === "undefined") return "empty";
  if (isDateTimeValue(value)) return "datetime";
  if (isDateValue(value)) return "date";
  if (typeof value === "string") return "text";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) {
    return value.every(isScalar) ? "scalar-list" : "structured-list";
  }
  return "mapping";
};

const getPropertyType = (kind: FrontmatterPropertyKind): FrontmatterPropertyType => {
  switch (kind) {
    case "number":
      return "number";
    case "boolean":
      return "checkbox";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "empty":
      return "empty";
    case "scalar-list":
    case "structured-list":
      return "list";
    case "mapping":
      return "object";
    default:
      return "text";
  }
};

export const getFrontmatterValueType = (value: unknown): FrontmatterPropertyType =>
  getPropertyType(getPropertyKind(value));

const isMappingValue = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const getFrontmatterValueAtPath = (
  value: unknown,
  path: FrontmatterValuePath,
) => path.reduce<unknown>((current, segment) => {
  if (typeof segment === "number") {
    return Array.isArray(current) ? current[segment] : undefined;
  }
  return isMappingValue(current) ? current[segment] : undefined;
}, value);

export const updateFrontmatterValueAtPath = (
  value: unknown,
  path: FrontmatterValuePath,
  nextValue: unknown,
): FrontmatterValueMutationResult => {
  if (path.length === 0) return { ok: true, value: nextValue };

  const [segment, ...rest] = path;
  if (typeof segment === "number") {
    if (!Array.isArray(value) || segment < 0 || segment > value.length) {
      return { ok: false, reason: "invalid_path" };
    }
    const nextItems = [...value];
    const child = updateFrontmatterValueAtPath(nextItems[segment], rest, nextValue);
    if (!child.ok) return child;
    nextItems[segment] = child.value;
    return { ok: true, value: nextItems };
  }

  if (!isMappingValue(value)) return { ok: false, reason: "invalid_path" };
  const child = updateFrontmatterValueAtPath(value[segment], rest, nextValue);
  if (!child.ok) return child;
  return { ok: true, value: { ...value, [segment]: child.value } };
};

export const removeFrontmatterValueAtPath = (
  value: unknown,
  path: FrontmatterValuePath,
): FrontmatterValueMutationResult => {
  if (path.length === 0) return { ok: false, reason: "invalid_path" };
  const parentPath = path.slice(0, -1);
  const segment = path.at(-1);
  const parent = getFrontmatterValueAtPath(value, parentPath);

  if (typeof segment === "number") {
    if (!Array.isArray(parent) || segment < 0 || segment >= parent.length) {
      return { ok: false, reason: "invalid_path" };
    }
    const nextParent = [...parent];
    nextParent.splice(segment, 1);
    return updateFrontmatterValueAtPath(value, parentPath, nextParent);
  }

  if (typeof segment !== "string" || !isMappingValue(parent) || !(segment in parent)) {
    return { ok: false, reason: "invalid_path" };
  }
  const nextParent = { ...parent };
  delete nextParent[segment];
  return updateFrontmatterValueAtPath(value, parentPath, nextParent);
};

export const renameFrontmatterValuePathKey = (
  value: unknown,
  path: FrontmatterValuePath,
  nextKey: string,
): FrontmatterValueMutationResult => {
  const normalizedKey = nextKey.trim();
  if (!normalizedKey || /[\r\n]/.test(normalizedKey)) {
    return { ok: false, reason: "invalid_key" };
  }
  const currentKey = path.at(-1);
  const parentPath = path.slice(0, -1);
  const parent = getFrontmatterValueAtPath(value, parentPath);
  if (typeof currentKey !== "string" || !isMappingValue(parent) || !(currentKey in parent)) {
    return { ok: false, reason: "invalid_path" };
  }
  if (normalizedKey !== currentKey && normalizedKey in parent) {
    return { ok: false, reason: "duplicate_key" };
  }
  if (normalizedKey === currentKey) return { ok: true, value };

  const nextParent = Object.fromEntries(
    Object.entries(parent).map(([key, child]) => [
      key === currentKey ? normalizedKey : key,
      child,
    ]),
  );
  return updateFrontmatterValueAtPath(value, parentPath, nextParent);
};

const stringifyPropertyValue = (value: unknown) => stringify(value, {
  lineWidth: 0,
}).replace(/\n$/, "");

export const formatFrontmatterPropertyDraft = (
  value: unknown,
  type: FrontmatterPropertyType,
) => {
  if (type === "empty") return "";
  if (type === "text" || type === "date" || type === "datetime") {
    return value == null ? "" : String(value);
  }
  if (type === "number") return typeof value === "number" ? String(value) : "0";
  if (type === "checkbox") return value === true ? "true" : "false";
  return stringifyPropertyValue(value);
};

export const parseFrontmatterPropertyDraft = (
  draft: string,
  type: FrontmatterPropertyType,
): FrontmatterPropertyValueResult => {
  if (type === "empty") return { ok: true, value: null };
  if (type === "text") return { ok: true, value: draft };
  if (type === "number") {
    const value = Number(draft);
    return draft.trim() && Number.isFinite(value) ? { ok: true, value } : { ok: false };
  }
  if (type === "checkbox") {
    return draft === "true" || draft === "false"
      ? { ok: true, value: draft === "true" }
      : { ok: false };
  }
  if (type === "date") {
    return isDateValue(draft) ? { ok: true, value: draft } : { ok: false };
  }
  if (type === "datetime") {
    return isDateTimeValue(draft) ? { ok: true, value: draft } : { ok: false };
  }

  const document = parseDocument(draft, { prettyErrors: false });
  if (document.errors.length || document.contents === null) return { ok: false };
  const value = document.toJSON();
  if (type === "list") return Array.isArray(value) ? { ok: true, value } : { ok: false };
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ok: true, value }
    : { ok: false };
};

export const convertFrontmatterPropertyValue = (
  value: unknown,
  type: FrontmatterPropertyType,
  fallbackDate = new Date().toISOString().slice(0, 10),
  fallbackDateTime = new Date().toISOString(),
): FrontmatterPropertyValueResult => {
  if (type === "empty") return { ok: true, value: null };
  if (type === "text") {
    return {
      ok: true,
      value: value == null
        ? ""
        : typeof value === "object"
          ? stringifyPropertyValue(value)
          : String(value),
    };
  }
  if (type === "number") {
    if (value == null) return { ok: true, value: 0 };
    if (typeof value === "number" && Number.isFinite(value)) return { ok: true, value };
    if (typeof value === "boolean") return { ok: true, value: value ? 1 : 0 };
    const converted = typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(converted) ? { ok: true, value: converted } : { ok: false };
  }
  if (type === "checkbox") {
    if (value == null) return { ok: true, value: false };
    if (typeof value === "boolean") return { ok: true, value };
    if (value === "true" || value === 1) return { ok: true, value: true };
    if (value === "false" || value === 0) return { ok: true, value: false };
    return { ok: false };
  }
  if (type === "date") {
    return { ok: true, value: isDateValue(value) ? value : fallbackDate };
  }
  if (type === "datetime") {
    return { ok: true, value: isDateTimeValue(value) ? value : fallbackDateTime };
  }
  if (type === "list") {
    if (Array.isArray(value)) return { ok: true, value };
    return { ok: true, value: value == null ? [] : [value] };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ok: true, value };
  }
  return { ok: true, value: value == null ? {} : { value } };
};

export const getFrontmatterProperties = (markdown: string): FrontmatterPropertiesModel => {
  const inspection = inspectFrontmatterData(markdown);
  return {
    status: inspection.status,
    bodyOffset: inspection.bodyOffset,
    properties: Object.entries(inspection.metadata).map(([key, value]) => {
      const kind = getPropertyKind(value);
      return {
        key,
        kind,
        type: getFrontmatterValueType(value),
        value,
        ...(Array.isArray(value)
          ? { itemCount: value.length }
          : value && typeof value === "object"
            ? { itemCount: Object.keys(value).length }
            : {}),
      };
    }),
  };
};
