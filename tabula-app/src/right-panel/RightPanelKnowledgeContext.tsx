import {
  getOkfFreshness,
  type AgentInstructionReport,
  type AgentInstructionChange,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceKnowledgeHealthReport,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import { ArrowUpRight, ChevronRight } from "lucide-react";
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

const standardMetadataKeys = new Set([
  "description",
  "generated",
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

export function RightPanelKnowledgeContext({
  activeFileId,
  activeFileTitle,
  compatibilityCopy,
  copy,
  healthReport,
  index,
  onSelectHealthIssue,
  agentInstructions,
  onSelectFile,
  instructionChanges,
}: {
  activeFileId: string;
  activeFileTitle: string;
  compatibilityCopy: KnowledgeCompatibilityCopy;
  copy: KnowledgePanelCopy;
  healthReport?: WorkspaceKnowledgeHealthReport;
  index?: WorkspaceKnowledgeIndex;
  onSelectHealthIssue: (issue: WorkspaceKnowledgeHealthIssue) => void;
  agentInstructions?: AgentInstructionReport;
  onSelectFile: (fileId: string) => void;
  instructionChanges?: readonly AgentInstructionChange[];
}) {
  const analysis = index?.analysesByDocumentId.get(activeFileId);
  const metadata = analysis?.knowledgeMetadata;
  const owner = formatMetadataValue(analysis?.metadata.owner);
  const extensionMetadata = Object.entries(analysis?.metadata ?? {})
    .filter(([key]) => !standardMetadataKeys.has(key))
    .flatMap(([key, value]) => {
      const formatted = formatMetadataValue(value);
      return formatted ? [{ key, value: formatted }] : [];
    });
  const issues = healthReport?.issues.filter(
    (issue) => issue.documentId === activeFileId,
  ) ?? [];
  const instructionApplication = agentInstructions?.applications.find(
    (application) => application.documentId === activeFileId,
  );
  const instructionConflict = agentInstructions?.issues.some(
    (issue) =>
      issue.code === "agents_scope_conflict_candidate"
      && issue.documentId === activeFileId,
  );
  const activeSkill = agentInstructions?.skills.find(
    (skill) => skill.documentId === activeFileId,
  );
  const instructionChange = instructionChanges?.find(
    (change) => change.path === analysis?.path,
  );
  return (
    <section className="right-knowledge-context" aria-label={copy.documentContext}>
      {!analysis || !metadata ? (
        <PanelEmptyState>{copy.notConcept}</PanelEmptyState>
      ) : (
        <div className="right-knowledge-context-scroll">
          <header className="right-knowledge-document-heading">
            <h2>{analysis.title || activeFileTitle}</h2>
            <p>{analysis.path}</p>
          </header>

          <section className="right-knowledge-context-section">
            <h3>
              <span>{copy.applicableInstructions}</span>
              {(instructionApplication?.instructions.length ?? 0) > 0 && (
                <span>{instructionApplication?.instructions.length}</span>
              )}
            </h3>
            {instructionApplication?.instructions.length ? (
              <div className="right-knowledge-issue-list">
                {instructionApplication.instructions.map((instruction) => (
                  <button
                    type="button"
                    key={instruction.documentId}
                    onClick={() => onSelectFile(instruction.documentId)}
                  >
                    <span>
                      {instruction.kind === "agents"
                        ? copy.agentsInstruction
                        : copy.claudeSteering}
                      <small>
                        {instruction.path}
                        {instruction.vendorSpecific
                          ? ` · ${copy.vendorSpecific}`
                          : ""}
                      </small>
                    </span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <p>{copy.noApplicableInstructions}</p>
            )}
            {instructionConflict && (
              <p className="right-knowledge-instruction-warning">
                {copy.instructionConflict}
              </p>
            )}
            {activeSkill && (
              <div className="right-knowledge-skill-status">
                <strong>{copy.skillDefinition}</strong>
                <span>
                  {activeSkill.trust === "unreviewed"
                    ? copy.unreviewedSkill
                    : activeSkill.name}
                </span>
                <small>{copy.scriptsNotExecuted}</small>
              </div>
            )}
            {instructionChange && (
              <div className="right-knowledge-skill-status">
                <strong>{copy.instructionChanged}</strong>
                <span>{instructionChange.kind}</span>
                <small>{copy.instructionChangedDescription}</small>
              </div>
            )}
          </section>

          {metadata.description && (
            <section className="right-knowledge-context-section">
              <h3>{copy.description}</h3>
              <p>{metadata.description}</p>
            </section>
          )}

          <section className="right-knowledge-context-section">
            <h3>{copy.properties}</h3>
            <dl className="right-knowledge-property-list">
              <div>
                <dt>{copy.type}</dt>
                <dd>{metadata.type ?? copy.notSet}</dd>
              </div>
              <div>
                <dt>{copy.status}</dt>
                <dd>{metadata.status}</dd>
              </div>
              <div>
                <dt>{copy.trust}</dt>
                <dd>{metadata.trustTier}</dd>
              </div>
              <div>
                <dt>{copy.freshness}</dt>
                <dd>{getOkfFreshness(metadata)}</dd>
              </div>
              {owner && (
                <div>
                  <dt>{copy.owner}</dt>
                  <dd>{owner}</dd>
                </div>
              )}
              {metadata.tags.length > 0 && (
                <div>
                  <dt>{copy.tags}</dt>
                  <dd>{metadata.tags.join(", ")}</dd>
                </div>
              )}
            </dl>
          </section>

          {extensionMetadata.length > 0 && (
            <section className="right-knowledge-context-section">
              <h3>{copy.additionalMetadata}</h3>
              <dl className="right-knowledge-property-list">
                {extensionMetadata.map(({ key, value }) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="right-knowledge-context-section">
            <h3>{copy.provenance}</h3>
            {metadata.generated && (
              <dl className="right-knowledge-property-list">
                <div>
                  <dt>{copy.generatedBy}</dt>
                  <dd>{metadata.generated.by}</dd>
                </div>
                <div>
                  <dt>{copy.generatedAt}</dt>
                  <dd>{metadata.generated.at}</dd>
                </div>
              </dl>
            )}
            {metadata.resource && (() => {
              const href = getOpenableResource(metadata.resource);
              const content = (
                <>
                  <span>
                    <strong>{copy.canonicalResource}</strong>
                    <small>{metadata.resource}</small>
                  </span>
                  {href && <ArrowUpRight size={14} aria-hidden="true" />}
                </>
              );
              return href ? (
                <a
                  className="right-knowledge-source-row"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${copy.openSource}: ${metadata.resource}`}
                >
                  {content}
                </a>
              ) : <div className="right-knowledge-source-row">{content}</div>;
            })()}
            <div className="right-knowledge-source-group">
              <h4>{copy.sources}</h4>
              {metadata.sources.length === 0 ? (
                <p>{copy.noSources}</p>
              ) : metadata.sources.map((source, sourceIndex) => {
                const href = getOpenableResource(source.resource);
                const label = source.title || source.id || source.resource;
                return href ? (
                  <a
                    className="right-knowledge-source-row"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    key={`${source.resource}:${sourceIndex}`}
                    aria-label={`${copy.openSource}: ${label}`}
                  >
                    <span>
                      <strong>{label}</strong>
                      <small>{source.resource}</small>
                    </span>
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                ) : (
                  <div
                    className="right-knowledge-source-row"
                    key={`${source.resource}:${sourceIndex}`}
                  >
                    <span>
                      <strong>{label}</strong>
                      <small>{source.resource}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="right-knowledge-context-section">
            <h3>{copy.verification}</h3>
            {metadata.verified.length === 0 ? (
              <p>{copy.neverVerified}</p>
            ) : (
              <dl className="right-knowledge-property-list">
                <div>
                  <dt>{copy.latestVerification}</dt>
                  <dd>
                    {displayActor(metadata.verified.at(-1)!.by)}
                    <small>{metadata.verified.at(-1)!.at}</small>
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <section className="right-knowledge-context-section">
            <h3>
              <span>{copy.issues}</span>
              {issues.length > 0 && <span>{issues.length}</span>}
            </h3>
            {issues.length === 0 ? (
              <p>{copy.noIssues}</p>
            ) : (
              <div className="right-knowledge-issue-list">
                {issues.map((issue, issueIndex) => (
                  <button
                    type="button"
                    key={`${issue.code}:${issue.value ?? ""}:${issueIndex}`}
                    onClick={() => onSelectHealthIssue(issue)}
                  >
                    <span>{compatibilityCopy.healthIssue(issue)}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
