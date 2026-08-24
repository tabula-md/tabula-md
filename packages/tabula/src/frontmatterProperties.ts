import { inspectFrontmatterData } from "./markdown/parse";

export type FrontmatterScalar = string | number | boolean;

export type FrontmatterPropertyKind =
  | "text"
  | "number"
  | "boolean"
  | "empty"
  | "scalar-list"
  | "structured-list"
  | "mapping";

export type FrontmatterProperty = {
  key: string;
  kind: FrontmatterPropertyKind;
  value: unknown;
  editable: boolean;
  itemCount?: number;
};

export type FrontmatterPropertiesModel = {
  status: "absent" | "valid" | "invalid";
  properties: FrontmatterProperty[];
  bodyOffset: number;
};

const isScalar = (value: unknown): value is FrontmatterScalar =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const isEditableScalarList = (value: unknown[]) =>
  value.every((item) => typeof item === "string") ||
  value.every((item) => typeof item === "number") ||
  value.every((item) => typeof item === "boolean");

const getPropertyKind = (value: unknown): FrontmatterPropertyKind => {
  if (value === null || typeof value === "undefined") return "empty";
  if (typeof value === "string") return "text";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) {
    return value.every(isScalar) ? "scalar-list" : "structured-list";
  }
  return "mapping";
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
        value,
        editable:
          kind === "text" ||
          kind === "number" ||
          kind === "boolean" ||
          (kind === "scalar-list" && isEditableScalarList(value as unknown[])),
        ...(Array.isArray(value)
          ? { itemCount: value.length }
          : value && typeof value === "object"
            ? { itemCount: Object.keys(value).length }
            : {}),
      };
    }),
  };
};
