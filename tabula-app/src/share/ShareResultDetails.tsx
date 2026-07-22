import { Check, Copy, LockKeyhole } from "lucide-react";
import { type ReactNode, useId } from "react";
import type { WorkspaceShareCopy } from "../workspace/workspaceLocale";

type ShareResultDetailsProps = {
  children?: ReactNode;
  copied: boolean;
  copy: WorkspaceShareCopy;
  documentCount: number;
  link?: {
    canCopy: boolean;
    display: string;
    disabledTitle?: string;
    title: string;
  };
  metadata: string;
  onCopyLink: () => void;
  preparingText?: string;
};

export function ShareResultDetails({
  children,
  copied,
  copy,
  documentCount,
  link,
  metadata,
  onCopyLink,
  preparingText,
}: ShareResultDetailsProps) {
  const linkLabelId = useId();

  return (
    <div className="share-result-details">
      <div className="share-result-main">
        <div className="share-result-context">
          <p className="share-result-scope">{copy.workspaceSummary(documentCount)}</p>
          <p className="share-result-meta">{metadata}</p>
        </div>

        {link ? (
          <div className="share-modal-field share-result-link-field">
            <span className="share-modal-field-label" id={linkLabelId}>
              {copy.shareLinkLabel}
            </span>
            <div className="share-modal-link-row">
              <div
                className="share-link-display"
                aria-labelledby={linkLabelId}
                title={link.title}
              >
                <span>{link.display}</span>
              </div>
              <button
                type="button"
                onClick={onCopyLink}
                disabled={!link.canCopy}
                title={link.canCopy ? undefined : link.disabledTitle}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span>{copied ? copy.live.copied : copy.live.copyLink}</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="share-export-preparing" role="status" aria-live="polite">
            {preparingText}
          </p>
        )}

        {children}
      </div>

      <div className="share-modal-note">
        <LockKeyhole size={15} aria-hidden="true" />
        <p>{copy.chooserSecurityDescription}</p>
      </div>
    </div>
  );
}
