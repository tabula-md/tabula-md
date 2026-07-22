import { FolderOpen, UsersRound } from "lucide-react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";

export type LiveRoomLoadingSurfaceProps = {
  language: WorkspaceLanguage;
  state?: "opening" | "unavailable" | "expired";
  onOpenLocalWorkspace?: () => void;
};

export function LiveRoomLoadingSurface({
  language,
  state = "opening",
  onOpenLocalWorkspace,
}: LiveRoomLoadingSurfaceProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  if (state === "expired") {
    return (
      <section className="workspace empty-workspace live-room-loading-surface" aria-label={copy.roomExpiredLabel}>
        <div className="empty-file-center live-room-loading-center live-room-unavailable-center">
          <p className="live-room-unavailable-title">{copy.roomExpiredTitle}</p>
          <p>{copy.roomExpiredDescription}</p>
          <div className="live-room-unavailable-actions">
            <button type="button" className="empty-file-action" onClick={onOpenLocalWorkspace}>
              <FolderOpen size={16} aria-hidden="true" />
              <span>{copy.openLocalWorkspace}</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (state === "unavailable") {
    return (
      <section className="workspace empty-workspace live-room-loading-surface" aria-label={copy.roomUnavailableLabel}>
        <div className="empty-file-center live-room-loading-center live-room-unavailable-center">
          <p className="live-room-unavailable-title">{copy.roomUnavailableTitle}</p>
          <p>{copy.roomUnavailableDescription}</p>
          <div className="live-room-unavailable-actions">
            <button type="button" className="empty-file-action" onClick={onOpenLocalWorkspace}>
              <FolderOpen size={16} aria-hidden="true" />
              <span>{copy.openLocalWorkspace}</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace empty-workspace live-room-loading-surface" aria-label={copy.roomOpeningLabel}>
      <div className="empty-file-center live-room-loading-center">
        <UsersRound size={18} aria-hidden="true" />
        <p>{copy.roomOpening}</p>
      </div>
    </section>
  );
}
