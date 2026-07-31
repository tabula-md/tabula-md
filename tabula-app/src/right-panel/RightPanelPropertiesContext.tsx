import {
  getOkfReviewSchedule,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceKnowledgeHealthReport,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";
import type { KnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { PanelEmptyState } from "./PanelEmptyState";

const getOpenableResource = (resource: string | undefined) => {
  if (!resource) return undefined;
  try {
    const url = new URL(resource);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const displayActor = (actor: string) => actor.replace(/^human:/, "");
const displayDate = (dateTime: string) => dateTime.slice(0, 10);

const standardMetadataKeys = new Set([
  "description",
  "generated",
  "owner",
  "resource",
  "sources",
  "stale_after",
  "status",
  "tags",
  "timestamp",
  "title",
  "type",
  "verified",
]);

const formatMetadataValue = (value: unknown) => {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!Array.isArray(value)) return undefined;
  const values = value.filter(
    (candidate): candidate is string | number | boolean =>
      typeof candidate === "string" ||
      typeof candidate === "number" ||
      typeof candidate === "boolean",
  );
  return values.length === value.length ? values.join(", ") : undefined;
};

function PropertyRow({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`right-properties-row ${wide ? "wide" : ""}`.trim()}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PropertySection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="right-properties-section" aria-label={title}>
      <h3 className="right-properties-section-title">
        <span>{title}</span>
        {typeof count === "number" && (
          <span className="right-properties-section-count">{count}</span>
        )}
      </h3>
      {children}
    </section>
  );
}

export function RightPanelPropertiesContext({
  activeFileId,
  compatibilityCopy,
  copy,
  healthReport,
  index,
  onSelectHealthIssue,
}: {
  activeFileId: string;
  compatibilityCopy: KnowledgeCompatibilityCopy;
  copy: KnowledgePanelCopy;
  healthReport?: WorkspaceKnowledgeHealthReport;
  index?: WorkspaceKnowledgeIndex;
  onSelectHealthIssue: (issue: WorkspaceKnowledgeHealthIssue) => void;
}) {
  const analysis = index?.analysesByDocumentId.get(activeFileId);
  const metadata = analysis?.knowledgeMetadata;
  const owner = formatMetadataValue(analysis?.metadata.owner);
  const isTypedConcept = Boolean(metadata?.type);
  const hasLifecycleMetadata = isTypedConcept ||
    Object.prototype.hasOwnProperty.call(analysis?.metadata ?? {}, "status");
  const hasTrustMetadata = isTypedConcept ||
    Boolean(metadata?.generated) ||
    Boolean(metadata?.verified.length);
  const hasFreshnessMetadata = isTypedConcept ||
    Object.prototype.hasOwnProperty.call(analysis?.metadata ?? {}, "stale_after");
  const hasProvenanceMetadata = Boolean(metadata?.generated || metadata?.resource);
  const latestVerification = metadata?.verified.at(-1);
  const reviewSchedule = metadata ? getOkfReviewSchedule(metadata) : undefined;
  const trustValue = metadata?.trustTier === "human-reviewed"
    ? copy.humanReviewed
    : metadata?.trustTier === "machine-confirmed"
      ? copy.machineConfirmed
      : copy.unverified;
  const freshnessValue = reviewSchedule === "current"
    ? copy.current
    : reviewSchedule === "due"
      ? copy.reviewDue
      : reviewSchedule === "invalid"
        ? copy.invalidReviewDate
        : copy.noReviewDate;
  const reviewDateValue = reviewSchedule === "invalid"
    ? copy.invalidReviewDateValue(metadata?.staleAfter ?? "")
    : metadata?.staleAfter ?? copy.noReviewScheduled;
  const extensionMetadata = Object.entries(analysis?.metadata ?? {})
    .filter(([key]) => !standardMetadataKeys.has(key))
    .flatMap(([key, value]) => {
      const formatted = formatMetadataValue(value);
      return formatted ? [{ key, value: formatted }] : [];
    });
  const issues = healthReport?.issues.filter(
    (issue) => issue.documentId === activeFileId,
  ) ?? [];

  return (
    <section className="right-properties-context" aria-label={copy.properties}>
      {!analysis || !metadata ? (
        <PanelEmptyState>{copy.notConcept}</PanelEmptyState>
      ) : (
        <div className="right-properties-scroll">
          {issues.length > 0 && (
            <PropertySection title={copy.issues} count={issues.length}>
              <div className="right-properties-issue-list">
                {issues.map((issue, issueIndex) => (
                  <button
                    type="button"
                    key={`${issue.code}:${issue.value ?? ""}:${issueIndex}`}
                    onClick={() => onSelectHealthIssue(issue)}
                  >
                    <span>{compatibilityCopy.healthIssue(issue)}</span>
                    <small>{copy.openIssue}</small>
                  </button>
                ))}
              </div>
            </PropertySection>
          )}

          <PropertySection title={copy.documentProperties}>
            <dl className="right-properties-list">
              <PropertyRow label={copy.type} value={metadata.type ?? copy.notSet} />
              {metadata.description && (
                <PropertyRow
                  label={copy.description}
                  value={metadata.description}
                  wide
                />
              )}
              {owner && <PropertyRow label={copy.owner} value={owner} />}
              {metadata.tags.length > 0 && (
                <PropertyRow label={copy.tags} value={metadata.tags.join(", ")} />
              )}
              {extensionMetadata.map(({ key, value }) => (
                <PropertyRow key={key} label={key} value={value} />
              ))}
            </dl>
          </PropertySection>

          {hasLifecycleMetadata && (
            <PropertySection title={copy.lifecycle}>
              <dl className="right-properties-list">
                <PropertyRow
                  label={copy.status}
                  value={copy.lifecycleStatus(metadata.status)}
                />
              </dl>
            </PropertySection>
          )}

          {hasFreshnessMetadata && (
            <PropertySection title={copy.freshness}>
              <dl className="right-properties-list">
                <PropertyRow label={copy.status} value={freshnessValue} />
                <PropertyRow label={copy.reviewDate} value={reviewDateValue} />
              </dl>
            </PropertySection>
          )}

          {hasTrustMetadata && (
            <PropertySection title={copy.trust}>
              <dl className="right-properties-list">
                <PropertyRow label={copy.status} value={trustValue} />
                {latestVerification ? (
                  <>
                    <PropertyRow
                      label={copy.verifiedBy}
                      value={displayActor(latestVerification.by)}
                    />
                    <PropertyRow
                      label={copy.verifiedAt}
                      value={(
                        <time
                          dateTime={latestVerification.at}
                          title={latestVerification.at}
                        >
                          {displayDate(latestVerification.at)}
                        </time>
                      )}
                    />
                  </>
                ) : (
                  <PropertyRow
                    label={copy.verification}
                    value={copy.neverVerified}
                    wide
                  />
                )}
              </dl>
            </PropertySection>
          )}

          {metadata.sources.length > 0 && (
            <PropertySection title={copy.sources} count={metadata.sources.length}>
              <div className="right-properties-source-list">
                {metadata.sources.map((source, sourceIndex) => {
                  const href = getOpenableResource(source.resource);
                  const label = source.title || source.id || source.resource;
                  const content = (
                    <>
                      <span>
                        <strong>{label}</strong>
                        <small>{source.resource}</small>
                      </span>
                      {href && <ArrowUpRight size={14} aria-hidden="true" />}
                    </>
                  );
                  return href ? (
                    <a
                      className="right-properties-source-row"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      key={`${source.resource}:${sourceIndex}`}
                      aria-label={`${copy.openSource}: ${label}`}
                    >
                      {content}
                    </a>
                  ) : (
                    <div
                      className="right-properties-source-row"
                      key={`${source.resource}:${sourceIndex}`}
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </PropertySection>
          )}

          {hasProvenanceMetadata && (
            <PropertySection title={copy.provenance}>
              <dl className="right-properties-list">
                {metadata.generated && (
                  <>
                    <PropertyRow
                      label={copy.generatedBy}
                      value={displayActor(metadata.generated.by)}
                    />
                    <PropertyRow
                      label={copy.generatedAt}
                      value={(
                        <time
                          dateTime={metadata.generated.at}
                          title={metadata.generated.at}
                        >
                          {displayDate(metadata.generated.at)}
                        </time>
                      )}
                    />
                  </>
                )}
                {metadata.resource && (() => {
                  const href = getOpenableResource(metadata.resource);
                  return (
                    <PropertyRow
                      label={copy.canonicalResource}
                      wide
                      value={href ? (
                        <a
                          className="right-properties-inline-link"
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${copy.openSource}: ${metadata.resource}`}
                        >
                          <span>{metadata.resource}</span>
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      ) : metadata.resource}
                    />
                  );
                })()}
              </dl>
            </PropertySection>
          )}
        </div>
      )}
    </section>
  );
}
