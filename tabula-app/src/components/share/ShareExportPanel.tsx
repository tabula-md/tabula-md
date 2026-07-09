import {
  Check,
  Copy,
  Download,
  FolderArchive,
  Link,
  RefreshCw,
} from "lucide-react";
import type { JsonShareController } from "../../hooks/useJsonShareController";
import type { ShareViewModel } from "../../share";
import type { WorkspaceShareCopy } from "../../workspaceLocale";

type ShareExportPanelProps = {
  copy: WorkspaceShareCopy;
  exportLinkCopied: boolean;
  includedFileCount: number;
  includedFileIds: readonly string[];
  jsonShare: JsonShareController;
  shareView: ShareViewModel;
  onCopyShareableLink: () => void;
  onDownloadProjectArchive: (fileIds?: readonly string[]) => void;
  onExportToJsonLink: () => void;
};

export function ShareExportPanel({
  copy,
  exportLinkCopied,
  includedFileCount,
  includedFileIds,
  jsonShare,
  shareView,
  onCopyShareableLink,
  onDownloadProjectArchive,
  onExportToJsonLink,
}: ShareExportPanelProps) {
  return (
    <>
      <div className="share-panel-heading">
        <span className="share-modal-option-icon">
          <Download size={17} />
        </span>
        <div>
          <h3>{copy.exportPanel.title}</h3>
          <p>{copy.exportPanel.description}</p>
        </div>
      </div>
      <div className="share-modal-actions" aria-label={copy.exportPanel.title}>
        {!shareView.shareable.hasLink ? (
          <button
            className="share-modal-primary"
            type="button"
            onClick={onExportToJsonLink}
            disabled={!jsonShare.canExport}
            title={shareView.shareable.disabledReason || undefined}
          >
            {jsonShare.exporting ? <RefreshCw size={16} /> : <Link size={16} />}
            <span>{shareView.shareable.primaryLabel}</span>
          </button>
        ) : null}
        <button
          className="share-modal-secondary"
          type="button"
          disabled={includedFileCount === 0}
          onClick={() => onDownloadProjectArchive(includedFileIds)}
        >
          <FolderArchive size={16} />
          <span>{copy.exportPanel.projectArchiveTitle}</span>
        </button>
      </div>
      <p className="share-modal-muted">
        {copy.shareable.description}
      </p>
      <p className="share-modal-muted">
        {copy.exportPanel.projectArchiveDescription}
      </p>
      {shareView.shareable.hasLink && jsonShare.url ? (
        <div className="share-copy-box">
          <div className="share-modal-field">
            <label>{copy.shareable.linkLabel}</label>
            <div className="share-modal-link-row">
              <div
                className="share-link-display"
                aria-label={copy.shareable.linkLabel}
                title={jsonShare.url}
              >
                <span>{jsonShare.urlPreview}</span>
              </div>
              <button type="button" onClick={onCopyShareableLink}>
                {exportLinkCopied ? <Check size={17} /> : <Copy size={17} />}
                <span>
                  {exportLinkCopied ? copy.live.copied : copy.live.copyLink}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {shareView.shareable.disabledReason && (
        <p className="share-modal-muted">
          {shareView.shareable.disabledReason}
        </p>
      )}
    </>
  );
}
