import { Share2 } from "lucide-react";
import { useEffect } from "react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceMenuCopy } from "../workspaceLocale";
import type { ConnectionStatus } from "../collaboration/liveCollaboration";
import { preloadCollaborationStart } from "../collaboration/preloadCollaboration";
import {
  resolveTabulaJsonShareServiceUrl,
  resolveTabulaRoomServiceUrl,
} from "../serviceConfig";

const preconnectService = (serviceUrl: string | null) => {
  if (!serviceUrl) return;
  try {
    const origin = new URL(serviceUrl).origin;
    if (document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "anonymous";
    document.head.append(link);
  } catch {
    // Invalid deployment configuration is reported when the user starts sharing.
  }
};

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
  const prepareCollaboration = () => {
    preconnectService(resolveTabulaRoomServiceUrl({ location: window.location }));
    preconnectService(resolveTabulaJsonShareServiceUrl({ location: window.location }));
    void preloadCollaborationStart().catch(() => undefined);
  };

  useEffect(() => {
    const timer = window.setTimeout(prepareCollaboration, 400);
    return () => window.clearTimeout(timer);
  }, []);

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
        aria-expanded={shareOpen}
        onFocus={prepareCollaboration}
        onPointerDown={prepareCollaboration}
        onPointerEnter={prepareCollaboration}
        onClick={onToggleShare}
      >
        <Share2 size={16} />
        {isLive ? <span className="share-live-dot" aria-hidden="true" /> : null}
        <span className="share-label-visible">{copy.trigger}</span>
      </button>
    </div>
  );
}
