import { setOkfConceptType } from "./workspaceOkfConceptType";
import type {
  OkfCompatibilityIssueCode,
  OkfCompatibilityReport,
} from "./workspaceOkfCompatibility";
import type {
  WorkspaceKnowledgeIndex,
  WorkspaceSourceDocument,
} from "./workspaceKnowledgeIndex";
import { applyTextPatches, type TextPatch } from "./textPatches";

export const TABULA_GENERATED_OKF_INDEX_MARKER =
  "<!-- tabula.md:generated-okf-index -->";

export type OkfTypeSuggestionSource = "folder" | "path";
export type OkfTypeSuggestion = {
  type: string;
  source: OkfTypeSuggestionSource;
};

export type OkfConceptRepairCandidate = {
  documentId: string;
  path: string;
  issueCodes: readonly OkfCompatibilityIssueCode[];
  suggestedType?: OkfTypeSuggestion;
  repairable: boolean;
  beforeMarkdown: string;
};

export type OkfConceptRepairChoice = {
  documentId: string;
  conceptType: string;
};

export type OkfConceptRepairUpdate = {
  documentId: string;
  path: string;
  conceptType: string;
  beforeMarkdown: string;
  markdown: string;
  patches: readonly TextPatch[];
};

export type OkfConceptRepairFailure = {
  documentId: string;
  path: string;
  reason: "document_missing" | "empty_type" | "invalid_frontmatter";
};

export type OkfConceptRepairPlan = {
  updates: readonly OkfConceptRepairUpdate[];
  failures: readonly OkfConceptRepairFailure[];
};

export type OkfWikilinkRepairCandidate = {
  documentId: string;
  path: string;
  beforeMarkdown: string;
  convertibleCount: number;
  skippedCount: number;
};

export type OkfWikilinkRepairUpdate = {
  documentId: string;
  path: string;
  beforeMarkdown: string;
  markdown: string;
  patches: readonly TextPatch[];
};

export type OkfRepairDiffLine = {
  kind: "context" | "remove" | "add";
  text: string;
};

export type OkfOptionalMetadataField = "description" | "tags" | "resource";
export type OkfMetadataSuggestion = {
  documentId: string;
  path: string;
  missingFields: readonly OkfOptionalMetadataField[];
};

export type OkfIndexCandidateState = "missing" | "generated" | "curated";
export type OkfIndexCandidate = {
  path: string;
  directoryPath: string;
  state: OkfIndexCandidateState;
  documentId?: string;
  currentMarkdown?: string;
  markdown: string;
  changed: boolean;
  conceptCount: number;
  directoryCount: number;
};

export type WorkspaceOkfConformancePlan = {
  conceptRepairs: readonly OkfConceptRepairCandidate[];
  wikilinkRepairs: readonly OkfWikilinkRepairCandidate[];
  metadataSuggestions: readonly OkfMetadataSuggestion[];
  indexes: readonly OkfIndexCandidate[];
};

const typeIssueCodes = new Set<OkfCompatibilityIssueCode>([
  "concept_frontmatter_missing",
  "concept_frontmatter_invalid",
  "concept_type_missing",
  "concept_type_invalid",
]);

const pathTypeRules: readonly [RegExp, string][] = [
  [/(?:^|\/)(?:architecture|architectures)(?:\/|$)/i, "Architecture"],
  [/(?:^|\/)(?:adr|adrs|decision|decisions)(?:\/|$)/i, "Decision"],
  [/(?:^|\/)(?:operation|operations|runbook|runbooks)(?:\/|$)/i, "Runbook"],
  [/(?:^|\/)(?:policy|policies)(?:\/|$)/i, "Policy"],
  [/(?:^|\/)(?:guide|guides|handbook|handbooks)(?:\/|$)/i, "Guide"],
  [/(?:^|\/)(?:meeting|meetings|note|notes)(?:\/|$)/i, "Note"],
  [/(?:^|\/)(?:concept|concepts|entity|entities)(?:\/|$)/i, "Concept"],
];

const compareText = (first: string, second: string) =>
  first < second ? -1 : first > second ? 1 : 0;

const getDirectoryPath = (path: string) => path.split("/").slice(0, -1).join("/");
const getBasename = (path: string) => path.split("/").at(-1) ?? path;

