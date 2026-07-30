import { inspectFrontmatterData } from "./markdown/parse";
import type { WorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";

export type LlmWikiArtifactRole =
  | "source-material"
  | "compiled-knowledge"
  | "workflow-rules";

export type LlmWikiRoleBasis = "explicit" | "heuristic";

export type LlmWikiRoleAssignment = {
  path: string;
  role: LlmWikiArtifactRole;
  basis: LlmWikiRoleBasis;
};

export type LlmWikiRoleRule = {
  role: LlmWikiArtifactRole;
  pathPrefixes: readonly string[];
};

export type LlmWikiHealthIssueCode =
  | "compiled_provenance_missing"
  | "compiled_synthesis_stale"
  | "contradictory_claim_candidate"
  | "llm_wiki_index_missing"
  | "llm_wiki_log_missing"
  | "raw_source_unreferenced"
  | "role_rule_conflict"
  | "wiki_concept_orphan";

export type LlmWikiHealthIssue = {
  code: LlmWikiHealthIssueCode;
  path: string;
  documentId?: string;
  value?: string;
};

export type LlmWikiWorkflowReport = {
  detected: boolean;
  assignments: readonly LlmWikiRoleAssignment[];
  issues: readonly LlmWikiHealthIssue[];
  sourceMaterialCount: number;
  compiledKnowledgeCount: number;
  workflowRuleCount: number;
};

export type LlmWikiWorkflowOptions = {
  rules?: readonly LlmWikiRoleRule[];
  today?: string;
};

const SOURCE_SEGMENTS = new Set([
  "input",
  "inputs",
  "raw",
  "source",
  "source-material",
  "sources",
]);
const COMPILED_SEGMENTS = new Set([
  "compiled",
  "concepts",
  "knowledge",
  "wiki",
]);
const RULE_BASENAMES = new Set([
  "agents.md",
  "claude.md",
  "schema.md",
  "steering.md",
]);
const WORKFLOW_STEMS = new Set(["ingest", "lint", "query"]);

const normalizePath = (path: string) =>
  path.replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+/g, "/");

const getSegments = (path: string) =>
  normalizePath(path).toLowerCase().split("/");

const getHeuristicRole = (path: string): LlmWikiArtifactRole | undefined => {
  const segments = getSegments(path);
  const basename = segments.at(-1) ?? "";
  const stem = basename.replace(/\.[^.]+$/, "");
  if (
    RULE_BASENAMES.has(basename)
    || segments.includes("schemas")
    || WORKFLOW_STEMS.has(stem)
  ) {
    return "workflow-rules";
  }
  if (segments.some((segment) => SOURCE_SEGMENTS.has(segment))) {
    return "source-material";
  }
  if (segments.some((segment) => COMPILED_SEGMENTS.has(segment))) {
    return "compiled-knowledge";
  }
  return undefined;
};

const getExplicitRoles = (
  path: string,
  rules: readonly LlmWikiRoleRule[],
) => {
  const normalized = normalizePath(path);
  return rules.flatMap((rule) =>
    rule.pathPrefixes.some((prefix) => {
      const normalizedPrefix = normalizePath(prefix).replace(/\/$/, "");
      return normalized === normalizedPrefix
        || normalized.startsWith(`${normalizedPrefix}/`);
    })
      ? [rule.role]
      : []
  );
};

const createIssue = (
  code: LlmWikiHealthIssueCode,
  path: string,
  documentId?: string,
  value?: string,
): LlmWikiHealthIssue => ({
  code,
  path,
  ...(documentId ? { documentId } : {}),
  ...(value ? { value } : {}),
});

