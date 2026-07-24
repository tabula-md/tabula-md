import {
  OKF_TARGET_VERSION,
  type OkfCompatibilityIssue,
  type OkfCompatibilityReport,
} from "@tabula-md/tabula";
import {
  CircleAlert,
  CircleCheck,
  FileText,
  TriangleAlert,
} from "lucide-react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";

type RightPanelKnowledgeCompatibilityProps = {
  copy: KnowledgeCompatibilityCopy;
  documentCount: number;
  report?: OkfCompatibilityReport;
  onSelectFile: (fileId: string) => void;
};

type CompatibilityIssueSectionProps = {
  copy: KnowledgeCompatibilityCopy;
  issues: readonly OkfCompatibilityIssue[];
  label: string;
  severity: "error" | "warning";
  onSelectFile: (fileId: string) => void;
};

function CompatibilityIssueSection({
  copy,
  issues,
  label,
  severity,
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
        {issues.map((issue, index) => (
          <button
            key={`${issue.documentId}:${issue.code}:${issue.value ?? ""}:${index}`}
            className={`right-compatibility-issue-row ${severity}`}
            type="button"
            aria-label={copy.openDocument(issue.path)}
            onClick={() => onSelectFile(issue.documentId)}
          >
            <Icon size={15} aria-hidden="true" />
            <span className="right-compatibility-issue-text">
              <span className="right-compatibility-issue-title">{copy.issue(issue)}</span>
              <span className="right-compatibility-issue-path">{issue.path}</span>
            </span>
            <FileText size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

export function RightPanelKnowledgeCompatibility({
  copy,
  documentCount,
  report,
  onSelectFile,
}: RightPanelKnowledgeCompatibilityProps) {
  const version = report?.targetVersion ?? OKF_TARGET_VERSION;
  const requiredIssues = report?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warningIssues = report?.issues.filter((issue) => issue.severity === "warning") ?? [];
  const statusTone = !report || documentCount === 0
    ? "neutral"
    : report.errorCount > 0
      ? "error"
      : "success";
  const statusTitle = !report
    ? copy.unavailable
    : documentCount === 0
      ? copy.noDocuments
      : report.errorCount > 0
        ? copy.requiredChanges(report.errorCount)
        : copy.compatible(version);
  const StatusIcon = statusTone === "error"
    ? CircleAlert
    : statusTone === "success"
      ? CircleCheck
      : TriangleAlert;

  return (
    <div className="right-compatibility-scroll">
      <header className="right-compatibility-header">
        <div className="right-compatibility-heading-row">
          <h2>{copy.title}</h2>
          <span className="right-compatibility-standard">OKF {version}</span>
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

      <CompatibilityIssueSection
        copy={copy}
        issues={requiredIssues}
        label={copy.requiredSection}
        severity="error"
        onSelectFile={onSelectFile}
      />
      <CompatibilityIssueSection
        copy={copy}
        issues={warningIssues}
        label={copy.warningSection}
        severity="warning"
        onSelectFile={onSelectFile}
      />

      <p className="right-compatibility-footnote">{copy.unchanged}</p>
    </div>
  );
}
