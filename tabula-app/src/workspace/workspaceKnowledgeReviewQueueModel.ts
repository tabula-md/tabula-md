import {
  getOkfFreshness,
  getWorkspaceKnowledgeHealth,
  getWorkspaceOkfCompatibility,
  type OkfCompatibilityIssue,
  type OkfFreshness,
  type OkfLifecycleStatus,
  type OkfTrustTier,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceKnowledgeHealthIssueCode,
  type WorkspaceKnowledgeHealthReport,
  type WorkspaceKnowledgeIndex,
  type OkfCompatibilityReport,
} from "@tabula-md/tabula";

export type WorkspaceKnowledgeReviewPriority =
  | "required"
  | "attention"
  | "notice";

export type WorkspaceKnowledgeReviewEntry = {
  documentId: string;
  path: string;
  title: string;
  owner?: string;
  reviewDate?: string;
  lifecycle?: OkfLifecycleStatus;
  trust?: OkfTrustTier;
  freshness?: OkfFreshness;
  priority: WorkspaceKnowledgeReviewPriority;
  compatibilityIssues: readonly OkfCompatibilityIssue[];
  healthIssues: readonly WorkspaceKnowledgeHealthIssue[];
  lifecycleConcern: boolean;
  trustConcern: boolean;
  freshnessConcern: boolean;
};

export type WorkspaceKnowledgeReviewFilters = {
  lifecycle: ReadonlySet<OkfLifecycleStatus>;
  trust: ReadonlySet<OkfTrustTier>;
  freshness: ReadonlySet<OkfFreshness>;
  healthIssues: ReadonlySet<WorkspaceKnowledgeHealthIssueCode>;
};

export type WorkspaceKnowledgeReviewSort =
  | "severity"
  | "review-date"
  | "path"
  | "owner";

export const createWorkspaceKnowledgeReviewFilters = (
  overrides: Partial<WorkspaceKnowledgeReviewFilters> = {},
): WorkspaceKnowledgeReviewFilters => ({
  lifecycle: overrides.lifecycle ?? new Set(),
  trust: overrides.trust ?? new Set(),
  freshness: overrides.freshness ?? new Set(),
  healthIssues: overrides.healthIssues ?? new Set(),
});

const getOwner = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getReviewDate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
};

const getPriority = (
  compatibilityIssues: readonly OkfCompatibilityIssue[],
  healthIssues: readonly WorkspaceKnowledgeHealthIssue[],
): WorkspaceKnowledgeReviewPriority => {
  if (compatibilityIssues.some((issue) => issue.severity === "error")) {
    return "required";
  }
  if (healthIssues.some((issue) => issue.severity === "attention")) {
    return "attention";
  }
  return "notice";
};

export const getWorkspaceKnowledgeReviewEntries = (
  index: WorkspaceKnowledgeIndex,
  {
    compatibility = getWorkspaceOkfCompatibility(index),
    health = getWorkspaceKnowledgeHealth(index),
  }: {
    compatibility?: OkfCompatibilityReport;
    health?: WorkspaceKnowledgeHealthReport;
  } = {},
): WorkspaceKnowledgeReviewEntry[] => {
  const compatibilityByDocument = new Map<string, OkfCompatibilityIssue[]>();
  const healthByDocument = new Map<string, WorkspaceKnowledgeHealthIssue[]>();
  for (const issue of compatibility.issues) {
    const issues = compatibilityByDocument.get(issue.documentId) ?? [];
    issues.push(issue);
    compatibilityByDocument.set(issue.documentId, issues);
  }
  for (const issue of health.issues) {
    const issues = healthByDocument.get(issue.documentId) ?? [];
    issues.push(issue);
    healthByDocument.set(issue.documentId, issues);
  }

  const entries: WorkspaceKnowledgeReviewEntry[] = [];
  for (const [documentId, analysis] of index.analysesByDocumentId) {
    const metadata = analysis.knowledgeMetadata;
    const typed = Boolean(metadata.type);
    const lifecycle = typed ? metadata.status : undefined;
    const trust = typed ? metadata.trustTier : undefined;
    const freshness = typed ? getOkfFreshness(metadata) : undefined;
    const lifecycleConcern = lifecycle === "draft" ||
      lifecycle === "deprecated";
    const trustConcern = trust === "unverified";
    const freshnessConcern = freshness === "stale";
    const compatibilityIssues = compatibilityByDocument.get(documentId) ?? [];
    const healthIssues = healthByDocument.get(documentId) ?? [];
    const owner = getOwner(analysis.metadata.owner);
    const reviewDate = getReviewDate(metadata.staleAfter);
    if (
      compatibilityIssues.length === 0 &&
      healthIssues.length === 0 &&
      !lifecycleConcern &&
      !trustConcern &&
      !freshnessConcern
    ) {
      continue;
    }
    entries.push({
      documentId,
      path: analysis.path,
      title: analysis.title ||
        analysis.path.split("/").at(-1)?.replace(/\.md$/i, "") ||
        analysis.path,
      ...(owner ? { owner } : {}),
      ...(reviewDate ? { reviewDate } : {}),
      ...(lifecycle ? { lifecycle } : {}),
      ...(trust ? { trust } : {}),
      ...(freshness ? { freshness } : {}),
      priority: getPriority(compatibilityIssues, healthIssues),
      compatibilityIssues,
      healthIssues,
      lifecycleConcern,
      trustConcern,
      freshnessConcern,
    });
  }
  return entries;
};

const matches = <TValue extends string>(
  selected: ReadonlySet<TValue>,
  value: TValue | undefined,
) => selected.size === 0 || Boolean(value && selected.has(value));

export const filterWorkspaceKnowledgeReviewEntries = (
  entries: readonly WorkspaceKnowledgeReviewEntry[],
  filters: WorkspaceKnowledgeReviewFilters,
) => entries.filter((entry) =>
  matches(filters.lifecycle, entry.lifecycle) &&
  matches(filters.trust, entry.trust) &&
  matches(filters.freshness, entry.freshness) &&
  (
    filters.healthIssues.size === 0 ||
    entry.healthIssues.some((issue) => filters.healthIssues.has(issue.code))
  )
);

const priorityRank: Record<WorkspaceKnowledgeReviewPriority, number> = {
  required: 3,
  attention: 2,
  notice: 1,
};

const optionalText = (value: string | undefined) => value || "\uffff";

export const sortWorkspaceKnowledgeReviewEntries = (
  entries: readonly WorkspaceKnowledgeReviewEntry[],
  sort: WorkspaceKnowledgeReviewSort,
) => [...entries].sort((first, second) => {
  if (sort === "severity") {
    return priorityRank[second.priority] - priorityRank[first.priority] ||
      first.path.localeCompare(second.path);
  }
  if (sort === "review-date") {
    return optionalText(first.reviewDate).localeCompare(
      optionalText(second.reviewDate),
    ) || first.path.localeCompare(second.path);
  }
  if (sort === "owner") {
    return optionalText(first.owner).localeCompare(optionalText(second.owner)) ||
      first.path.localeCompare(second.path);
  }
  return first.path.localeCompare(second.path);
});
