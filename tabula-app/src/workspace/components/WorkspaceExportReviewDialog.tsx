import {
  CircleCheck,
  FileClock,
  FileWarning,
  Info,
  X,
} from "lucide-react";
import { ModalSurface } from "../../ui/ModalSurface";
import type { WorkspaceExportReview } from "../io/workspaceExportReviewModel";
import { getWorkspaceExportReviewCopy } from "../io/workspaceExportReviewLocale";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";

type WorkspaceExportReviewDialogProps = {
  language: WorkspaceLanguage;
  review: WorkspaceExportReview;
  onCancel: () => void;
  onExport: () => void;
  onReviewIssues: () => void;
};

export function WorkspaceExportReviewDialog({
  language,
  review,
  onCancel,
  onExport,
  onReviewIssues,
}: WorkspaceExportReviewDialogProps) {
  const copy = getWorkspaceExportReviewCopy(language);
  const compatibilityConcerns =
    review.requiredChangeCount + review.portabilityWarningCount;
  const healthConcerns = review.attentionCount + review.noticeCount;
  const hasUnloggedChanges = (review.changeCount ?? 0) > 0;
  const hasConcerns =
    compatibilityConcerns > 0 || healthConcerns > 0 || hasUnloggedChanges;
  const compatibilityDetail = [
    review.requiredChangeCount > 0
      ? copy.requiredChanges(review.requiredChangeCount)
      : "",
    review.portabilityWarningCount > 0
      ? copy.portabilityWarnings(review.portabilityWarningCount)
      : "",
  ].filter(Boolean).join(", ");

  return (
    <ModalSurface
      ariaLabelledBy="workspace-export-review-title"
      className="workspace-export-review-modal"
      onClose={onCancel}
    >
      <button
        className="share-modal-close"
        type="button"
        aria-label={copy.close}
        onClick={onCancel}
      >
        <X size={18} />
      </button>
      <header className="share-modal-header compact">
        <h2 id="workspace-export-review-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </header>

      <div className="workspace-export-review-list">
        <div className={`workspace-export-review-row ${compatibilityConcerns > 0 ? "attention" : "ready"}`}>
          {compatibilityConcerns > 0
            ? <FileWarning size={17} aria-hidden="true" />
            : <CircleCheck size={17} aria-hidden="true" />}
          <span>
            <strong>{copy.compatibility}</strong>
            <small>
              {compatibilityDetail || copy.compatible(review.standardVersion)}
            </small>
          </span>
        </div>
        <div className={`workspace-export-review-row ${healthConcerns > 0 ? "notice" : "ready"}`}>
          {healthConcerns > 0
            ? <Info size={17} aria-hidden="true" />
            : <CircleCheck size={17} aria-hidden="true" />}
          <span>
            <strong>{copy.health}</strong>
            <small>
              {healthConcerns > 0
                ? copy.healthSummary(review.attentionCount, review.noticeCount)
                : copy.healthy}
            </small>
          </span>
        </div>
        <div className={`workspace-export-review-row ${
          review.changeCount === undefined
            ? ""
            : hasUnloggedChanges
              ? "notice"
              : "ready"
        }`.trim()}>
          {hasUnloggedChanges
            ? <FileClock size={17} aria-hidden="true" />
            : review.changeCount === undefined
              ? <Info size={17} aria-hidden="true" />
              : <CircleCheck size={17} aria-hidden="true" />}
          <span>
            <strong>{copy.changes}</strong>
            <small>
              {review.changeCount === undefined
                ? copy.changesNotTracked
                : hasUnloggedChanges
                  ? copy.unloggedChanges(review.changeCount)
                  : copy.noUnloggedChanges}
            </small>
          </span>
        </div>
      </div>

      <div className="share-modal-actions workspace-export-review-actions">
        <button className="ui-modal-action secondary share-modal-secondary" type="button" onClick={onCancel}>
          {copy.cancel}
        </button>
        <button
          className="share-modal-secondary"
          type="button"
          {...(hasConcerns ? { "data-modal-initial-focus": true } : {})}
          onClick={onReviewIssues}
        >
          {copy.reviewIssues}
        </button>
        <button
          className="share-modal-primary"
          type="button"
          {...(!hasConcerns ? { "data-modal-initial-focus": true } : {})}
          onClick={onExport}
        >
          {hasConcerns ? copy.exportAnyway : copy.export}
        </button>
      </div>
    </ModalSurface>
  );
}
