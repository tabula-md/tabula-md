import { Share2 } from "lucide-react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceMenuCopy } from "../workspaceLocale";
import type { ConnectionStatus } from "../collaboration";

type ShareTriggerProps = {
  connectionStatus: ConnectionStatus;
  isLive: boolean;
  language: WorkspaceLanguage;
  shareOpen: boolean;
  onToggleShare: () => void;
};

export function ShareTrigger({
  connectionStatus,
  isLive,
  language,
  shareOpen,
  onToggleShare,
}: ShareTriggerProps) {
  const copy = getWorkspaceMenuCopy(language).share;
  const liveStatus = isLive
    ? connectionStatus === "connected"
      ? "connected"
      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
        ? "reconnecting"
        : "disconnected"
    : null;
  const statusLabel = liveStatus
    ? `${copy.trigger}: ${liveStatus === "connected" ? "live collaboration active" : liveStatus}`
    : copy.trigger;

  return (
    <div className="share-wrap">
      <button
        className={`share-button share-trigger ${shareOpen ? "active" : ""} ${liveStatus ? `live ${liveStatus}` : ""}`}
        type="button"
        aria-label={statusLabel}
        data-tooltip={statusLabel}
        aria-expanded={shareOpen}
        onClick={onToggleShare}
      >
        <Share2 size={16} />
        {isLive ? <span className="share-live-dot" aria-hidden="true" /> : null}
        <span className="share-label-visible">{copy.trigger}</span>
      </button>
    </div>
  );
}
