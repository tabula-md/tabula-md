import {
  getOkfMigrationUpdates,
  getOkfRepairDiff,
  OKF_SUPPORTED_VERSIONS,
  OKF_TARGET_VERSION,
  planOkf01To02Migration,
  planOkfConceptRepairs,
  planOkfWikilinkRepairs,
  type OkfCompatibilityIssue,
  type OkfCompatibilityReport,
  type OkfConceptRepairCandidate,
  type OkfConceptRepairUpdate,
  type OkfIndexCandidate,
  type OkfMigrationUpdate,
  type OkfWikilinkRepairUpdate,
  type WorkspaceKnowledgeIndex,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceKnowledgeHealthReport,
  type WorkspaceKnowledgeHealthDelta,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceOkfLogCandidate,
  type WorkspaceOkfConformancePlan,
} from "@tabula-md/tabula";
import {
  Check,
  CircleAlert,
  CircleCheck,
  FileText,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";
import { RightPanelOkfIndexes } from "./RightPanelOkfIndexes";
import { RightPanelKnowledgeHealth } from "./RightPanelKnowledgeHealth";
import { RightPanelKnowledgeChanges } from "./RightPanelKnowledgeChanges";
import {
  KNOWLEDGE_VERIFICATION_ISSUE_CODES,
  RightPanelKnowledgeVerification,
} from "./RightPanelKnowledgeVerification";

type RightPanelKnowledgeCompatibilityProps = {
  copy: KnowledgeCompatibilityCopy;
  documentCount: number;
  report?: OkfCompatibilityReport;
  healthReport?: WorkspaceKnowledgeHealthReport;
  healthDelta?: WorkspaceKnowledgeHealthDelta;
  conformancePlan?: WorkspaceOkfConformancePlan;
  knowledgeIndex?: WorkspaceKnowledgeIndex;
  knowledgeBaseline?: WorkspaceKnowledgeBaseline;
  knowledgeLogCandidate?: WorkspaceOkfLogCandidate;
  activeFileId: string;
  identityName: string;
  onSelectFile: (fileId: string) => void;
  onSelectHealthIssue: (issue: WorkspaceKnowledgeHealthIssue) => void;
  onSetActiveFileOkfType: (conceptType: string) => boolean;
  onApplyConceptRepairs: (updates: readonly OkfConceptRepairUpdate[]) => boolean;
  onApplyMigration: (updates: readonly OkfMigrationUpdate[]) => boolean;
  onApplyWikilinkRepairs: (updates: readonly OkfWikilinkRepairUpdate[]) => boolean;
  onMaterializeIndex: (candidate: OkfIndexCandidate) => boolean;
  onMaterializeLog: (candidate: WorkspaceOkfLogCandidate) => Promise<boolean>;
  onStartKnowledgeTracking: () => boolean;
  onVerifyKnowledgeDocument: (documentId: string, verifiedBy: string) => boolean;
  layout?: "panel" | "workspace";
};

type CompatibilityIssueSectionProps = {
  copy: KnowledgeCompatibilityCopy;
  issues: readonly OkfCompatibilityIssue[];
  label: string;
  severity: "error" | "warning";
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
};

function CompatibilityIssueSection({
  copy,
  issues,
  label,
  severity,
  activeFileId,
  onSelectFile,
}: CompatibilityIssueSectionProps) {
  if (issues.length === 0) return null;
  const Icon = severity === "error" ? CircleAlert : TriangleAlert;
  return (
    <section className="right-compatibility-issue-section" aria-label={label}>
      <h3 className="right-compatibility-section-title">
        <span>{label}</span>
        <span>{issues.length}</span>
      </h3>
      <div className="right-compatibility-issue-list">
        {issues.map((issue, index) => {
          const isActive = issue.documentId === activeFileId;
          return (
            <div
              key={`${issue.documentId}:${issue.code}:${issue.value ?? ""}:${index}`}
              className={`right-compatibility-issue-item ${isActive ? "active" : ""}`.trim()}
            >
              <button
                className={`right-compatibility-issue-row ${severity}`}
                type="button"
                aria-label={copy.openDocument(issue.path)}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelectFile(issue.documentId)}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="right-compatibility-issue-text">
                  <span className="right-compatibility-issue-title">{copy.issue(issue)}</span>
                  <span className="right-compatibility-issue-path">{issue.path}</span>
                </span>
                <FileText size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const getCandidateKey = (candidate: OkfConceptRepairCandidate) =>
  `${candidate.documentId}:${candidate.issueCodes.join(",")}:${candidate.beforeMarkdown.length}`;

const getDefaultProducer = (identityName: string) => {
  const normalized = identityName
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized ? `human:${normalized}` : "";
};

function OkfMigrationSection({
  copy,
  identityName,
  index,
  onApply,
}: {
  copy: KnowledgeCompatibilityCopy;
  identityName: string;
  index: WorkspaceKnowledgeIndex;
  onApply: (updates: readonly OkfMigrationUpdate[]) => boolean;
}) {
  const [producerBy, setProducerBy] = useState(() => getDefaultProducer(identityName));
  const plan = useMemo(
    () => planOkf01To02Migration(index, { producerBy }),
    [index, producerBy],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(
      plan.candidates
        .filter((candidate) => candidate.changed)
        .map((candidate) => candidate.documentId),
    ),
  );
  const [previewId, setPreviewId] = useState<string | null>(
    () => plan.candidates.find((candidate) => candidate.changed)?.documentId ?? null,
  );
  const [applyFailed, setApplyFailed] = useState(false);
  const candidateSignature = plan.candidates
    .map((candidate) =>
      `${candidate.documentId}:${candidate.changed}:${candidate.beforeMarkdown.length}:${
        candidate.markdown.length
      }`
    )
    .join("|");

  useEffect(() => {
    setSelectedIds((current) => new Set(
      [...current].filter((documentId) =>
        plan.candidates.some(
          (candidate) => candidate.documentId === documentId && candidate.changed,
        )
      ),
    ));
    setPreviewId((current) =>
      current && plan.candidates.some((candidate) => candidate.documentId === current)
        ? current
        : plan.candidates.find((candidate) => candidate.changed)?.documentId ?? null
    );
    setApplyFailed(false);
  }, [candidateSignature]);

  if (!plan.applicable) return null;

  const updates = getOkfMigrationUpdates(plan, [...selectedIds]);
  const preview = plan.candidates.find((candidate) => candidate.documentId === previewId)
    ?? plan.candidates.find((candidate) => candidate.changed);
  const diff = preview
    ? getOkfRepairDiff(preview.beforeMarkdown, preview.markdown)
    : [];

  return (
    <section className="right-compatibility-repair-section" aria-label={copy.migrationTitle}>
      <div className="right-compatibility-section-copy">
        <h3>
          <span>{copy.migrationTitle}</span>
          <span>0.1 → 0.2</span>
        </h3>
        <p>{copy.migrationDescription}</p>
      </div>
      <div className="right-compatibility-repair-editor">
        <label>
          <span>{copy.migrationProducer}</span>
          <input
            type="text"
            value={producerBy}
            placeholder="human:taeha or agent/1.0"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setProducerBy(event.target.value);
              setApplyFailed(false);
            }}
          />
        </label>
      </div>
      <div className="right-compatibility-migration-summary" role="status">
        <span>{copy.migrationChangedFiles(plan.changedFileCount)}</span>
        <span>{copy.migrationManualCitations(plan.manualCitationCount)}</span>
        <span>{copy.migrationMissingProducers(plan.missingProducerCount)}</span>
        <span>{copy.migrationDeletedFiles(plan.deletedFileCount)}</span>
      </div>
      <div className="right-compatibility-repair-list">
        {plan.candidates.map((candidate) => {
          const selected = selectedIds.has(candidate.documentId);
          const isPreviewed = candidate.documentId === preview?.documentId;
          return (
            <div
              className={`right-compatibility-repair-item ${
                isPreviewed ? "previewed" : ""
              }`.trim()}
              key={candidate.documentId}
            >
              <div className="right-compatibility-repair-row">
                <button
                  className={`right-compatibility-repair-check ${selected ? "selected" : ""}`}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={`${copy.includeChange}: ${candidate.path}`}
                  disabled={!candidate.changed}
                  onClick={() => {
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(candidate.documentId)) next.delete(candidate.documentId);
                      else next.add(candidate.documentId);
                      return next;
                    });
                    setPreviewId(candidate.documentId);
                    setApplyFailed(false);
                  }}
                >
                  {selected && <Check size={13} aria-hidden="true" />}
                </button>
                <button
                  className="right-compatibility-repair-document"
                  type="button"
                  onClick={() => setPreviewId(candidate.documentId)}
                >
                  <span className="right-compatibility-issue-title">
                    {candidate.changed ? copy.migrationFile : copy.upToDate}
                  </span>
                  <span className="right-compatibility-issue-path">
                    {candidate.path}
                    {candidate.issues.length > 0
                      ? ` — ${copy.migrationDecisions(candidate.issues.length)}`
                      : ""}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {preview && (
        <div className="right-compatibility-diff" aria-label={`${preview.path} diff`}>
          <div className="right-compatibility-diff-header">
            <span>{preview.path}</span>
            <span>OKF 0.2</span>
          </div>
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
        </div>
      )}
      {updates.length > 0 && (
        <div className="right-compatibility-apply-row">
          <span>{copy.selectedChanges(updates.length)}</span>
          <button
            type="button"
            onClick={() => {
              if (onApply(updates)) {
                setSelectedIds(new Set());
                setPreviewId(null);
                setApplyFailed(false);
              } else {
                setApplyFailed(true);
              }
            }}
          >
            {copy.migrationApply}
          </button>
        </div>
      )}
      {applyFailed && <p className="right-compatibility-inline-error">{copy.planChanged}</p>}
    </section>
  );
}

function ConceptRepairSection({
  activeFileId,
  candidates,
  copy,
  index,
  onApply,
  onSelectFile,
  report,
}: {
  activeFileId: string;
  candidates: readonly OkfConceptRepairCandidate[];
  copy: KnowledgeCompatibilityCopy;
  index: WorkspaceKnowledgeIndex;
  onApply: (updates: readonly OkfConceptRepairUpdate[]) => boolean;
  onSelectFile: (fileId: string) => void;
  report: OkfCompatibilityReport;
}) {
  const [typeDrafts, setTypeDrafts] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [applyFailed, setApplyFailed] = useState(false);
  const candidateSignature = candidates.map(getCandidateKey).join("|");

  useEffect(() => {
    setTypeDrafts((current) => Object.fromEntries(candidates.map((candidate) => [
      candidate.documentId,
      current[candidate.documentId] ?? candidate.suggestedType?.type ?? "",
    ])));
    setSelectedIds((current) => new Set(
      [...current].filter((documentId) =>
        candidates.some((candidate) => candidate.documentId === documentId)
      ),
    ));
    setPreviewId((current) =>
      current && candidates.some((candidate) => candidate.documentId === current)
        ? current
        : null
    );
    setApplyFailed(false);
  }, [candidateSignature]);

  const choices = candidates.flatMap((candidate) =>
    selectedIds.has(candidate.documentId)
      ? [{
          documentId: candidate.documentId,
          conceptType: typeDrafts[candidate.documentId] ?? "",
        }]
      : []
  );
  const repairPlan = useMemo(
    () => planOkfConceptRepairs(index, choices),
    [choices.map((choice) => `${choice.documentId}:${choice.conceptType}`).join("|"), index],
  );
  const previewUpdate = repairPlan.updates.find((update) => update.documentId === previewId)
    ?? repairPlan.updates[0];
  const diff = previewUpdate
    ? getOkfRepairDiff(previewUpdate.beforeMarkdown, previewUpdate.markdown)
    : [];

  if (candidates.length === 0) return null;
  const toggleSelected = (candidate: OkfConceptRepairCandidate) => {
    const draft = typeDrafts[candidate.documentId]?.trim();
    if (!candidate.repairable || !draft) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(candidate.documentId)) next.delete(candidate.documentId);
      else next.add(candidate.documentId);
      return next;
    });
    setPreviewId(candidate.documentId);
    setApplyFailed(false);
  };

  return (
    <section className="right-compatibility-repair-section" aria-label={copy.safeFixes}>
      <div className="right-compatibility-section-copy">
        <h3>
          <span>{copy.safeFixes}</span>
          <span>{candidates.length}</span>
        </h3>
        <p>{copy.safeFixesDescription}</p>
      </div>
      <div className="right-compatibility-repair-list">
        {candidates.map((candidate) => {
          const isActive = candidate.documentId === activeFileId;
          const isPreviewed = candidate.documentId === previewId;
          const selected = selectedIds.has(candidate.documentId);
          const draft = typeDrafts[candidate.documentId] ?? "";
          const issue = report.issues.find((candidateIssue) =>
            candidateIssue.documentId === candidate.documentId
            && candidate.issueCodes.includes(candidateIssue.code)
          );
          return (
            <div
              className={`right-compatibility-repair-item ${
                isActive ? "active" : ""
              } ${isPreviewed ? "previewed" : ""}`.trim()}
              key={candidate.documentId}
            >
              <div className="right-compatibility-repair-row">
                <button
                  className={`right-compatibility-repair-check ${selected ? "selected" : ""}`}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={`${copy.includeChange}: ${candidate.path}`}
                  disabled={!candidate.repairable || !draft.trim()}
                  onClick={() => toggleSelected(candidate)}
                >
                  {selected && <Check size={13} aria-hidden="true" />}
                </button>
                <button
                  className="right-compatibility-repair-document"
                  type="button"
                  aria-label={copy.openDocument(candidate.path)}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    onSelectFile(candidate.documentId);
                    setPreviewId(candidate.documentId);
                  }}
                >
                  <span className="right-compatibility-issue-title">
                    {issue ? copy.issue(issue) : copy.setConceptType}
                  </span>
                  <span className="right-compatibility-issue-path">{candidate.path}</span>
                </button>
              </div>
              {isPreviewed && (
                <div className="right-compatibility-repair-editor">
                  {candidate.repairable ? (
                    <>
                      <label>
                        <span>{copy.conceptTypeLabel}</span>
                        <input
                          type="text"
                          value={draft}
                          placeholder={copy.conceptTypePlaceholder}
                          aria-label={`${copy.conceptTypeLabel}: ${candidate.path}`}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => {
                            const nextDraft = event.target.value;
                            setTypeDrafts((current) => ({
                              ...current,
                              [candidate.documentId]: nextDraft,
                            }));
                            if (!nextDraft.trim()) {
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                next.delete(candidate.documentId);
                                return next;
                              });
                            }
                            setApplyFailed(false);
                          }}
                        />
                      </label>
                      <p>
                        {candidate.suggestedType?.source === "folder"
                          ? copy.suggestedFromFolder(candidate.suggestedType.type)
                          : candidate.suggestedType?.source === "path"
                            ? copy.suggestedFromPath(candidate.suggestedType.type)
                            : copy.typeDecisionRequired}
                      </p>
                    </>
                  ) : (
                    <p>{copy.invalidYamlRequiresManualFix}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {previewUpdate && (
        <div className="right-compatibility-diff" aria-label={`${previewUpdate.path} diff`}>
          <div className="right-compatibility-diff-header">
            <span>{previewUpdate.path}</span>
            <span>{previewUpdate.conceptType}</span>
          </div>
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
        </div>
      )}
      {repairPlan.updates.length > 0 && (
        <div className="right-compatibility-apply-row">
          <span>{copy.selectedChanges(repairPlan.updates.length)}</span>
          <button
            type="button"
            onClick={() => {
              if (onApply(repairPlan.updates)) {
                setSelectedIds(new Set());
                setPreviewId(null);
                setApplyFailed(false);
              } else {
                setApplyFailed(true);
              }
            }}
          >
            {copy.applySelected}
          </button>
        </div>
      )}
      {applyFailed && <p className="right-compatibility-inline-error">{copy.planChanged}</p>}
    </section>
  );
}

function MetadataGuidanceSection({
  activeFileId,
  copy,
  onSelectFile,
  plan,
}: {
  activeFileId: string;
  copy: KnowledgeCompatibilityCopy;
  onSelectFile: (fileId: string) => void;
  plan: WorkspaceOkfConformancePlan;
}) {
  if (plan.metadataSuggestions.length === 0) return null;
  return (
    <section className="right-compatibility-metadata-section" aria-label={copy.metadataGuidance}>
      <div className="right-compatibility-section-copy">
        <h3>
          <span>{copy.metadataGuidance}</span>
          <span>{plan.metadataSuggestions.length}</span>
        </h3>
        <p>{copy.metadataGuidanceDescription}</p>
      </div>
      <div className="right-compatibility-metadata-list">
        {plan.metadataSuggestions.map((suggestion) => (
          <button
            type="button"
            className={suggestion.documentId === activeFileId ? "active" : ""}
            aria-label={copy.openDocument(suggestion.path)}
            key={suggestion.documentId}
            onClick={() => onSelectFile(suggestion.documentId)}
          >
            <span>{suggestion.path}</span>
            <small>
              {suggestion.missingFields
                .map((field) => copy.metadataFields[field])
                .join(", ")}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}

function WikilinkRepairSection({
  copy,
  index,
  onApply,
  plan,
}: {
  copy: KnowledgeCompatibilityCopy;
  index: WorkspaceKnowledgeIndex;
  onApply: (updates: readonly OkfWikilinkRepairUpdate[]) => boolean;
  plan: WorkspaceOkfConformancePlan;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applyFailed, setApplyFailed] = useState(false);
  const candidateSignature = plan.wikilinkRepairs
    .map((candidate) =>
      `${candidate.documentId}:${candidate.beforeMarkdown.length}:${candidate.convertibleCount}`
    )
    .join("|");

  useEffect(() => {
    setSelectedIds((current) => new Set(
      [...current].filter((documentId) =>
        plan.wikilinkRepairs.some((candidate) => candidate.documentId === documentId)
      ),
    ));
    setApplyFailed(false);
  }, [candidateSignature]);

  const updates = useMemo(
    () => planOkfWikilinkRepairs(index, [...selectedIds]),
    [index, [...selectedIds].sort().join("|")],
  );
  const preview = updates[0];
  const diff = preview
    ? getOkfRepairDiff(preview.beforeMarkdown, preview.markdown)
    : [];

  if (plan.wikilinkRepairs.length === 0) return null;
  return (
    <section className="right-compatibility-repair-section" aria-label={copy.portableLinks}>
      <div className="right-compatibility-section-copy">
        <h3>
          <span>{copy.portableLinks}</span>
          <span>{plan.wikilinkRepairs.length}</span>
        </h3>
        <p>{copy.portableLinksDescription}</p>
      </div>
      <div className="right-compatibility-repair-list">
        {plan.wikilinkRepairs.map((candidate) => {
          const selected = selectedIds.has(candidate.documentId);
          return (
            <div className="right-compatibility-repair-item" key={candidate.documentId}>
              <div className="right-compatibility-repair-row">
                <button
                  className={`right-compatibility-repair-check ${selected ? "selected" : ""}`}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={`${copy.includeChange}: ${candidate.path}`}
                  onClick={() => {
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(candidate.documentId)) next.delete(candidate.documentId);
                      else next.add(candidate.documentId);
                      return next;
                    });
                    setApplyFailed(false);
                  }}
                >
                  {selected && <Check size={13} aria-hidden="true" />}
                </button>
                <span className="right-compatibility-repair-document">
                  <span className="right-compatibility-issue-title">
                    {copy.convertibleLinks(candidate.convertibleCount)}
                  </span>
                  <span className="right-compatibility-issue-path">
                    {candidate.path}
                    {candidate.skippedCount > 0
                      ? ` — ${copy.skippedLinks(candidate.skippedCount)}`
                      : ""}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {preview && (
        <div className="right-compatibility-diff" aria-label={`${preview.path} diff`}>
          <div className="right-compatibility-diff-header">
            <span>{preview.path}</span>
            <span>{copy.markdownLinks}</span>
          </div>
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
        </div>
      )}
      {updates.length > 0 && (
        <div className="right-compatibility-apply-row">
          <span>{copy.selectedChanges(updates.length)}</span>
          <button
            type="button"
            onClick={() => {
              if (onApply(updates)) {
                setSelectedIds(new Set());
                setApplyFailed(false);
              } else {
                setApplyFailed(true);
              }
            }}
          >
            {copy.convertSelected}
          </button>
        </div>
      )}
      {applyFailed && <p className="right-compatibility-inline-error">{copy.planChanged}</p>}
    </section>
  );
}

export function RightPanelKnowledgeCompatibility({
  copy,
  documentCount,
  healthReport,
  healthDelta,
  report,
  conformancePlan,
  knowledgeIndex,
  knowledgeBaseline,
  knowledgeLogCandidate,
  activeFileId,
  identityName,
  onSelectFile,
  onSelectHealthIssue,
  onApplyConceptRepairs,
  onApplyMigration,
  onApplyWikilinkRepairs,
  onMaterializeIndex,
  onMaterializeLog,
  onStartKnowledgeTracking,
  onVerifyKnowledgeDocument,
  layout = "panel",
}: RightPanelKnowledgeCompatibilityProps) {
  const version = report?.declaredVersion
    && (OKF_SUPPORTED_VERSIONS as readonly string[]).includes(report.declaredVersion)
    ? report.declaredVersion
    : report?.targetVersion ?? OKF_TARGET_VERSION;
  const repairDocumentIds = new Set(
    conformancePlan?.conceptRepairs.map((candidate) => candidate.documentId) ?? [],
  );
  const requiredIssues = report?.issues.filter(
    (issue) => issue.severity === "error" && !repairDocumentIds.has(issue.documentId),
  ) ?? [];
  const warningIssues = report?.issues.filter((issue) => issue.severity === "warning") ?? [];
  const statusTone = !report || documentCount === 0
    ? "neutral"
    : report.detection !== "declared"
      ? "neutral"
    : report.errorCount > 0
      ? "error"
      : "success";
  const statusTitle = !report
    ? copy.unavailable
    : documentCount === 0
      ? copy.noDocuments
      : report.detection === "okf-like"
        ? copy.okfLike
        : report.detection === "none"
          ? copy.markdownOnly
          : report.detection === "future"
            ? copy.futureVersion(report.declaredVersion ?? version)
      : report.errorCount > 0
        ? copy.requiredChanges(report.errorCount)
        : copy.compatible(version);
  const StatusIcon = statusTone === "error"
    ? CircleAlert
    : statusTone === "success"
      ? CircleCheck
      : TriangleAlert;
  const advancedSupportTitle = report?.advancedSupport.level === "advanced"
    ? copy.supportAdvanced(report.advancedSupport.attestedComputationCount)
    : report?.advancedSupport.level === "advanced-partial"
      ? copy.supportAdvancedPartial(
          report.advancedSupport.unsupportedComputationCount,
          report.advancedSupport.unsupportedRuntimes.join(", "),
        )
      : copy.supportCore;

  return (
    <div className={`right-compatibility-scroll ${layout}`}>
      <header className="right-compatibility-header">
        <div className="right-compatibility-heading-row">
          <h2>{copy.title}</h2>
          <span className="right-compatibility-standard">
            {report?.detection === "okf-like"
              ? "OKF-like"
              : report?.detection === "none"
                ? "Markdown"
                : `OKF ${version}`}
          </span>
        </div>
        <p>{copy.description}</p>
      </header>

      <div className={`right-compatibility-status ${statusTone}`} role="status">
        <StatusIcon size={17} aria-hidden="true" />
        <span>
          <strong>{statusTitle}</strong>
          {report && documentCount > 0 && report.warningCount > 0 && (
            <small>{copy.portabilityWarnings(report.warningCount)}</small>
          )}
        </span>
      </div>

      {report?.validatedVersion === "0.2" && (
        <div
          className={`right-compatibility-support ${report.advancedSupport.level}`}
          role="status"
        >
          <span>{advancedSupportTitle}</span>
        </div>
      )}

      {knowledgeIndex && (
        <OkfMigrationSection
          copy={copy}
          identityName={identityName}
          index={knowledgeIndex}
          onApply={onApplyMigration}
        />
      )}

      {healthReport && knowledgeIndex && (
        <RightPanelKnowledgeVerification
          activeFileId={activeFileId}
          baseline={knowledgeBaseline}
          copy={copy}
          identityName={identityName}
          index={knowledgeIndex}
          report={healthReport}
          onSelectFile={onSelectFile}
          onVerifyDocument={onVerifyKnowledgeDocument}
        />
      )}

      {healthReport && (
        <RightPanelKnowledgeHealth
          activeFileId={activeFileId}
          copy={copy}
          report={healthReport}
          onSelectIssue={onSelectHealthIssue}
          omitCodes={KNOWLEDGE_VERIFICATION_ISSUE_CODES}
        />
      )}

      <RightPanelKnowledgeChanges
        baseline={knowledgeBaseline}
        candidate={knowledgeLogCandidate}
        copy={copy}
        healthDelta={healthDelta}
        onMaterialize={onMaterializeLog}
        onSelectIssue={onSelectHealthIssue}
        onSelectFile={onSelectFile}
        onStartTracking={onStartKnowledgeTracking}
      />

      {report && conformancePlan && knowledgeIndex && (
        <ConceptRepairSection
          activeFileId={activeFileId}
          candidates={conformancePlan.conceptRepairs}
          copy={copy}
          index={knowledgeIndex}
          onApply={onApplyConceptRepairs}
          onSelectFile={onSelectFile}
          report={report}
        />
      )}
      {conformancePlan && knowledgeIndex && (
        <WikilinkRepairSection
          copy={copy}
          index={knowledgeIndex}
          onApply={onApplyWikilinkRepairs}
          plan={conformancePlan}
        />
      )}
      <CompatibilityIssueSection
        copy={copy}
        issues={requiredIssues}
        label={copy.requiredSection}
        severity="error"
        activeFileId={activeFileId}
        onSelectFile={onSelectFile}
      />
      <CompatibilityIssueSection
        copy={copy}
        issues={warningIssues}
        label={copy.warningSection}
        severity="warning"
        activeFileId={activeFileId}
        onSelectFile={onSelectFile}
      />
      {conformancePlan && (
        <MetadataGuidanceSection
          activeFileId={activeFileId}
          copy={copy}
          onSelectFile={onSelectFile}
          plan={conformancePlan}
        />
      )}
      {conformancePlan && (
        <RightPanelOkfIndexes
          copy={copy}
          onMaterialize={onMaterializeIndex}
          plan={conformancePlan}
        />
      )}

      <p className="right-compatibility-footnote">{copy.unchanged}</p>
    </div>
  );
}
