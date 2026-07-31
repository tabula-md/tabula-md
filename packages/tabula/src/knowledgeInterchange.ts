import type {
  DocumentAnalysis,
  WorkspaceKnowledgeIndex,
} from "./workspaceKnowledgeIndex";

export type JsonLdValue =
  | null
  | boolean
  | number
  | string
  | JsonLdValue[]
  | { readonly [key: string]: JsonLdValue };

export type KnowledgeInterchangeLossCode =
  | "ambiguous_link_not_exported"
  | "blank_node_identity_unstable"
  | "broken_link_not_exported"
  | "canonical_iri_duplicate"
  | "context_not_fetched"
  | "frontmatter_field_not_mapped"
  | "json_invalid"
  | "link_label_not_round_trippable"
  | "markdown_body_not_exported"
  | "node_identifier_missing"
  | "node_label_missing"
  | "property_not_mapped";

export type KnowledgeInterchangeLoss = {
  code: KnowledgeInterchangeLossCode;
  documentId?: string;
  path?: string;
  nodeId?: string;
  property?: string;
  value?: string;
};

export type KnowledgeInterchangeMapping = {
  documentId: string;
  path: string;
  canonicalIri: string;
  mappedProperties: readonly string[];
};

export type KnowledgeInterchangeExport = {
  format: "json-ld" | "skos";
  mediaType: "application/ld+json";
  document: Readonly<Record<string, JsonLdValue>>;
  json: string;
  mappings: readonly KnowledgeInterchangeMapping[];
  losses: readonly KnowledgeInterchangeLoss[];
  roundTrip: "partial";
  workspaceSourceChanged: false;
  rdfStoreRequired: false;
};

export type KnowledgeInterchangeExportOptions = {
  baseIri: string;
  schemeIri?: string;
  schemeTitle?: string;
};

export type JsonLdImportCandidate = {
  sourceNodeId: string;
  proposedPath: string;
  title: string;
  description?: string;
  resource: string;
  type?: string;
  tags: readonly string[];
  sources: readonly string[];
  links: readonly string[];
  mappedProperties: readonly string[];
  unmappedProperties: readonly string[];
  roundTrip: "partial";
};

export type JsonLdImportPreview = {
  valid: boolean;
  candidates: readonly JsonLdImportCandidate[];
  losses: readonly KnowledgeInterchangeLoss[];
  requiresReview: true;
  workspaceSourceChanged: false;
  rdfStoreCreated: false;
};

const SKOS = "http://www.w3.org/2004/02/skos/core#";
const SCHEMA = "https://schema.org/";
const DCTERMS = "http://purl.org/dc/terms/";
const TABULA = "https://tabula.md/ns/knowledge#";

const JSON_LD_CONTEXT: Readonly<Record<string, JsonLdValue>> = {
  "@version": 1.1,
  skos: SKOS,
  schema: SCHEMA,
  dcterms: DCTERMS,
  tabula: TABULA,
};

