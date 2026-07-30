import { X } from "lucide-react";
import type { ReactNode } from "react";
import { ModalSurface } from "../ui/ModalSurface";
import type { KnowledgePanelCopy } from "../workspace/knowledgePanelLocale";

export function KnowledgeReviewDialog({
  children,
  copy,
  changeCount,
  maintenanceCount,
  requiredCount,
  verificationCount,
  onClose,
}: {
  children: ReactNode;
  copy: KnowledgePanelCopy;
  changeCount?: number;
  maintenanceCount: number;
  requiredCount: number;
  verificationCount: number;
  onClose: () => void;
}) {
  return (
    <ModalSurface
      ariaLabelledBy="knowledge-review-title"
      className="knowledge-review-modal"
      layerClassName="knowledge-review-modal-layer"
      onClose={onClose}
    >
      <header className="knowledge-review-header">
        <div>
          <h2 id="knowledge-review-title">{copy.reviewTitle}</h2>
          <p>{copy.reviewDescription}</p>
        </div>
        <button
          type="button"
          aria-label={copy.closeReview}
          data-tooltip={copy.closeReview}
          data-modal-initial-focus
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="knowledge-review-summary" role="status">
        <span>
          <strong>{requiredCount}</strong>
          {copy.required}
        </span>
        <span>
          <strong>{verificationCount}</strong>
          {copy.needsReview}
        </span>
        <span>
          <strong>{maintenanceCount}</strong>
          {copy.maintenance}
        </span>
        <span>
          <strong>{changeCount ?? "—"}</strong>
          {copy.changes}
        </span>
      </div>

      <div className="knowledge-review-body">{children}</div>
    </ModalSurface>
  );
}
