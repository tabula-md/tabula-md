import {
  Check,
  Copy,
  Download,
  FolderArchive,
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
  workspaceDocumentCount: number;
  onCopyShareableLink: () => void;
  onDownloadProjectArchive: () => void;
  onExportToJsonLink: () => void;
};

export function ShareExportPanel({
  copy,
  exportLinkCopied,
  jsonShare,
  shareView,
  workspaceDocumentCount,
  onCopyShareableLink,
  onDownloadProjectArchive,
  onExportToJsonLink,
}: ShareExportPanelProps) {
  const linkDescriptionId = useId();
  const linkDisabledReasonId = useId();
  const archiveDescriptionId = useId();
  const exportLinkLabelId = useId();
  const exportLinkMetadataId = useId();
  const linkDescribedBy = shareView.shareable.disabledReason
    ? `${linkDescriptionId} ${linkDisabledReasonId}`
    : linkDescriptionId;

  return (
    <>
      <div className="share-panel-heading">
        <span className="share-modal-option-icon">
          <Download size={18} />
        </span>
        <div>
          <h3>{copy.exportPanel.title}</h3>
          <p>{copy.exportPanel.description}</p>
        </div>
      </div>
      <div className="share-export-options" aria-label={copy.exportPanel.title}>
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
          <p className="share-modal-muted" id={linkDescriptionId}>
            {copy.shareable.description}
          </p>
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
        <div className="share-export-option">
          <button
            className="share-modal-secondary"
            type="button"
            disabled={workspaceDocumentCount === 0}
            aria-describedby={archiveDescriptionId}
            onClick={onDownloadProjectArchive}
          >
            <FolderArchive size={16} />
            <span>{copy.exportPanel.projectArchiveTitle}</span>
          </button>
          <p className="share-modal-muted" id={archiveDescriptionId}>
            {copy.exportPanel.projectArchiveDescription}
          </p>
        </div>
      </div>
    </>
  );
}
