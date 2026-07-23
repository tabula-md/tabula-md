import { Check, Copy, LockKeyhole } from "lucide-react";
import { type ReactNode, useId } from "react";
import type { WorkspaceShareCopy } from "../workspace/workspaceLocale";

type ShareResultDetailsProps = {
  children?: ReactNode;
  copied: boolean;
  copy: WorkspaceShareCopy;
  link?: {
    canCopy: boolean;
    display: string;
    disabledTitle?: string;
  };
  linkActions?: ReactNode;
  metadata?: string;
  onCopyLink: () => void;
};

export function ShareResultDetails({
  children,
  copied,
  copy,
  link,
  linkActions,
  metadata,
  onCopyLink,
}: ShareResultDetailsProps) {
  const linkLabelId = useId();

  return (
    <div className="share-result-details">
      <div className="share-result-main">
        {link ? (
          <div className="share-modal-field share-result-link-field">
            <span className="share-modal-title-hidden" id={linkLabelId}>
              {copy.shareLinkLabel}
            </span>
            <div className="share-modal-link-row">
              <div
                className="share-link-display"
                aria-labelledby={linkLabelId}
              >
                <span>{link.display}</span>
              </div>
              <div className="share-link-actions">
                <button
                  type="button"
                  onClick={onCopyLink}
                  disabled={!link.canCopy}
                  title={link.canCopy ? undefined : link.disabledTitle}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copied ? copy.live.copied : copy.live.copyLink}</span>
                </button>
                {linkActions}
              </div>
            </div>
          </div>
        ) : null}

        {metadata ? <p className="share-result-meta">{metadata}</p> : null}

        {children}
      </div>

      <div className="share-result-footer">
        <div className="share-modal-note">
          <LockKeyhole size={15} aria-hidden="true" />
          <p>{copy.chooserSecurityDescription}</p>
        </div>
      </div>
    </div>
  );
}
