import type { FrontmatterPropertyType } from "@tabula-md/tabula";

export type FrontmatterPropertySuggestion = {
  draft: string;
  key: string;
  type: FrontmatterPropertyType;
};

// These are authoring hints, not a schema. OKF permits producer-defined keys,
// so callers must always keep free-form property names available.
export const frontmatterPropertySuggestions: FrontmatterPropertySuggestion[] = [
  { key: "type", type: "text", draft: "" },
  { key: "title", type: "text", draft: "" },
  { key: "description", type: "text", draft: "" },
  { key: "resource", type: "text", draft: "" },
  { key: "tags", type: "list", draft: "[]" },
  { key: "status", type: "text", draft: "stable" },
  { key: "generated", type: "object", draft: "{}" },
  { key: "verified", type: "list", draft: "[]" },
  { key: "stale_after", type: "datetime", draft: "" },
  { key: "sources", type: "list", draft: "[]" },
  { key: "runtime", type: "text", draft: "" },
  { key: "parameters", type: "list", draft: "[]" },
  { key: "computation", type: "text", draft: "" },
  { key: "executor", type: "object", draft: "{}" },
  { key: "attester", type: "object", draft: "{}" },
];

export const getFrontmatterPropertySuggestion = (key: string) => {
  const normalizedKey = key.trim().toLowerCase();
  return frontmatterPropertySuggestions.find((suggestion) => suggestion.key === normalizedKey);
};
