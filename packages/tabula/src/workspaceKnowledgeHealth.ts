import {
  getOkfFreshness,
  type WorkspaceKnowledgeMetadata,
} from "./workspaceOkfMetadata";
import { parseFrontmatterData } from "./markdown/parse";
import type {
  DocumentAnalysis,
  WorkspaceKnowledgeIndex,
} from "./workspaceKnowledgeIndex";

export type WorkspaceKnowledgeHealthIssueCode =
  | "stale"
  | "deprecated_referenced"
  | "unverified_generated"
  | "verification_outdated"
  | "provenance_missing"
  | "orphan_concept"
  | "relationship_broken"
  | "relationship_ambiguous"
  | "canonical_resource_shared"
  | "source_id_duplicate"
  | "source_resource_duplicate"
  | "source_reference_missing"
  | "source_unused"
  | "optional_metadata_invalid";

export type WorkspaceKnowledgeHealthIssue = {
  code: WorkspaceKnowledgeHealthIssueCode;
  severity: "attention" | "notice";
  documentId: string;
  path: string;
  value?: string;
  from?: number;
  to?: number;
};

export type WorkspaceKnowledgeHealthReport = {
  issues: readonly WorkspaceKnowledgeHealthIssue[];
  attentionCount: number;
  noticeCount: number;
  documentCount: number;
};

export type WorkspaceKnowledgeHealthDelta = {
  introducedIssues: readonly WorkspaceKnowledgeHealthIssue[];
  resolvedIssues: readonly WorkspaceKnowledgeHealthIssue[];
  introducedAttentionCount: number;
  introducedNoticeCount: number;
  resolvedAttentionCount: number;
  resolvedNoticeCount: number;
};

export type WorkspaceKnowledgeHealthOptions = {
  today?: string;
};

const actorEventFieldsAreValid = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return typeof event.by === "string" &&
    event.by.trim().length > 0 &&
    typeof event.at === "string" &&
    event.at.trim().length > 0 &&
    Number.isFinite(Date.parse(event.at));
};

const isCalendarDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const getInvalidOptionalMetadataFields = (analysis: DocumentAnalysis) => {
  const metadata = analysis.metadata;
  const invalid = new Set<string>();
  if (
    "status" in metadata &&
    !["draft", "stable", "deprecated"].includes(String(metadata.status))
  ) {
    invalid.add("status");
  }
  if (
    "resource" in metadata &&
    (typeof metadata.resource !== "string" || !metadata.resource.trim())
  ) {
    invalid.add("resource");
  }
  if ("stale_after" in metadata && !isCalendarDate(metadata.stale_after)) {
    invalid.add("stale_after");
  }
  if ("generated" in metadata && !actorEventFieldsAreValid(metadata.generated)) {
    invalid.add("generated");
  }
  if ("verified" in metadata) {
    const values = Array.isArray(metadata.verified)
      ? metadata.verified
      : [metadata.verified];
    if (values.length === 0 || values.some((value) => !actorEventFieldsAreValid(value))) {
      invalid.add("verified");
    }
  }
  if ("sources" in metadata) {
    if (!Array.isArray(metadata.sources) || metadata.sources.some((source) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) return true;
      const fields = source as Record<string, unknown>;
      if (typeof fields.resource !== "string" || !fields.resource.trim()) return true;
      if (
        "id" in fields &&
        (typeof fields.id !== "string" || !fields.id.trim())
      ) {
        return true;
      }
      return "usage_count" in fields && (
        typeof fields.usage_count !== "number" ||
        !Number.isFinite(fields.usage_count) ||
        fields.usage_count < 0
      );
    })) {
      invalid.add("sources");
    }
  }
  return [...invalid];
};

const getSourceReferenceIds = (markdown: string) => {
  const ids = new Set<string>();
  for (const match of markdown.matchAll(/\[\^([^\]\r\n]+)\](?!:)/g)) {
    const id = match[1]?.trim();
    if (id) ids.add(id);
  }
  return ids;
};

type KnowledgeIssueRange = Pick<
  WorkspaceKnowledgeHealthIssue,
  "from" | "to"
