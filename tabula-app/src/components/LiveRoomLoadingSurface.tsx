import { FolderOpen, Link2, UsersRound } from "lucide-react";

export type LiveRoomLoadingSurfaceProps = {
  state?: "opening" | "unavailable";
  onOpenLocalWorkspace?: () => void;
  onRetry?: () => void;
};

export function LiveRoomLoadingSurface({
  state = "opening",
  onOpenLocalWorkspace,
  onRetry,
}: LiveRoomLoadingSurfaceProps) {
  if (state === "unavailable") {
    return (
      <section className="workspace empty-workspace live-room-loading-surface" aria-label="Live room unavailable">
        <div className="empty-file-center live-room-loading-center live-room-unavailable-center">
          <p className="live-room-unavailable-title">This live room can’t be opened.</p>
          <p>
            No saved workspace was found, and no participant is currently sharing it.
          </p>
          <div className="live-room-unavailable-actions">
            <button type="button" className="empty-file-action" onClick={onRetry}>
              <Link2 size={15} aria-hidden="true" />
              <span>Try again</span>
            </button>
            <button type="button" className="empty-file-action" onClick={onOpenLocalWorkspace}>
              <FolderOpen size={15} aria-hidden="true" />
              <span>Open local workspace</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace empty-workspace live-room-loading-surface" aria-label="Opening live room">
      <div className="empty-file-center live-room-loading-center">
        <UsersRound size={18} aria-hidden="true" />
        <p>Opening live room...</p>
      </div>
    </section>
  );
}
