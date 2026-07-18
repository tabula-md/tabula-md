import { Check, Copy, Link, LockKeyhole } from "lucide-react";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceShareCopy } from "../workspaceLocale";

type ShareExportResultProps = {
  copy: WorkspaceShareCopy;
  exportLinkCopied: boolean;
  jsonShare: JsonShareController;
  onCopyShareableLink: () => void;
};

export function ShareExportResult({
  copy,
  exportLinkCopied,
  jsonShare,
  onCopyShareableLink,
}: ShareExportResultProps) {
  return (
    <section className="share-export-result" aria-labelledby="share-export-result-title">
      <header className="share-modal-header compact">
        <span className="share-modal-option-icon" aria-hidden="true">
          <Link size={18} />
        </span>
        <div>
          <h2 id="share-export-result-title">{copy.shareable.title}</h2>
          <p>{copy.shareable.description}</p>
        </div>
      </header>

      {jsonShare.url ? (
        <div className="share-copy-box">
          <div className="share-modal-field">
            <span className="share-modal-field-label" id="share-export-link-label">
              {copy.shareable.linkLabel}
            </span>
            <div className="share-modal-link-row">
              <div
                className="share-link-display"
                aria-labelledby="share-export-link-label"
                title={jsonShare.url}
              >
                <span>{jsonShare.urlPreview}</span>
              </div>
              <button type="button" onClick={onCopyShareableLink}>
                {exportLinkCopied ? <Check size={18} /> : <Copy size={18} />}
                <span>{exportLinkCopied ? copy.live.copied : copy.live.copyLink}</span>
              </button>
            </div>
            <p className="share-modal-muted">
              {jsonShare.documentCount}{" "}
              {jsonShare.documentCount === 1 ? "document" : "documents"}
              {jsonShare.expiresAt
                ? ` · Expires ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(jsonShare.expiresAt))}`
                : ""}
            </p>
          </div>
        </div>
      ) : (
        <p className="share-export-preparing" role="status" aria-live="polite">
          {copy.shareable.preparing}
        </p>
      )}

      <div className="share-modal-note">
        <LockKeyhole size={15} aria-hidden="true" />
        <p>{copy.shareable.securityDescription}</p>
      </div>
    </section>
  );
}
