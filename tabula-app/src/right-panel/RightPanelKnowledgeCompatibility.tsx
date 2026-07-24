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
import { useEffect, useState, type FormEvent } from "react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";

type RightPanelKnowledgeCompatibilityProps = {
  copy: KnowledgeCompatibilityCopy;
  documentCount: number;
  report?: OkfCompatibilityReport;
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onSetActiveFileOkfType: (conceptType: string) => boolean;
};

type CompatibilityIssueSectionProps = {
  copy: KnowledgeCompatibilityCopy;
  issues: readonly OkfCompatibilityIssue[];
  label: string;
  severity: "error" | "warning";
  activeFileId: string;
  conceptTypeDraft: string;
  onConceptTypeDraftChange: (draft: string) => void;
  onSelectFile: (fileId: string) => void;
  onSetActiveFileOkfType: (conceptType: string) => boolean;
};

const conceptTypeIssueCodes = new Set<OkfCompatibilityIssue["code"]>([
  "concept_frontmatter_missing",
  "concept_type_missing",
  "concept_type_invalid",
]);

function CompatibilityIssueSection({
  copy,
  issues,
  label,
  severity,
  activeFileId,
  conceptTypeDraft,
  onConceptTypeDraftChange,
  onSelectFile,
  onSetActiveFileOkfType,
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
          const canSetConceptType = isActive && conceptTypeIssueCodes.has(issue.code);
          const submitConceptType = (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const type = conceptTypeDraft.trim();
            if (type && onSetActiveFileOkfType(type)) onConceptTypeDraftChange("");
          };
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
              {canSetConceptType && (
                <form className="right-compatibility-type-form" onSubmit={submitConceptType}>
                  <label>
                    <span>{copy.conceptTypeLabel}</span>
                    <input
                      type="text"
                      value={conceptTypeDraft}
                      placeholder={copy.conceptTypePlaceholder}
                      aria-label={copy.conceptTypeLabel}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => onConceptTypeDraftChange(event.target.value)}
                    />
                  </label>
                  <p>{copy.conceptTypeHelp}</p>
                  <button type="submit" disabled={!conceptTypeDraft.trim()}>
                    {issue.code === "concept_frontmatter_missing"
                      ? copy.addFrontmatterAndType
                      : copy.setConceptType}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RightPanelKnowledgeCompatibility({
  copy,
  documentCount,
  report,
  activeFileId,
  onSelectFile,
  onSetActiveFileOkfType,
}: RightPanelKnowledgeCompatibilityProps) {
  const [conceptTypeDraft, setConceptTypeDraft] = useState("");
  useEffect(() => setConceptTypeDraft(""), [activeFileId]);
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
        activeFileId={activeFileId}
        conceptTypeDraft={conceptTypeDraft}
        onConceptTypeDraftChange={setConceptTypeDraft}
        onSelectFile={onSelectFile}
        onSetActiveFileOkfType={onSetActiveFileOkfType}
      />
      <CompatibilityIssueSection
        copy={copy}
        issues={warningIssues}
        label={copy.warningSection}
        severity="warning"
        activeFileId={activeFileId}
        conceptTypeDraft={conceptTypeDraft}
        onConceptTypeDraftChange={setConceptTypeDraft}
        onSelectFile={onSelectFile}
        onSetActiveFileOkfType={onSetActiveFileOkfType}
      />

      <p className="right-compatibility-footnote">{copy.unchanged}</p>
    </div>
  );
}
