import { Link, LockKeyhole } from "lucide-react";
import type { ShareViewModel } from "@tabula-md/tabula";
import type { JsonShareController } from "./useJsonShareController";
import { useId } from "react";
import type { WorkspaceShareCopy } from "../workspace/workspaceLocale";

type ShareExportPanelProps = {
  copy: WorkspaceShareCopy;
  jsonShare: JsonShareController;
  shareView: ShareViewModel;
  onExportToJsonLink: () => void;
};

export function ShareExportPanel({
  copy,
  jsonShare,
  shareView,
  onExportToJsonLink,
}: ShareExportPanelProps) {
  const linkDescriptionId = useId();
  const linkDisabledReasonId = useId();
  const linkDescribedBy = shareView.shareable.disabledReason
    ? `${linkDescriptionId} ${linkDisabledReasonId}`
    : linkDescriptionId;

  return (
    <>
      <div className="share-panel-heading">
        <span className="share-modal-option-icon">
          <Link size={18} />
        </span>
        <div>
          <h3>{copy.shareable.title}</h3>
          <p id={linkDescriptionId}>{copy.shareable.description}</p>
        </div>
      </div>
      <div className="share-export-options" aria-label={copy.shareable.title}>
        <div className="share-export-option">
          <button
            className="share-modal-primary"
            type="button"
            onClick={onExportToJsonLink}
            disabled={!jsonShare.canExport}
            aria-describedby={linkDescribedBy}
            title={shareView.shareable.disabledReason || undefined}
          >
            <Link size={16} />
            <span>{copy.shareable.exportToLink}</span>
          </button>
          {shareView.shareable.disabledReason && (
            <p className="share-modal-muted" id={linkDisabledReasonId}>
              {shareView.shareable.disabledReason}
            </p>
          )}
        </div>
      </div>
      <div className="share-modal-note">
        <LockKeyhole size={15} aria-hidden="true" />
        <p>{copy.shareable.securityDescription}</p>
      </div>
    </>
  );
}
