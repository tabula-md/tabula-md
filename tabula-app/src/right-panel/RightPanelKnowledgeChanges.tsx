import type {
  WorkspaceKnowledgeBaseline,
  WorkspaceKnowledgeHealthDelta,
  WorkspaceKnowledgeHealthIssue,
  WorkspaceOkfLogCandidate,
} from "@tabula-md/tabula";
import { Check, CircleAlert, FileText, Info } from "lucide-react";
import { useEffect, useState } from "react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";

export function RightPanelKnowledgeChanges({
  baseline,
  candidate,
  copy,
  healthDelta,
  onMaterialize,
  onSelectIssue,
  onSelectFile,
  onStartTracking,
}: {
  baseline?: WorkspaceKnowledgeBaseline;
  candidate?: WorkspaceOkfLogCandidate;
  copy: KnowledgeCompatibilityCopy;
  healthDelta?: WorkspaceKnowledgeHealthDelta;
  onMaterialize: (candidate: WorkspaceOkfLogCandidate) => Promise<boolean>;
  onSelectIssue: (issue: WorkspaceKnowledgeHealthIssue) => void;
  onSelectFile: (fileId: string) => void;
  onStartTracking: () => boolean;
}) {
  const [previewSource, setPreviewSource] = useState<"current" | "candidate">(
    "candidate",
  );
  const [applyFailed, setApplyFailed] = useState(false);
  const changeCount = candidate?.changeSet.changes.length ?? 0;

  useEffect(() => {
    setPreviewSource("candidate");
    setApplyFailed(false);
  }, [candidate?.date, candidate?.markdown, candidate?.state]);

  const startTracking = () => {
    if (!onStartTracking()) setApplyFailed(true);
  };
  const materialize = async () => {
    if (!candidate || !await onMaterialize(candidate)) {
      setApplyFailed(true);
    }
  };
  const renderHealthIssue = (
    issue: WorkspaceKnowledgeHealthIssue,
    state: "introduced" | "resolved",
  ) => {
    const IssueIcon = state === "resolved"
      ? Check
      : issue.severity === "attention"
        ? CircleAlert
        : Info;
    return (
      <button
        className={`right-compatibility-change-health-row ${state}`}
        type="button"
        key={`${state}:${issue.documentId}:${issue.code}:${issue.value ?? ""}`}
        aria-label={copy.openDocument(issue.path)}
        onClick={() => {
          if (state === "introduced") onSelectIssue(issue);
          else onSelectFile(issue.documentId);
        }}
      >
        <IssueIcon size={14} aria-hidden="true" />
        <span>
          <span>{copy.healthIssue(issue)}</span>
          <small>{issue.path}</small>
        </span>
      </button>
    );
  };

  return (
    <section
      className="right-compatibility-change-section"
      aria-label={copy.knowledgeChanges}
    >
      <div className="right-compatibility-section-copy">
        <h3>
          <span>{copy.knowledgeChanges}</span>
          {baseline && <span>{changeCount}</span>}
        </h3>
        <p>{copy.knowledgeChangesDescription}</p>
      </div>

      {!baseline && (
        <div className="right-compatibility-change-empty">
          <p>{copy.knowledgeChangesNotTracked}</p>
          <button type="button" onClick={startTracking}>
            {copy.startTracking}
          </button>
        </div>
      )}

      {baseline && candidate && changeCount === 0 && (
        <div className="right-compatibility-change-status">
          <Check size={14} aria-hidden="true" />
          <span>{copy.noKnowledgeChanges}</span>
          <small>{copy.trackingSince(baseline.capturedAt)}</small>
        </div>
      )}

      {baseline && candidate && changeCount > 0 && (
        <>
          <div className="right-compatibility-change-summary">
            {copy.changeSummary(
              candidate.changeSet.addedCount,
              candidate.changeSet.modifiedCount,
              candidate.changeSet.deletedCount,
            )}
          </div>
          <div className="right-compatibility-change-list">
            {candidate.changeSet.changes.map((change) => (
              <div
                className="right-compatibility-change-row"
                key={`${change.kind}:${change.documentId}:${change.path}`}
              >
                <FileText size={14} aria-hidden="true" />
                <span>
                  <strong>{change.title}</strong>
                  <small>{change.path}</small>
                </span>
                <em>{copy.changeKinds[change.kind]}</em>
              </div>
            ))}
          </div>

          {healthDelta && (
            <div className="right-compatibility-change-health">
              <div className="right-compatibility-change-health-heading">
                <span>{copy.maintenanceImpact}</span>
                <small>
                  {copy.maintenanceImpactSummary(
                    healthDelta.introducedIssues.length,
                    healthDelta.resolvedIssues.length,
                  )}
                </small>
              </div>
              {healthDelta.introducedIssues.length === 0 &&
                healthDelta.resolvedIssues.length === 0 && (
                  <div className="right-compatibility-change-health-empty">
                    <Check size={14} aria-hidden="true" />
                    <span>{copy.noMaintenanceImpact}</span>
                  </div>
                )}
              {healthDelta.introducedIssues.length > 0 && (
                <div className="right-compatibility-change-health-group">
                  <p>{copy.introducedMaintenance}</p>
                  {healthDelta.introducedIssues.map((issue) =>
                    renderHealthIssue(issue, "introduced")
                  )}
                </div>
              )}
              {healthDelta.resolvedIssues.length > 0 && (
                <div className="right-compatibility-change-health-group">
                  <p>{copy.resolvedMaintenance}</p>
                  {healthDelta.resolvedIssues.map((issue) =>
                    renderHealthIssue(issue, "resolved")
                  )}
                </div>
              )}
            </div>
          )}

          {candidate.state === "blocked" || !candidate.markdown ? (
            <p className="right-compatibility-inline-error">
              {copy.logBlocked}
            </p>
          ) : (
            <div className="right-compatibility-index-preview">
              {candidate.currentMarkdown && (
                <div className="right-compatibility-index-preview-tabs">
                  <button
                    className={previewSource === "current" ? "active" : ""}
                    type="button"
                    aria-pressed={previewSource === "current"}
                    onClick={() => setPreviewSource("current")}
                  >
                    {copy.currentLog}
                  </button>
                  <button
                    className={previewSource === "candidate" ? "active" : ""}
                    type="button"
                    aria-pressed={previewSource === "candidate"}
                    onClick={() => setPreviewSource("candidate")}
                  >
                    {copy.generatedLog}
                  </button>
                </div>
              )}
              {!candidate.currentMarkdown && (
                <p className="right-compatibility-index-preview-label">
                  {copy.generatedLog}
                </p>
              )}
              <pre>
                {previewSource === "current" && candidate.currentMarkdown
                  ? candidate.currentMarkdown
                  : candidate.markdown}
              </pre>
              <div className="right-compatibility-index-action">
                <button type="button" onClick={materialize}>
                  {candidate.state === "missing"
                    ? copy.createLog
                    : copy.updateLog}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {applyFailed && (
        <p className="right-compatibility-inline-error">{copy.planChanged}</p>
      )}
    </section>
  );
}
