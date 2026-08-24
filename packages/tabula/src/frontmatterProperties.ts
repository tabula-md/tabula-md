import { parseDocument, stringify } from "yaml";
import { inspectFrontmatterData } from "./markdown/parse";

export type FrontmatterScalar = string | number | boolean;

export type FrontmatterPropertyKind =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "empty"
  | "scalar-list"
  | "structured-list"
  | "mapping";

export type FrontmatterPropertyType =
  | "text"
  | "number"
  | "checkbox"
  | "date"
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

const isScalar = (value: unknown): value is FrontmatterScalar =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?$/;

const isDateValue = (value: unknown): value is string =>
  typeof value === "string" &&
  ISO_DATE_PATTERN.test(value) &&
  !Number.isNaN(Date.parse(value));

const getPropertyKind = (value: unknown): FrontmatterPropertyKind => {
  if (value === null || typeof value === "undefined") return "empty";
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
    case "scalar-list":
    case "structured-list":
      return "list";
    case "mapping":
      return "object";
    default:
      return "text";
  }
};

const stringifyPropertyValue = (value: unknown) => stringify(value, {
  lineWidth: 0,
}).replace(/\n$/, "");

export const formatFrontmatterPropertyDraft = (
  value: unknown,
  type: FrontmatterPropertyType,
) => {
  if (type === "text" || type === "date") return value == null ? "" : String(value);
  if (type === "number") return typeof value === "number" ? String(value) : "0";
  if (type === "checkbox") return value === true ? "true" : "false";
  return stringifyPropertyValue(value);
};

export const parseFrontmatterPropertyDraft = (
  draft: string,
  type: FrontmatterPropertyType,
): FrontmatterPropertyValueResult => {
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
): FrontmatterPropertyValueResult => {
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
    if (typeof value === "number" && Number.isFinite(value)) return { ok: true, value };
    if (typeof value === "boolean") return { ok: true, value: value ? 1 : 0 };
    const converted = typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(converted) ? { ok: true, value: converted } : { ok: false };
  }
  if (type === "checkbox") {
    if (typeof value === "boolean") return { ok: true, value };
    if (value === "true" || value === 1) return { ok: true, value: true };
    if (value === "false" || value === 0) return { ok: true, value: false };
    return { ok: false };
  }
  if (type === "date") {
    return { ok: true, value: isDateValue(value) ? value : fallbackDate };
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
        type: getPropertyType(kind),
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