export const analyzeLlmWikiWorkflow = (
  index: WorkspaceKnowledgeIndex,
  artifactPaths: readonly string[],
  options: LlmWikiWorkflowOptions = {},
): LlmWikiWorkflowReport => {
  const rules = options.rules ?? [];
  const assignments: LlmWikiRoleAssignment[] = [];
  const issues: LlmWikiHealthIssue[] = [];

  for (const rawPath of [...new Set(artifactPaths)].sort()) {
    const path = normalizePath(rawPath);
    const explicitRoles = getExplicitRoles(path, rules);
    const roles = explicitRoles.length > 0
      ? explicitRoles
      : [getHeuristicRole(path)].filter(
          (role): role is LlmWikiArtifactRole => Boolean(role),
        );
    for (const role of new Set(roles)) {
      assignments.push({
        path,
        role,
        basis: explicitRoles.length > 0 ? "explicit" : "heuristic",
      });
    }
    if (new Set(explicitRoles).size > 1) {
      issues.push(createIssue(
        "role_rule_conflict",
        path,
        undefined,
        [...new Set(explicitRoles)].join(", "),
      ));
    }
  }

  const sourceAssignments = assignments.filter(
    (assignment) => assignment.role === "source-material",
  );
  const compiledAssignments = assignments.filter(
    (assignment) => assignment.role === "compiled-knowledge",
  );
  const workflowAssignments = assignments.filter(
    (assignment) => assignment.role === "workflow-rules",
  );
  const detected = sourceAssignments.length > 0
    && compiledAssignments.length > 0;
  if (!detected) {
    return {
      detected,
      assignments,
      issues,
      sourceMaterialCount: sourceAssignments.length,
      compiledKnowledgeCount: compiledAssignments.length,
      workflowRuleCount: workflowAssignments.length,
    };
  }

  const referencedPaths = new Set(
    [...index.outgoingLinksByDocumentId.values()]
      .flatMap((links) => links)
      .flatMap((link) => link.targetPath ? [normalizePath(link.targetPath)] : []),
  );
  for (const assignment of sourceAssignments) {
    if (!referencedPaths.has(assignment.path)) {
      issues.push(createIssue("raw_source_unreferenced", assignment.path));
    }
  }

  const compiledPaths = new Set(
    compiledAssignments.map((assignment) => assignment.path),
  );
  const resourceGroups = new Map<string, { id: string; path: string; markdown: string }[]>();
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  for (const document of index.documentsById.values()) {
    if (!compiledPaths.has(normalizePath(document.path))) continue;
    const inspection = inspectFrontmatterData(document.markdown);
    const metadata = inspection.status === "valid" ? inspection.metadata : {};
    if (
      !Array.isArray(metadata.sources)
      || metadata.sources.length === 0
    ) {
      issues.push(createIssue(
        "compiled_provenance_missing",
        document.path,
        document.id,
      ));
    }
    if (
      typeof metadata.stale_after === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(metadata.stale_after)
      && metadata.stale_after <= today
    ) {
      issues.push(createIssue(
        "compiled_synthesis_stale",
        document.path,
        document.id,
        metadata.stale_after,
      ));
    }
    const outgoingCount = index.outgoingLinksByDocumentId.get(document.id)?.length ?? 0;
    const backlinkCount = index.backlinksByDocumentId.get(document.id)?.length ?? 0;
    if (outgoingCount === 0 && backlinkCount === 0) {
      issues.push(createIssue("wiki_concept_orphan", document.path, document.id));
    }
    if (typeof metadata.resource === "string" && metadata.resource.trim()) {
      const resource = metadata.resource.trim();
      const group = resourceGroups.get(resource) ?? [];
      group.push({ id: document.id, path: document.path, markdown: document.markdown });
      resourceGroups.set(resource, group);
    }
  }
  for (const [resource, documents] of resourceGroups) {
    if (
      documents.length > 1
      && new Set(documents.map((document) => document.markdown)).size > 1
    ) {
      for (const document of documents) {
        issues.push(createIssue(
          "contradictory_claim_candidate",
          document.path,
          document.id,
          resource,
        ));
      }
    }
  }

  if (!artifactPaths.some((path) => normalizePath(path).toLowerCase() === "index.md")) {
    issues.push(createIssue("llm_wiki_index_missing", "index.md"));
  }
  if (!artifactPaths.some((path) => normalizePath(path).toLowerCase() === "log.md")) {
    issues.push(createIssue("llm_wiki_log_missing", "log.md"));
  }

  return {
    detected,
    assignments,
    issues,
    sourceMaterialCount: sourceAssignments.length,
    compiledKnowledgeCount: compiledAssignments.length,
    workflowRuleCount: workflowAssignments.length,
  };
};
