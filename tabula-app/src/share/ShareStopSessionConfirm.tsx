import type { WorkspaceShareCopy } from "../workspace/workspaceLocale";

type ShareStopSessionConfirmProps = {
  copy: WorkspaceShareCopy;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ShareStopSessionConfirm({
  copy,
  onCancel,
  onConfirm,
}: ShareStopSessionConfirmProps) {
  return (
    <section className="share-stop-confirm" aria-labelledby="share-stop-session-title">
      <header className="share-modal-header compact">
        <h2 id="share-stop-session-title">{copy.live.stopConfirmTitle}</h2>
        <p>{copy.live.stopConfirmDescription}</p>
      </header>
      <div className="share-modal-actions share-stop-confirm-actions">
        <button
          type="button"
          className="share-modal-secondary"
          data-modal-initial-focus
          onClick={onCancel}
        >
          {copy.live.cancelStop}
        </button>
        <button type="button" className="share-modal-danger" onClick={onConfirm}>
          {copy.live.confirmStop}
        </button>
      </div>
    </section>
  );
}
