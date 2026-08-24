import {
  convertFrontmatterPropertyValue,
  formatFrontmatterPropertyDraft,
  getFrontmatterProperties,
  type FrontmatterProperty,
  type FrontmatterPropertyType,
  type FrontmatterValuePath,
} from "@tabula-md/tabula";

export type FrontmatterPropertyTypeHint = {
  path: FrontmatterValuePath;
  type: FrontmatterPropertyType;
};

export type FrontmatterPropertySuggestion = {
  description: string;
  draft: string;
  key: string;
  type: FrontmatterPropertyType;
  typeHints?: FrontmatterPropertyTypeHint[];
  usageCount?: number;
};

// These are authoring hints, not a schema. OKF permits producer-defined keys,
// so callers must always keep free-form property names available.
export const frontmatterPropertySuggestions: FrontmatterPropertySuggestion[] = [
  { key: "type", type: "text", draft: "", description: "Concept type" },
  { key: "title", type: "text", draft: "", description: "Display name" },
  { key: "description", type: "text", draft: "", description: "Short summary" },
  { key: "resource", type: "text", draft: "", description: "Canonical URI" },
  { key: "tags", type: "list", draft: "[]", description: "Categories" },
  { key: "status", type: "text", draft: "stable", description: "Lifecycle state" },
  {
    key: "generated",
    type: "object",
    draft: 'by: ""\nat: ""',
    description: "Provenance event",
    typeHints: [{ path: ["at"], type: "datetime" }],
  },
  {
    key: "verified",
    type: "list",
    draft: '- by: ""\n  at: ""',
    description: "Verification events",
    typeHints: [{ path: [0, "at"], type: "datetime" }],
  },
  { key: "stale_after", type: "datetime", draft: "", description: "Freshness deadline" },
  { key: "sources", type: "list", draft: '- resource: ""', description: "Evidence sources" },
  { key: "runtime", type: "text", draft: "", description: "Computation runtime" },
  {
    key: "parameters",
    type: "list",
    draft: '- name: ""\n  type: string\n  required: true',
    description: "Typed computation inputs",
    typeHints: [{ path: [0, "required"], type: "checkbox" }],
  },
  { key: "computation", type: "text", draft: "", description: "Computation file path" },
  { key: "executor", type: "object", draft: 'resource: ""\nreceipt: []', description: "Execution contract" },
  { key: "attester", type: "object", draft: 'resource: ""', description: "Deterministic verifier" },
];

export const getFrontmatterPropertySuggestion = (key: string) => {
  const normalizedKey = key.trim().toLowerCase();
  return frontmatterPropertySuggestions.find((suggestion) => suggestion.key === normalizedKey);
};

export const getSuggestedFrontmatterPropertyState = (key: string) => {
  const suggestion = getFrontmatterPropertySuggestion(key);
  return suggestion
    ? { type: suggestion.type, draft: suggestion.draft }
    : { type: "text" as const, draft: "" };
};

const getEmptyDraftForType = (type: FrontmatterPropertyType) => {
  if (type === "text" || type === "date" || type === "datetime" || type === "empty") {
    return "";
  }
  const converted = convertFrontmatterPropertyValue(undefined, type);
  return converted.ok ? formatFrontmatterPropertyDraft(converted.value, type) : "";
};

const getPreferredWorkspaceType = (properties: FrontmatterProperty[]) => {
  const counts = new Map<FrontmatterPropertyType, number>();
  properties.forEach(({ type }) => counts.set(type, (counts.get(type) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "text";
};

export const getWorkspaceFrontmatterPropertySuggestions = (
  markdownDocuments: readonly string[],
): FrontmatterPropertySuggestion[] => {
  const propertiesByKey = new Map<string, FrontmatterProperty[]>();
  markdownDocuments.forEach((markdown) => {
    const model = getFrontmatterProperties(markdown);
    if (model.status !== "valid") return;
    model.properties.forEach((property) => {
      const normalizedKey = property.key.toLowerCase();
      const properties = propertiesByKey.get(normalizedKey) ?? [];
      properties.push(property);
      propertiesByKey.set(normalizedKey, properties);
    });
  });

  return [...propertiesByKey.entries()]
    .map(([normalizedKey, properties]) => {
      const builtIn = getFrontmatterPropertySuggestion(normalizedKey);
      if (builtIn) return { ...builtIn, usageCount: properties.length };
      const type = getPreferredWorkspaceType(properties);
      return {
        key: properties[0]?.key ?? normalizedKey,
        type,
        draft: getEmptyDraftForType(type),
        description: "Workspace field",
        usageCount: properties.length,
      };
    })
    .sort((left, right) =>
      (right.usageCount ?? 0) - (left.usageCount ?? 0) || left.key.localeCompare(right.key));
};
