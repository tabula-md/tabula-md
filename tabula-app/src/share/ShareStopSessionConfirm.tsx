import type { WorkspaceShareCopy } from "../workspace/workspaceLocale";
import type { RoomExitLocalWorkspaceStrategy } from "../workspace/workspaceSessionTransition";

type ShareStopSessionConfirmProps = {
  copy: WorkspaceShareCopy;
  canChooseExitStrategy: boolean;
  exitStrategy: RoomExitLocalWorkspaceStrategy;
  onCancel: () => void;
  onConfirm: () => void;
  onExitStrategyChange: (strategy: RoomExitLocalWorkspaceStrategy) => void;
};

export function ShareStopSessionConfirm({
  copy,
  canChooseExitStrategy,
  exitStrategy,
  onCancel,
  onConfirm,
  onExitStrategyChange,
}: ShareStopSessionConfirmProps) {
  return (
    <section className="share-stop-confirm" aria-labelledby="share-stop-session-title">
      <header className="share-modal-header compact">
        <h2 id="share-stop-session-title">{copy.live.stopConfirmTitle}</h2>
        <p>
          {canChooseExitStrategy
            ? copy.live.stopJoinedConfirmDescription
            : copy.live.stopConfirmDescription}
        </p>
      </header>
      {canChooseExitStrategy && (
        <fieldset className="share-stop-exit-options">
          <legend>{copy.live.afterLeaving}</legend>
          <label>
            <input
              type="radio"
              name="room-exit-strategy"
              value="restore-local"
              checked={exitStrategy === "restore-local"}
              onChange={() => onExitStrategyChange("restore-local")}
            />
            <span>
              <strong>{copy.live.restoreLocalWorkspace}</strong>
              <small>{copy.live.restoreLocalWorkspaceDescription}</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="room-exit-strategy"
              value="adopt-room"
              checked={exitStrategy === "adopt-room"}
              onChange={() => onExitStrategyChange("adopt-room")}
            />
            <span>
              <strong>{copy.live.keepRoomCopy}</strong>
              <small>{copy.live.keepRoomCopyDescription}</small>
            </span>
          </label>
        </fieldset>
      )}
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
