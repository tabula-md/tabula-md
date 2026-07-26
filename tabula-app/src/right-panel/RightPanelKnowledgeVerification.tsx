import {
  getOkfRepairDiff,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceKnowledgeHealthIssueCode,
  type WorkspaceKnowledgeHealthReport,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import {
  ChevronDown,
  ExternalLink,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";

const verificationIssueCodes = new Set<WorkspaceKnowledgeHealthIssueCode>([
  "unverified_generated",
  "verification_outdated",
]);

type VerificationCandidate = {
  issue: WorkspaceKnowledgeHealthIssue;
  documentId: string;
  path: string;
};

const getOpenableResource = (resource: string) => {
  try {
    const url = new URL(resource);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

export function RightPanelKnowledgeVerification({
  activeFileId,
  baseline,
  copy,
  identityName,
  index,
  report,
  onSelectFile,
  onVerifyDocument,
}: {
  activeFileId: string;
  baseline?: WorkspaceKnowledgeBaseline;
  copy: KnowledgeCompatibilityCopy;
  identityName: string;
  index: WorkspaceKnowledgeIndex;
  report: WorkspaceKnowledgeHealthReport;
  onSelectFile: (fileId: string) => void;
  onVerifyDocument: (documentId: string, verifiedBy: string) => boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [attestedIds, setAttestedIds] = useState<Set<string>>(() => new Set());
  const candidates = useMemo(() => {
    const unique = new Map<string, VerificationCandidate>();
    for (const issue of report.issues) {
      if (!verificationIssueCodes.has(issue.code) || unique.has(issue.documentId)) continue;
      unique.set(issue.documentId, {
        issue,
        documentId: issue.documentId,
        path: issue.path,
      });
    }
    return [...unique.values()];
  }, [report]);

  if (candidates.length === 0) return null;

  return (
    <section
      className="right-compatibility-verification-section"
      aria-labelledby="right-knowledge-verification-title"
    >
      <div className="right-compatibility-section-copy">
        <h3 id="right-knowledge-verification-title">
          <span>{copy.verificationReview}</span>
          <span>{candidates.length}</span>
        </h3>
        <p>{copy.verificationReviewDescription}</p>
      </div>
      <div className="right-compatibility-verification-list">
        {candidates.map((candidate) => {
          const analysis = index.analysesByDocumentId.get(candidate.documentId);
          const document = index.documentsById.get(candidate.documentId);
          if (!analysis || !document) return null;
          const metadata = analysis.knowledgeMetadata;
          const sources = metadata.sources;
          const evidence = [...new Set([
            ...(metadata.resource ? [metadata.resource] : []),
            ...sources.map((source) => source.resource),
          ])];
          const hasEvidence = evidence.length > 0;
          const hasAttested = attestedIds.has(candidate.documentId);
          const isExpanded = candidate.documentId === expandedId;
          const isActive = candidate.documentId === activeFileId;
          const baselineDocument = baseline?.documents.find(
            (entry) => entry.id === candidate.documentId,
          );
          const diff = baselineDocument && baselineDocument.markdown !== document.markdown
            ? getOkfRepairDiff(baselineDocument.markdown, document.markdown)
            : [];
          const latestVerification = metadata.verified.at(-1);

          return (
            <article
              className={`right-compatibility-verification-item ${
                isExpanded ? "expanded" : ""
              }`.trim()}
              key={candidate.documentId}
            >
              <button
                className="right-compatibility-verification-row"
                type="button"
                aria-expanded={isExpanded}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  setExpandedId(isExpanded ? null : candidate.documentId);
                  setFailedId(null);
                  setAttestedIds((current) => {
                    const next = new Set(current);
                    next.delete(candidate.documentId);
                    return next;
                  });
                }}
              >
                <span>
                  <strong>{analysis.title}</strong>
                  <small>{candidate.path}</small>
                </span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {isExpanded && (
                <div className="right-compatibility-verification-detail">
                  <dl>
                    <div>
                      <dt>{copy.generatedBy}</dt>
                      <dd>{metadata.generated?.by ?? copy.unknownActor}</dd>
                    </div>
                    <div>
                      <dt>{copy.generatedAt}</dt>
                      <dd>{metadata.generatedAt ?? copy.unknownDate}</dd>
                    </div>
                    {latestVerification && (
                      <div>
                        <dt>{copy.latestVerification}</dt>
                        <dd>{latestVerification.by}<br />{latestVerification.at}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="right-compatibility-verification-evidence">
                    <strong>{copy.evidence}</strong>
                    {evidence.length > 0 ? (
                      <ul>
                        {evidence.map((resource, index) => {
                          const href = getOpenableResource(resource);
                          return (
                            <li key={`${resource}:${index}`}>
                              {href ? (
                                <a href={href} target="_blank" rel="noreferrer">
                                  <span>{resource}</span>
                                  <ExternalLink size={13} aria-hidden="true" />
                                </a>
                              ) : <span>{resource}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    ) : <p>{copy.verificationNeedsEvidence}</p>}
                  </div>

                  <div className="right-compatibility-verification-diff">
                    <strong>{copy.changesSinceTracking}</strong>
                    {diff.length > 0 ? (
                      <pre>
                        {diff.map((line, index) => (
                          <code className={line.kind} key={`${line.kind}:${index}`}>
                            <span aria-hidden="true">
                              {line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}
                            </span>
                            {line.text || " "}
                          </code>
                        ))}
                      </pre>
                    ) : <p>{baseline ? copy.noTrackedChanges : copy.trackingRequiredForDiff}</p>}
                  </div>

                  <label className="right-compatibility-verification-attestation">
                    <input
                      type="checkbox"
                      checked={hasAttested}
                      disabled={!hasEvidence}
                      onChange={(event) => {
                        setAttestedIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(candidate.documentId);
                          else next.delete(candidate.documentId);
                          return next;
                        });
                      }}
                    />
                    <span>{copy.verificationAttestation}</span>
                  </label>

                  <div className="right-compatibility-verification-actions">
                    <button
                      type="button"
                      onClick={() => onSelectFile(candidate.documentId)}
                    >
                      <FileText size={14} aria-hidden="true" />
                      {copy.openDocumentAction}
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={!hasEvidence || !hasAttested || !identityName.trim()}
                      onClick={() => {
                        if (onVerifyDocument(candidate.documentId, identityName)) {
                          setExpandedId(null);
                          setFailedId(null);
                          setAttestedIds((current) => {
                            const next = new Set(current);
                            next.delete(candidate.documentId);
                            return next;
                          });
                        } else {
                          setFailedId(candidate.documentId);
                        }
                      }}
                    >
                      <ShieldCheck size={14} aria-hidden="true" />
                      {copy.recordVerification(identityName)}
                    </button>
                  </div>
                  {failedId === candidate.documentId && (
                    <p className="right-compatibility-inline-error">
                      {copy.verificationFailed}
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export const KNOWLEDGE_VERIFICATION_ISSUE_CODES = verificationIssueCodes;
