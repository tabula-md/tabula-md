export type OkfLifecycleStatus = "draft" | "stable" | "deprecated";
export type OkfTrustTier = "unverified" | "machine-confirmed" | "human-reviewed";
export type OkfFreshness = "current" | "stale";

export type OkfActorEvent = {
  by: string;
  at: string;
};

export type OkfSource = {
  resource: string;
  id?: string;
  title?: string;
  author?: string;
  usageCount?: number;
  lastModified?: string;
};

export type WorkspaceKnowledgeMetadata = {
  type?: string;
  description?: string;
  tags: readonly string[];
  resource?: string;
  sources: readonly OkfSource[];
  generated?: OkfActorEvent;
  verified: readonly OkfActorEvent[];
  status: OkfLifecycleStatus;
  staleAfter?: string;
  generatedAt?: string;
  trustTier: OkfTrustTier;
};

const lifecycleStatuses = new Set<OkfLifecycleStatus>([
  "draft",
  "stable",
  "deprecated",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const getNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const getActorEvent = (value: unknown): OkfActorEvent | undefined => {
  if (!isRecord(value)) return undefined;
  const by = getNonEmptyString(value.by);
  const at = getNonEmptyString(value.at);
  return by && at ? { by, at } : undefined;
};

const getVerifiedEvents = (value: unknown) => {
  const values = Array.isArray(value) ? value : typeof value === "undefined" ? [] : [value];
  return values.flatMap((candidate) => {
    const event = getActorEvent(candidate);
    return event ? [event] : [];
  });
};

const getSources = (value: unknown): OkfSource[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const resource = getNonEmptyString(candidate.resource);
    if (!resource) return [];
    const id = getNonEmptyString(candidate.id);
    const title = getNonEmptyString(candidate.title);
    const author = getNonEmptyString(candidate.author);
    const lastModified = getNonEmptyString(candidate.last_modified);
    const usageCount = typeof candidate.usage_count === "number"
      && Number.isFinite(candidate.usage_count)
      && candidate.usage_count >= 0
      ? candidate.usage_count
      : undefined;
    return [{
      resource,
      ...(id ? { id } : {}),
      ...(title ? { title } : {}),
      ...(author ? { author } : {}),
      ...(typeof usageCount === "number" ? { usageCount } : {}),
      ...(lastModified ? { lastModified } : {}),
    }];
  });
};

const getTags = (value: unknown) => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const candidate of values) {
    const tag = getNonEmptyString(candidate);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
};

export const getOkfTrustTier = (
  verified: readonly OkfActorEvent[],
): OkfTrustTier => verified.length === 0
  ? "unverified"
  : verified.some((event) => event.by.startsWith("human:"))
    ? "human-reviewed"
    : "machine-confirmed";

export const getOkfFreshness = (
  metadata: Pick<WorkspaceKnowledgeMetadata, "staleAfter">,
  today = new Date().toISOString().slice(0, 10),
): OkfFreshness => metadata.staleAfter && today >= metadata.staleAfter
  ? "stale"
  : "current";

export const normalizeWorkspaceKnowledgeMetadata = (
  metadata: Readonly<Record<string, unknown>>,
): WorkspaceKnowledgeMetadata => {
  const type = getNonEmptyString(metadata.type);
  const description = getNonEmptyString(metadata.description);
  const resource = getNonEmptyString(metadata.resource);
  const generated = getActorEvent(metadata.generated);
  const verified = getVerifiedEvents(metadata.verified);
  const statusValue = getNonEmptyString(metadata.status);
  const status = statusValue && lifecycleStatuses.has(statusValue as OkfLifecycleStatus)
    ? statusValue as OkfLifecycleStatus
    : "stable";
  const staleAfter = getNonEmptyString(metadata.stale_after);
  const legacyTimestamp = getNonEmptyString(metadata.timestamp);
  return {
    ...(type ? { type } : {}),
    ...(description ? { description } : {}),
    tags: getTags(metadata.tags),
    ...(resource ? { resource } : {}),
    sources: getSources(metadata.sources),
    ...(generated ? { generated } : {}),
    verified,
    status,
    ...(staleAfter ? { staleAfter } : {}),
    ...(generated?.at || legacyTimestamp
      ? { generatedAt: generated?.at ?? legacyTimestamp }
      : {}),
    trustTier: getOkfTrustTier(verified),
  };
};
