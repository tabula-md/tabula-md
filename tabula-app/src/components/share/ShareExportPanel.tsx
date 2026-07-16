import {
  Check,
  Copy,
  Link,
  RefreshCw,
} from "lucide-react";
import type { JsonShareController } from "../../hooks/useJsonShareController";
import { useId } from "react";
import type { ShareViewModel } from "../../share";
import type { WorkspaceShareCopy } from "../../workspaceLocale";

type ShareExportPanelProps = {
  copy: WorkspaceShareCopy;
  exportLinkCopied: boolean;
  jsonShare: JsonShareController;
  shareView: ShareViewModel;
  onCopyShareableLink: () => void;
  onExportToJsonLink: () => void;
};

export function ShareExportPanel({
  copy,
  exportLinkCopied,
  jsonShare,
  shareView,
  onCopyShareableLink,
  onExportToJsonLink,
}: ShareExportPanelProps) {
  const linkDescriptionId = useId();
  const linkDisabledReasonId = useId();
  const exportLinkLabelId = useId();
  const exportLinkMetadataId = useId();
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
          {!shareView.shareable.hasLink ? (
            <button
              className="share-modal-primary"
              type="button"
              onClick={onExportToJsonLink}
              disabled={!jsonShare.canExport}
              aria-describedby={linkDescribedBy}
              title={shareView.shareable.disabledReason || undefined}
            >
              {jsonShare.exporting ? <RefreshCw size={16} /> : <Link size={16} />}
              <span>{shareView.shareable.primaryLabel}</span>
            </button>
          ) : null}
          {shareView.shareable.hasLink && jsonShare.url ? (
            <div className="share-copy-box">
              <div className="share-modal-field">
                <span className="share-modal-field-label" id={exportLinkLabelId}>
                  {copy.shareable.linkLabel}
                </span>
                <div className="share-modal-link-row">
                  <div
                    className="share-link-display"
                    aria-labelledby={exportLinkLabelId}
                    title={jsonShare.url}
                  >
                    <span>{jsonShare.urlPreview}</span>
                  </div>
                  <button
                    type="button"
                    aria-describedby={exportLinkMetadataId}
                    onClick={onCopyShareableLink}
                  >
                    {exportLinkCopied ? <Check size={18} /> : <Copy size={18} />}
                    <span>
                      {exportLinkCopied ? copy.live.copied : copy.live.copyLink}
                    </span>
                  </button>
                </div>
                <p className="share-modal-muted" id={exportLinkMetadataId}>
                  {jsonShare.documentCount} {jsonShare.documentCount === 1 ? "document" : "documents"}
                  {jsonShare.expiresAt
                    ? ` · Expires ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(jsonShare.expiresAt))}`
                    : ""}
                </p>
              </div>
            </div>
          ) : null}
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
