import { FileOutput, Link } from "lucide-react";
import type { ShareViewModel } from "@tabula-md/tabula";
import type { JsonShareController } from "./useJsonShareController";
import { useId } from "react";
import type { WorkspaceShareCopy } from "../workspace/workspaceLocale";
import { ShareModeHeader } from "./ShareModeHeader";

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
      <ShareModeHeader
        description={copy.shareable.description}
        descriptionId={linkDescriptionId}
        headingLevel={3}
        icon={<FileOutput size={18} />}
        title={copy.shareable.title}
      />
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
    </>
  );
}