const knownFrontmatterFields = new Set([
  "description",
  "generated",
  "okf_version",
  "private",
  "resource",
  "sources",
  "stale_after",
  "status",
  "tags",
  "type",
  "verified",
  "visibility",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const getAbsoluteIri = (value: string, baseIri: string) => {
  try {
    return new URL(value, baseIri).href;
  } catch {
    throw new Error(`Invalid IRI: ${value}`);
  }
};

const getCanonicalIri = (
  analysis: DocumentAnalysis,
  baseIri: string,
) => getAbsoluteIri(
  analysis.knowledgeMetadata.resource || analysis.path,
  baseIri,
);

const getMappedProperties = (
  analysis: DocumentAnalysis,
  format: KnowledgeInterchangeExport["format"],
) => [
  "skos:prefLabel",
  "tabula:path",
  ...(format === "skos" ? ["skos:inScheme"] : []),
  ...(analysis.knowledgeMetadata.description ? ["skos:definition"] : []),
  ...(analysis.knowledgeMetadata.type ? ["tabula:knowledgeType"] : []),
  ...(analysis.knowledgeMetadata.tags.length > 0 ? ["schema:keywords"] : []),
  ...(analysis.knowledgeMetadata.sources.length > 0 ? ["dcterms:source"] : []),
];

const createExport = (
  index: WorkspaceKnowledgeIndex,
  options: KnowledgeInterchangeExportOptions,
  format: KnowledgeInterchangeExport["format"],
): KnowledgeInterchangeExport => {
  const baseIri = getAbsoluteIri(".", options.baseIri);
  const schemeIri = getAbsoluteIri(
    options.schemeIri ?? "#concept-scheme",
    baseIri,
  );
  const analyses = [...index.analysesByDocumentId.values()]
    .sort((first, second) => first.path.localeCompare(second.path));
  const iriByDocumentId = new Map(
    analyses.map((analysis) => [
      analysis.documentId,
      getCanonicalIri(analysis, baseIri),
    ]),
  );
  const mappings: KnowledgeInterchangeMapping[] = [];
  const losses: KnowledgeInterchangeLoss[] = [];
  const graph: Record<string, JsonLdValue>[] = [];
  const documentIdsByIri = new Map<string, string[]>();
  for (const [documentId, iri] of iriByDocumentId) {
    documentIdsByIri.set(iri, [
      ...(documentIdsByIri.get(iri) ?? []),
      documentId,
    ]);
  }

  if (format === "skos") {
    graph.push({
      "@id": schemeIri,
      "@type": "skos:ConceptScheme",
      "skos:prefLabel": options.schemeTitle?.trim() || "Tabula knowledge workspace",
    });
  }

  for (const analysis of analyses) {
    const canonicalIri = iriByDocumentId.get(analysis.documentId)!;
    const mappedProperties = getMappedProperties(analysis, format);
    const links = index.outgoingLinksByDocumentId.get(analysis.documentId) ?? [];
    const graphEdges = links.flatMap((link) => {
      if (link.status === "resolved" && link.targetDocumentId) {
        const targetIri = iriByDocumentId.get(link.targetDocumentId);
        return targetIri ? [{ "@id": targetIri }] : [];
      }
      if (link.status === "external") {
        try {
          return [{ "@id": getAbsoluteIri(link.target, canonicalIri) }];
        } catch {
          return [];
        }
      }
      losses.push({
        code: link.status === "ambiguous"
          ? "ambiguous_link_not_exported"
          : "broken_link_not_exported",
        documentId: analysis.documentId,
        path: analysis.path,
        value: link.target,
      });
      return [];
    });
    if (links.length > 0) {
      losses.push({
        code: "link_label_not_round_trippable",
        documentId: analysis.documentId,
        path: analysis.path,
      });
      if (graphEdges.length > 0) mappedProperties.push("tabula:linksTo");
    }
    for (const field of Object.keys(analysis.metadata)) {
      if (!knownFrontmatterFields.has(field)) {
        losses.push({
          code: "frontmatter_field_not_mapped",
          documentId: analysis.documentId,
          path: analysis.path,
          property: field,
        });
      }
    }
    losses.push({
      code: "markdown_body_not_exported",
      documentId: analysis.documentId,
      path: analysis.path,
    });
    if ((documentIdsByIri.get(canonicalIri)?.length ?? 0) > 1) {
      losses.push({
        code: "canonical_iri_duplicate",
        documentId: analysis.documentId,
        path: analysis.path,
        value: `Duplicate canonical IRI: ${canonicalIri}`,
      });
    }

    const node: Record<string, JsonLdValue> = {
      "@id": canonicalIri,
      "@type": "skos:Concept",
      "skos:prefLabel": analysis.title,
      "tabula:path": analysis.path,
      ...(format === "skos"
        ? { "skos:inScheme": { "@id": schemeIri } }
        : {}),
      ...(analysis.knowledgeMetadata.description
        ? { "skos:definition": analysis.knowledgeMetadata.description }
        : {}),
      ...(analysis.knowledgeMetadata.type
        ? { "tabula:knowledgeType": analysis.knowledgeMetadata.type }
        : {}),
      ...(analysis.knowledgeMetadata.tags.length > 0
        ? { "schema:keywords": [...analysis.knowledgeMetadata.tags] }
        : {}),
      ...(analysis.knowledgeMetadata.sources.length > 0
        ? {
            "dcterms:source": analysis.knowledgeMetadata.sources.map((source) => ({
              "@id": getAbsoluteIri(source.resource, canonicalIri),
            })),
          }
        : {}),
      ...(graphEdges.length > 0 ? { "tabula:linksTo": graphEdges } : {}),
    };
    graph.push(node);
    mappings.push({
      documentId: analysis.documentId,
      path: analysis.path,
      canonicalIri,
      mappedProperties,
    });
  }

  const document: Record<string, JsonLdValue> = {
    "@context": JSON_LD_CONTEXT,
    "@graph": graph,
  };
  return {
    format,
    mediaType: "application/ld+json",
    document,
    json: `${JSON.stringify(document, null, 2)}\n`,
    mappings,
    losses,
    roundTrip: "partial",
    workspaceSourceChanged: false,
    rdfStoreRequired: false,
  };
};

export const exportWorkspaceJsonLd = (
  index: WorkspaceKnowledgeIndex,
  options: KnowledgeInterchangeExportOptions,
) => createExport(index, options, "json-ld");

export const exportWorkspaceSkosConceptScheme = (
  index: WorkspaceKnowledgeIndex,
  options: KnowledgeInterchangeExportOptions,
) => createExport(index, options, "skos");

const contextPrefixes = (context: unknown) => {
  const prefixes = new Map<string, string>([
    ["skos", SKOS],
    ["schema", SCHEMA],
    ["dcterms", DCTERMS],
    ["tabula", TABULA],
  ]);
  const aliases = new Map<string, string>();
  if (!isRecord(context)) return { aliases, prefixes };
  for (const [term, definition] of Object.entries(context)) {
    if (term.startsWith("@")) continue;
    if (typeof definition === "string") {
      if (/^[a-z][a-z0-9+.-]*:[^/]*$/i.test(definition)) {
        aliases.set(term, definition);
      } else if (/^[a-z][a-z0-9+.-]*:/i.test(definition)) {
        prefixes.set(term, definition);
      }
    } else if (isRecord(definition) && typeof definition["@id"] === "string") {
      aliases.set(term, definition["@id"]);
    }
  }
  return { aliases, prefixes };
};

const expandTerm = (
  term: string,
  context: ReturnType<typeof contextPrefixes>,
) => {
  const aliased = context.aliases.get(term);
  if (aliased) return expandTerm(aliased, context);
  const separator = term.indexOf(":");
  if (separator > 0) {
    const prefix = context.prefixes.get(term.slice(0, separator));
    if (prefix) return `${prefix}${term.slice(separator + 1)}`;
  }
  return term;
};

const values = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : typeof value === "undefined" ? [] : [value];

const stringValues = (value: unknown) => values(value).flatMap((candidate) => {
  if (typeof candidate === "string") return [candidate];
  if (isRecord(candidate) && typeof candidate["@value"] === "string") {
    return [candidate["@value"]];
  }
  return [];
});

const idValues = (value: unknown) => values(value).flatMap((candidate) => {
  if (typeof candidate === "string") return [candidate];
  if (isRecord(candidate) && typeof candidate["@id"] === "string") {
    return [candidate["@id"]];
  }
  return [];
});

const slugPath = (title: string, nodeId: string) => {
  const source = title || nodeId.split(/[/#]/).filter(Boolean).at(-1) || "concept";
  const slug = source
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "concept"}.md`;
};

const safeMarkdownPath = (value: string | undefined) => {
  if (
    !value
    || value.startsWith("/")
    || value.split("/").includes("..")
    || !/\.md(?:own)?$/i.test(value)
  ) {
    return undefined;
  }
  return value.replace(/^\.\//, "");
};

export const previewJsonLdImport = (
  source: string | unknown,
): JsonLdImportPreview => {
  let parsed: unknown = source;
  if (typeof source === "string") {
    try {
      parsed = JSON.parse(source);
    } catch {
      return {
        valid: false,
        candidates: [],
        losses: [{ code: "json_invalid" }],
        requiresReview: true,
        workspaceSourceChanged: false,
        rdfStoreCreated: false,
      };
    }
  }
  if (!isRecord(parsed)) {
    return {
      valid: false,
      candidates: [],
      losses: [{ code: "json_invalid" }],
      requiresReview: true,
      workspaceSourceChanged: false,
      rdfStoreCreated: false,
    };
  }

  const losses: KnowledgeInterchangeLoss[] = [];
  const contextValue = parsed["@context"];
  if (
    typeof contextValue === "string"
    || Array.isArray(contextValue)
      && contextValue.some((entry) => typeof entry === "string")
  ) {
    losses.push({
      code: "context_not_fetched",
      value: typeof contextValue === "string"
        ? contextValue
        : contextValue.filter((entry) => typeof entry === "string").join(", "),
    });
  }
  const localContext = Array.isArray(contextValue)
    ? contextValue.find(isRecord)
    : contextValue;
  const context = contextPrefixes(localContext);
  const graph = Array.isArray(parsed["@graph"])
    ? parsed["@graph"].filter(isRecord)
    : [parsed];
  const candidates: JsonLdImportCandidate[] = [];

  for (const node of graph) {
    const sourceNodeId = typeof node["@id"] === "string" ? node["@id"] : "";
    const expandedEntries = new Map<string, { key: string; value: unknown }>();
    for (const [key, value] of Object.entries(node)) {
      expandedEntries.set(expandTerm(key, context), { key, value });
    }
    const expandedTypes = stringValues(node["@type"])
      .map((type) => expandTerm(type, context));
    if (
      expandedTypes.includes(`${SKOS}ConceptScheme`)
      || !expandedTypes.includes(`${SKOS}Concept`)
        && expandedTypes.length > 0
    ) {
      continue;
    }
    if (!sourceNodeId) {
      losses.push({ code: "node_identifier_missing" });
      continue;
    }
    if (sourceNodeId.startsWith("_:")) {
      losses.push({
        code: "blank_node_identity_unstable",
        nodeId: sourceNodeId,
      });
    }
    const title = stringValues(
      expandedEntries.get(`${SKOS}prefLabel`)?.value,
    )[0] ?? "";
    if (!title) {
      losses.push({ code: "node_label_missing", nodeId: sourceNodeId });
    }
    const description = stringValues(
      expandedEntries.get(`${SKOS}definition`)?.value,
    )[0];
    const type = stringValues(
      expandedEntries.get(`${TABULA}knowledgeType`)?.value,
    )[0];
    const tags = stringValues(
      expandedEntries.get(`${SCHEMA}keywords`)?.value,
    );
    const sources = idValues(
      expandedEntries.get(`${DCTERMS}source`)?.value,
    );
    const links = idValues(
      expandedEntries.get(`${TABULA}linksTo`)?.value,
    );
    const pathValue = stringValues(
      expandedEntries.get(`${TABULA}path`)?.value,
    )[0];
    const recognized = new Set([
      "@context",
      "@graph",
      "@id",
      "@type",
      `${SKOS}prefLabel`,
      `${SKOS}definition`,
      `${SCHEMA}keywords`,
      `${DCTERMS}source`,
      `${TABULA}knowledgeType`,
      `${TABULA}linksTo`,
      `${TABULA}path`,
    ]);
    const unmappedProperties = [...expandedEntries.entries()]
      .filter(([expanded]) => !recognized.has(expanded))
      .map(([, entry]) => entry.key);
    unmappedProperties.forEach((property) => losses.push({
      code: "property_not_mapped",
      nodeId: sourceNodeId,
      property,
    }));
    const mappedProperties = [...expandedEntries.entries()]
      .filter(([expanded]) => recognized.has(expanded))
      .map(([, entry]) => entry.key)
      .filter((key) => !key.startsWith("@"));
    candidates.push({
      sourceNodeId,
      proposedPath:
        safeMarkdownPath(pathValue) ?? slugPath(title, sourceNodeId),
      title: title || sourceNodeId,
      ...(description ? { description } : {}),
      resource: sourceNodeId,
      ...(type ? { type } : {}),
      tags,
      sources,
      links,
      mappedProperties,
      unmappedProperties,
      roundTrip: "partial",
    });
  }

  return {
    valid: candidates.length > 0
      && !losses.some((loss) =>
        loss.code === "json_invalid" || loss.code === "node_identifier_missing"
      ),
    candidates,
    losses,
    requiresReview: true,
    workspaceSourceChanged: false,
    rdfStoreCreated: false,
  };
};
