import { UsersRound } from "lucide-react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";

export type LiveRoomLoadingSurfaceProps = {
  language: WorkspaceLanguage;
};

export function LiveRoomLoadingSurface({
  language,
}: LiveRoomLoadingSurfaceProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  return (
    <section className="workspace empty-workspace live-room-loading-surface" aria-label={copy.roomOpeningLabel}>
      <div className="empty-file-center live-room-loading-center">
        <UsersRound size={18} aria-hidden="true" />
        <p>{copy.roomOpening}</p>
      </div>
    </section>
  );
}
