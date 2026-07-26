import type {
  WorkspaceKnowledgeHealthIssue,
  WorkspaceKnowledgeHealthIssueCode,
  WorkspaceKnowledgeHealthReport,
} from "@tabula-md/tabula";
import {
  CircleAlert,
  CircleCheck,
  FileText,
  Info,
} from "lucide-react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";

type RightPanelKnowledgeHealthProps = {
  activeFileId: string;
  copy: KnowledgeCompatibilityCopy;
  report: WorkspaceKnowledgeHealthReport;
  onSelectIssue: (issue: WorkspaceKnowledgeHealthIssue) => void;
  omitCodes?: ReadonlySet<WorkspaceKnowledgeHealthIssueCode>;
};

function HealthIssueSection({
  activeFileId,
  copy,
  issues,
  label,
  onSelectIssue,
}: {
  activeFileId: string;
  copy: KnowledgeCompatibilityCopy;
  issues: readonly WorkspaceKnowledgeHealthIssue[];
  label: string;
  onSelectIssue: (issue: WorkspaceKnowledgeHealthIssue) => void;
}) {
  if (issues.length === 0) return null;
  return (
    <section className="right-compatibility-issue-section" aria-label={label}>
      <h3 className="right-compatibility-section-title">
        <span>{label}</span>
        <span>{issues.length}</span>
      </h3>
      <div className="right-compatibility-issue-list">
        {issues.map((issue, index) => {
          const isActive = issue.documentId === activeFileId;
          const IssueIcon = issue.severity === "attention" ? CircleAlert : Info;
          return (
            <div
              className={`right-compatibility-issue-item ${isActive ? "active" : ""}`.trim()}
              key={`${issue.documentId}:${issue.code}:${issue.value ?? ""}:${index}`}
            >
              <button
                className={`right-compatibility-issue-row health-${issue.severity}`}
                type="button"
                aria-label={copy.openDocument(issue.path)}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelectIssue(issue)}
              >
                <IssueIcon size={15} aria-hidden="true" />
                <span className="right-compatibility-issue-text">
                  <span className="right-compatibility-issue-title">
                    {copy.healthIssue(issue)}
                  </span>
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

export function RightPanelKnowledgeHealth({
  activeFileId,
  copy,
  report,
  onSelectIssue,
  omitCodes,
}: RightPanelKnowledgeHealthProps) {
  const visibleIssues = report.issues.filter((issue) => !omitCodes?.has(issue.code));
  const attentionIssues = visibleIssues.filter((issue) => issue.severity === "attention");
  const noticeIssues = visibleIssues.filter((issue) => issue.severity === "notice");
  const isHealthy = visibleIssues.length === 0;

  return (
    <section className="right-knowledge-health" aria-labelledby="right-knowledge-health-title">
      <div className="right-compatibility-section-copy">
        <h3 id="right-knowledge-health-title">
          <span>{copy.healthTitle}</span>
          <span>{visibleIssues.length}</span>
        </h3>
        <p>{copy.healthDescription}</p>
      </div>
      <div
        className={`right-knowledge-health-status ${isHealthy ? "healthy" : ""}`.trim()}
        role="status"
      >
        {isHealthy
          ? <CircleCheck size={16} aria-hidden="true" />
          : <CircleAlert size={16} aria-hidden="true" />}
        <span>
          {isHealthy
            ? copy.healthHealthy
            : [
                attentionIssues.length > 0
                  ? copy.healthAttention(attentionIssues.length)
                  : "",
                noticeIssues.length > 0
                  ? copy.healthNotices(noticeIssues.length)
                  : "",
              ].filter(Boolean).join(" · ")}
        </span>
      </div>
      <HealthIssueSection
        activeFileId={activeFileId}
        copy={copy}
        issues={attentionIssues}
        label={copy.healthAttentionSection}
        onSelectIssue={onSelectIssue}
      />
      <HealthIssueSection
        activeFileId={activeFileId}
        copy={copy}
        issues={noticeIssues}
        label={copy.healthNoticeSection}
        onSelectIssue={onSelectIssue}
      />
    </section>
  );
}