const getFolderTypeSuggestion = (
  path: string,
  index: WorkspaceKnowledgeIndex,
) => {
  const directoryPath = getDirectoryPath(path);
  const counts = new Map<string, number>();
  for (const [documentId, analysis] of index.analysesByDocumentId) {
    const document = index.documentsById.get(documentId);
    const type = analysis.knowledgeMetadata.type;
    if (
      !document ||
      document.path === path ||
      getDirectoryPath(document.path) !== directoryPath ||
      !type
    ) {
      continue;
    }
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const ranked = [...counts].sort(
    ([firstType, firstCount], [secondType, secondCount]) =>
      secondCount - firstCount || compareText(firstType, secondType),
  );
  if (ranked.length === 0 || ranked[0]![1] === ranked[1]?.[1]) return undefined;
  return ranked[0]![0];
};

const getTypeSuggestion = (
  path: string,
  index: WorkspaceKnowledgeIndex,
): OkfTypeSuggestion | undefined => {
  const folderType = getFolderTypeSuggestion(path, index);
  if (folderType) return { type: folderType, source: "folder" };
  const pathRule = pathTypeRules.find(([pattern]) => pattern.test(path));
  return pathRule ? { type: pathRule[1], source: "path" } : undefined;
};

const getConceptRepairCandidates = (
  index: WorkspaceKnowledgeIndex,
  report: OkfCompatibilityReport,
): OkfConceptRepairCandidate[] => report.documents.flatMap((documentReport) => {
  if (documentReport.role !== "concept") return [];
  const issueCodes = documentReport.issues
    .map((issue) => issue.code)
    .filter((code) => typeIssueCodes.has(code));
  if (issueCodes.length === 0) return [];
  const document = index.documentsById.get(documentReport.documentId);
  if (!document) return [];
  return [{
    documentId: document.id,
    path: document.path,
    issueCodes,
    suggestedType: getTypeSuggestion(document.path, index),
    repairable: !issueCodes.includes("concept_frontmatter_invalid"),
    beforeMarkdown: document.markdown,
  }];
});

const getMetadataSuggestions = (
  index: WorkspaceKnowledgeIndex,
  report: OkfCompatibilityReport,
): OkfMetadataSuggestion[] => report.documents.flatMap((documentReport) => {
  if (documentReport.role !== "concept") return [];
  const metadata = index.analysesByDocumentId
    .get(documentReport.documentId)?.knowledgeMetadata;
  if (!metadata?.type) return [];
  const missingFields: OkfOptionalMetadataField[] = [];
  if (!metadata.description) missingFields.push("description");
  if (metadata.tags.length === 0) missingFields.push("tags");
  if (!metadata.resource) missingFields.push("resource");
  return missingFields.length > 0
    ? [{
        documentId: documentReport.documentId,
        path: documentReport.path,
        missingFields,
      }]
    : [];
});

const escapeLinkLabel = (value: string) => value
  .replace(/\\/g, "\\\\")
  .replace(/\[/g, "\\[")
  .replace(/\]/g, "\\]");

const normalizeDescription = (value: string) => value.replace(/\s+/g, " ").trim();

const encodeLinkTarget = (value: string) => value
  .split("/")
  .map((segment) => encodeURIComponent(segment))
  .join("/");

const getRelativeDocumentPath = (sourcePath: string, targetPath: string) => {
  const sourceSegments = sourcePath.split("/").slice(0, -1);
  const targetSegments = targetPath.split("/");
  let sharedSegments = 0;
  while (
    sharedSegments < sourceSegments.length
    && sharedSegments < targetSegments.length
    && sourceSegments[sharedSegments] === targetSegments[sharedSegments]
  ) {
    sharedSegments += 1;
  }
  const parentSegments = sourceSegments
    .slice(sharedSegments)
    .map(() => "..");
  const relativeSegments = [
    ...parentSegments,
    ...targetSegments.slice(sharedSegments),
  ];
  return relativeSegments.join("/") || getBasename(targetPath);
};

const escapeMarkdownLabel = (value: string) => value
  .replace(/\\/g, "\\\\")
  .replace(/\[/g, "\\[")
  .replace(/\]/g, "\\]");

const getWikilinkRepairPatches = (
  index: WorkspaceKnowledgeIndex,
  documentId: string,
): TextPatch[] => {
  const document = index.documentsById.get(documentId);
  if (!document) return [];
  return (index.outgoingLinksByDocumentId.get(documentId) ?? [])
    .filter((link) =>
      link.syntax === "wikilink"
      && link.relation === "link"
      && link.status === "resolved"
      && typeof link.targetPath === "string"
    )
    .map((link) => {
      const targetPath = link.targetPath!;
      const path = targetPath === document.path
        ? ""
        : encodeLinkTarget(getRelativeDocumentPath(document.path, targetPath));
      const fragment = link.fragment
        ? `#${encodeURIComponent(link.fragment)}`
        : "";
      return {
        from: link.from,
        to: link.to,
        insert: `[${escapeMarkdownLabel(link.label)}](${path}${fragment})`,
      };
    });
};

const getWikilinkRepairCandidates = (
  index: WorkspaceKnowledgeIndex,
): OkfWikilinkRepairCandidate[] => [...index.documentsById.values()]
  .flatMap((document) => {
    const wikilinks = (index.outgoingLinksByDocumentId.get(document.id) ?? [])
      .filter((link) => link.syntax === "wikilink");
    if (wikilinks.length === 0) return [];
    const patches = getWikilinkRepairPatches(index, document.id);
    return patches.length > 0
      ? [{
          documentId: document.id,
          path: document.path,
          beforeMarkdown: document.markdown,
          convertibleCount: patches.length,
          skippedCount: wikilinks.length - patches.length,
        }]
      : [];
  })
  .sort((first, second) => compareText(first.path, second.path));

const withoutGeneratedMarker = (markdown: string) => markdown
  .replace(`${TABULA_GENERATED_OKF_INDEX_MARKER}\n\n`, "")
  .replace(`${TABULA_GENERATED_OKF_INDEX_MARKER}\r\n\r\n`, "");

const normalizeMarkdown = (markdown: string) => markdown
  .replace(/\r\n/g, "\n")
  .trimEnd();

const renderIndexCandidate = ({
  directoryPath,
  concepts,
  childDirectories,
  index,
  okfVersion,
}: {
  directoryPath: string;
  concepts: readonly WorkspaceSourceDocument[];
  childDirectories: readonly string[];
  index: WorkspaceKnowledgeIndex;
  okfVersion: string;
}) => {
  const lines: string[] = [];
  if (!directoryPath) {
    lines.push("---", `okf_version: "${okfVersion}"`, "---", "");
  }
  lines.push(TABULA_GENERATED_OKF_INDEX_MARKER, "");
  if (concepts.length > 0) {
    lines.push("# Files", "");
    for (const concept of concepts) {
      const analysis = index.analysesByDocumentId.get(concept.id);
      const title = escapeLinkLabel(analysis?.title || getBasename(concept.path).replace(/\.md$/i, ""));
      const description = analysis?.knowledgeMetadata.description;
      lines.push(
        `- [${title}](${encodeLinkTarget(getBasename(concept.path))})${
          description ? ` - ${normalizeDescription(description)}` : ""
        }`,
      );
    }
    lines.push("");
  }
  if (childDirectories.length > 0) {
    lines.push("# Directories", "");
    for (const directory of childDirectories) {
      lines.push(`- [${escapeLinkLabel(directory)}](${encodeLinkTarget(directory)}/)`);
    }
    lines.push("");
  }
  return lines.join("\n");
};

const getIndexCandidates = (
  index: WorkspaceKnowledgeIndex,
  report: OkfCompatibilityReport,
): OkfIndexCandidate[] => {
  const conceptPaths = report.documents
    .filter((document) => document.role === "concept")
    .map((document) => document.path);
  if (conceptPaths.length === 0) return [];

  const directories = new Set<string>([""]);
  for (const path of conceptPaths) {
    const segments = getDirectoryPath(path).split("/").filter(Boolean);
    for (let depth = 1; depth <= segments.length; depth += 1) {
      directories.add(segments.slice(0, depth).join("/"));
    }
  }

  const concepts = [...index.documentsById.values()]
    .filter((document) => conceptPaths.includes(document.path));
  const indexesByPath = new Map(
    report.documents
      .filter((document) => document.role === "index")
      .map((document) => [document.path, document]),
  );

  return [...directories]
    .sort(compareText)
    .map((directoryPath) => {
      const directConcepts = concepts
        .filter((document) => getDirectoryPath(document.path) === directoryPath)
        .sort((first, second) => compareText(first.path, second.path));
      const childDirectories = [...directories]
        .filter((candidate) => {
          if (!candidate || candidate === directoryPath) return false;
          const parent = getDirectoryPath(candidate);
          return parent === directoryPath;
        })
        .map((candidate) => getBasename(candidate))
        .sort(compareText);
      const path = directoryPath ? `${directoryPath}/index.md` : "index.md";
      const existingReport = indexesByPath.get(path);
      const current = existingReport
        ? index.documentsById.get(existingReport.documentId)
        : undefined;
      const markdown = renderIndexCandidate({
        directoryPath,
        concepts: directConcepts,
        childDirectories,
        index,
        okfVersion: report.declaredVersion ?? report.targetVersion,
      });
      const currentNormalized = current ? normalizeMarkdown(current.markdown) : undefined;
      const generatedNormalized = normalizeMarkdown(markdown);
      const matchesGenerated = currentNormalized === generatedNormalized
        || currentNormalized === normalizeMarkdown(withoutGeneratedMarker(markdown));
      const state: OkfIndexCandidateState = !current
        ? "missing"
        : current.markdown.includes(TABULA_GENERATED_OKF_INDEX_MARKER) || matchesGenerated
          ? "generated"
          : "curated";
      return {
        path,
        directoryPath,
        state,
        ...(current ? {
          documentId: current.id,
          currentMarkdown: current.markdown,
        } : {}),
        markdown,
        changed: !matchesGenerated,
        conceptCount: directConcepts.length,
        directoryCount: childDirectories.length,
      };
    });
};

export const planWorkspaceOkfConformance = (
  index: WorkspaceKnowledgeIndex,
  report: OkfCompatibilityReport,
): WorkspaceOkfConformancePlan => ({
  conceptRepairs: getConceptRepairCandidates(index, report),
  wikilinkRepairs: getWikilinkRepairCandidates(index),
  metadataSuggestions: getMetadataSuggestions(index, report),
  indexes: getIndexCandidates(index, report),
});

export const planOkfWikilinkRepairs = (
  index: WorkspaceKnowledgeIndex,
  documentIds: readonly string[],
): readonly OkfWikilinkRepairUpdate[] => documentIds.flatMap((documentId) => {
  const document = index.documentsById.get(documentId);
  if (!document) return [];
  const patches = getWikilinkRepairPatches(index, documentId);
  const markdown = applyTextPatches(document.markdown, patches);
  return patches.length > 0 && markdown !== null && markdown !== document.markdown
    ? [{
        documentId,
        path: document.path,
        beforeMarkdown: document.markdown,
        markdown,
        patches,
      }]
    : [];
});

export const planOkfConceptRepairs = (
  index: WorkspaceKnowledgeIndex,
  choices: readonly OkfConceptRepairChoice[],
): OkfConceptRepairPlan => {
  const updates: OkfConceptRepairUpdate[] = [];
  const failures: OkfConceptRepairFailure[] = [];
  for (const choice of choices) {
    const document = index.documentsById.get(choice.documentId);
    if (!document) {
      failures.push({
        documentId: choice.documentId,
        path: choice.documentId,
        reason: "document_missing",
      });
      continue;
    }
    const result = setOkfConceptType(document.markdown, choice.conceptType);
    if (!result.ok) {
      failures.push({
        documentId: document.id,
        path: document.path,
        reason: result.reason,
      });
      continue;
    }
    if (!result.changed) continue;
    updates.push({
      documentId: document.id,
      path: document.path,
      conceptType: choice.conceptType.trim(),
      beforeMarkdown: document.markdown,
      markdown: result.markdown,
      patches: result.patches,
    });
  }
  return { updates, failures };
};

export const getOkfRepairDiff = (
  beforeMarkdown: string,
  afterMarkdown: string,
): OkfRepairDiffLine[] => {
  const before = beforeMarkdown.replace(/\r\n/g, "\n").split("\n");
  const after = afterMarkdown.replace(/\r\n/g, "\n").split("\n");
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const contextBefore = Math.max(0, prefix - 2);
  const contextAfterStart = Math.max(prefix, after.length - suffix);
  return [
    ...before.slice(contextBefore, prefix).map((text) => ({ kind: "context" as const, text })),
    ...before.slice(prefix, before.length - suffix).map((text) => ({ kind: "remove" as const, text })),
    ...after.slice(prefix, after.length - suffix).map((text) => ({ kind: "add" as const, text })),
    ...after.slice(contextAfterStart, Math.min(after.length, contextAfterStart + 2))
      .map((text) => ({ kind: "context" as const, text })),
  ];
};