>;

const getLineRange = (
  text: string,
  from: number,
): KnowledgeIssueRange => {
  const lineEnd = text.indexOf("\n", from);
  const to = lineEnd === -1 ? text.length : lineEnd;
  return {
    from,
    to: text[to - 1] === "\r" ? to - 1 : to,
  };
};

const getFrontmatterFieldRange = (
  markdown: string,
  field: string,
): KnowledgeIssueRange => {
  const parsed = parseFrontmatterData(markdown);
  if (parsed.bodyOffset === 0) return {};
  const frontmatter = markdown.slice(0, parsed.bodyOffset);
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escapedField}[ \\t]*:`, "m").exec(frontmatter);
  return match ? getLineRange(markdown, match.index) : {};
};

const getSourceFieldRange = (
  markdown: string,
  field: "id" | "resource",
  value: string,
  occurrence: "first" | "last" = "first",
): KnowledgeIssueRange => {
  const parsed = parseFrontmatterData(markdown);
  if (parsed.bodyOffset === 0) return {};
  const sourcesRange = getFrontmatterFieldRange(markdown, "sources");
  if (sourcesRange.from === undefined || sourcesRange.to === undefined) return {};
  const frontmatter = markdown.slice(0, parsed.bodyOffset);
  const following = frontmatter.slice(sourcesRange.to);
  const nextTopLevelField = /\n(?=[^\s#][^:\r\n]*[ \t]*:)/.exec(following);
  const blockEnd = nextTopLevelField
    ? sourcesRange.to + nextTopLevelField.index
    : parsed.bodyOffset;
  const block = markdown.slice(sourcesRange.from, blockEnd);
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...block.matchAll(
    new RegExp(`^[ \\t]+(?:-[ \\t]+)?${escapedField}[ \\t]*:.*$`, "gm"),
  )].filter((match) => match[0].includes(value));
  const match = occurrence === "last" ? matches.at(-1) : matches[0];
  if (!match || match.index === undefined) return sourcesRange;
  return getLineRange(markdown, sourcesRange.from + match.index);
};

const getSourceReferenceRange = (
  markdown: string,
  sourceId: string,
): KnowledgeIssueRange => {
  const parsed = parseFrontmatterData(markdown);
  const marker = `[^${sourceId}]`;
  const from = markdown.indexOf(marker, parsed.bodyOffset);
  return from === -1 ? {} : { from, to: from + marker.length };
};

const isConceptPath = (path: string) => {
  const fileName = path.split("/").at(-1)?.toLocaleLowerCase();
  return fileName !== "index.md" && fileName !== "log.md";
};

const latestVerificationTime = (metadata: WorkspaceKnowledgeMetadata) =>
  Math.max(
    ...metadata.verified.map((event) => Date.parse(event.at)).filter(Number.isFinite),
    Number.NEGATIVE_INFINITY,
  );

const compareIssues = (
  first: WorkspaceKnowledgeHealthIssue,
  second: WorkspaceKnowledgeHealthIssue,
) => first.path.localeCompare(second.path) ||
  first.code.localeCompare(second.code) ||
  (first.value ?? "").localeCompare(second.value ?? "");

export const getWorkspaceKnowledgeHealth = (
  index: WorkspaceKnowledgeIndex,
  options: WorkspaceKnowledgeHealthOptions = {},
): WorkspaceKnowledgeHealthReport => {
  const issues: WorkspaceKnowledgeHealthIssue[] = [];
  const conceptIds = new Set(
    [...index.analysesByDocumentId.values()]
      .filter((analysis) =>
        isConceptPath(analysis.path) && Boolean(analysis.knowledgeMetadata.type))
      .map((analysis) => analysis.documentId),
  );
  const addIssue = (
    analysis: DocumentAnalysis,
    issue: Omit<WorkspaceKnowledgeHealthIssue, "documentId" | "path">,
  ) => {
    issues.push({
      ...issue,
      documentId: analysis.documentId,
      path: analysis.path,
    });
  };

  for (const analysis of index.analysesByDocumentId.values()) {
    if (!conceptIds.has(analysis.documentId)) continue;
    const metadata = analysis.knowledgeMetadata;
    const document = index.documentsById.get(analysis.documentId);
    const markdown = document?.markdown ?? "";

    if (
      isCalendarDate(metadata.staleAfter) &&
      getOkfFreshness(metadata, options.today) === "stale"
    ) {
      addIssue(analysis, {
        code: "stale",
        severity: "attention",
        value: metadata.staleAfter,
        ...getFrontmatterFieldRange(markdown, "stale_after"),
      });
    }
    if (
      metadata.status === "deprecated" &&
      (index.backlinksByDocumentId.get(analysis.documentId)?.length ?? 0) > 0
    ) {
      addIssue(analysis, {
        code: "deprecated_referenced",
        severity: "attention",
        value: String(index.backlinksByDocumentId.get(analysis.documentId)?.length ?? 0),
        ...getFrontmatterFieldRange(markdown, "status"),
      });
    }
    if (metadata.generated && metadata.verified.length === 0) {
      addIssue(analysis, {
        code: "unverified_generated",
        severity: "notice",
        value: metadata.generated.by,
        ...getFrontmatterFieldRange(markdown, "generated"),
      });
    }
    if (
      metadata.generatedAt &&
      metadata.verified.length > 0 &&
      Number.isFinite(Date.parse(metadata.generatedAt)) &&
      latestVerificationTime(metadata) < Date.parse(metadata.generatedAt)
    ) {
      addIssue(analysis, {
        code: "verification_outdated",
        severity: "attention",
        value: metadata.generatedAt,
        ...getFrontmatterFieldRange(markdown, "verified"),
      });
    }
    if (
      metadata.generated &&
      !metadata.generated.by.startsWith("human:") &&
      metadata.sources.length === 0 &&
      !metadata.resource
    ) {
      addIssue(analysis, {
        code: "provenance_missing",
        severity: "notice",
        value: metadata.generated.by,
        ...getFrontmatterFieldRange(markdown, "generated"),
      });
    }
    if (metadata.resource) {
      const resourceConceptIds = (
        index.documentIdsByResource.get(metadata.resource) ?? []
      ).filter((documentId) => conceptIds.has(documentId));
      if (resourceConceptIds.length > 1) {
        addIssue(analysis, {
          code: "canonical_resource_shared",
          severity: "notice",
          value: metadata.resource,
          ...getFrontmatterFieldRange(markdown, "resource"),
        });
      }
    }

    const relationships = [
      ...(index.outgoingLinksByDocumentId.get(analysis.documentId) ?? []),
      ...(index.backlinksByDocumentId.get(analysis.documentId) ?? []),
    ].some((link) =>
      link.status === "resolved" &&
      conceptIds.has(link.sourceDocumentId) &&
      Boolean(link.targetDocumentId && conceptIds.has(link.targetDocumentId)) &&
      link.targetDocumentId !== analysis.documentId
    );
    if (conceptIds.size > 1 && !relationships) {
      addIssue(analysis, {
        code: "orphan_concept",
        severity: "notice",
      });
    }

    const relationshipIssueKeys = new Set<string>();
    for (const link of index.outgoingLinksByDocumentId.get(analysis.documentId) ?? []) {
      if (
        link.relation !== "link" ||
        (link.status !== "broken" && link.status !== "ambiguous")
      ) {
        continue;
      }
      const code = link.status === "broken"
        ? "relationship_broken"
        : "relationship_ambiguous";
      const issueKey = `${code}\u0000${link.target}`;
      if (relationshipIssueKeys.has(issueKey)) continue;
      relationshipIssueKeys.add(issueKey);
      addIssue(analysis, {
        code,
        severity: "attention",
        value: link.target,
        from: link.from,
        to: link.to,
      });
    }

    const sourceReferences = getSourceReferenceIds(document?.markdown ?? "");
    const sourceIds = new Set(metadata.sources.flatMap((source) => source.id ? [source.id] : []));
    if (metadata.sources.length > 0) {
      const sourceIdCounts = new Map<string, number>();
      const sourceResourceCounts = new Map<string, number>();
      for (const source of metadata.sources) {
        if (source.id) {
          sourceIdCounts.set(source.id, (sourceIdCounts.get(source.id) ?? 0) + 1);
        }
        sourceResourceCounts.set(
          source.resource,
          (sourceResourceCounts.get(source.resource) ?? 0) + 1,
        );
      }
      for (const [sourceId, count] of sourceIdCounts) {
        if (count > 1) {
          addIssue(analysis, {
            code: "source_id_duplicate",
            severity: "attention",
            value: sourceId,
            ...getSourceFieldRange(markdown, "id", sourceId, "last"),
          });
        }
      }
      for (const [resource, count] of sourceResourceCounts) {
        if (count > 1) {
          addIssue(analysis, {
            code: "source_resource_duplicate",
            severity: "notice",
            value: resource,
            ...getSourceFieldRange(markdown, "resource", resource, "last"),
          });
        }
      }
      for (const referenceId of sourceReferences) {
        if (!sourceIds.has(referenceId)) {
          addIssue(analysis, {
            code: "source_reference_missing",
            severity: "attention",
            value: referenceId,
            ...getSourceReferenceRange(markdown, referenceId),
          });
        }
      }
      for (const sourceId of sourceIds) {
        if (!sourceReferences.has(sourceId)) {
          addIssue(analysis, {
            code: "source_unused",
            severity: "notice",
            value: sourceId,
            ...getSourceFieldRange(markdown, "id", sourceId),
          });
        }
      }
    }

    for (const field of getInvalidOptionalMetadataFields(analysis)) {
      addIssue(analysis, {
        code: "optional_metadata_invalid",
        severity: "attention",
        value: field,
        ...getFrontmatterFieldRange(markdown, field),
      });
    }
  }

  issues.sort(compareIssues);
  return {
    issues,
    attentionCount: issues.filter((issue) => issue.severity === "attention").length,
    noticeCount: issues.filter((issue) => issue.severity === "notice").length,
    documentCount: conceptIds.size,
  };
};

const issueIdentityValueCodes = new Set<WorkspaceKnowledgeHealthIssueCode>([
  "source_reference_missing",
  "source_unused",
  "optional_metadata_invalid",
  "relationship_broken",
  "relationship_ambiguous",
  "canonical_resource_shared",
  "source_id_duplicate",
  "source_resource_duplicate",
]);

const getIssueIdentity = (issue: WorkspaceKnowledgeHealthIssue) => [
  issue.documentId,
  issue.code,
  issueIdentityValueCodes.has(issue.code) ? issue.value ?? "" : "",
].join("\u0000");

export const getWorkspaceKnowledgeHealthDelta = (
  previousIndex: WorkspaceKnowledgeIndex,
  currentIndex: WorkspaceKnowledgeIndex,
  options: WorkspaceKnowledgeHealthOptions = {},
): WorkspaceKnowledgeHealthDelta => {
  const previous = getWorkspaceKnowledgeHealth(previousIndex, options);
  const current = getWorkspaceKnowledgeHealth(currentIndex, options);
  const previousIdentities = new Set(previous.issues.map(getIssueIdentity));
  const currentIdentities = new Set(current.issues.map(getIssueIdentity));
  const currentDocumentIds = new Set(currentIndex.documentsById.keys());
  const introducedIssues = current.issues.filter(
    (issue) => !previousIdentities.has(getIssueIdentity(issue)),
  );
  const resolvedIssues = previous.issues.filter(
    (issue) =>
      currentDocumentIds.has(issue.documentId) &&
      !currentIdentities.has(getIssueIdentity(issue)),
  );

  return {
    introducedIssues,
    resolvedIssues,
    introducedAttentionCount: introducedIssues.filter(
      (issue) => issue.severity === "attention",
    ).length,
    introducedNoticeCount: introducedIssues.filter(
      (issue) => issue.severity === "notice",
    ).length,
    resolvedAttentionCount: resolvedIssues.filter(
      (issue) => issue.severity === "attention",
    ).length,
    resolvedNoticeCount: resolvedIssues.filter(
      (issue) => issue.severity === "notice",
    ).length,
  };
};
