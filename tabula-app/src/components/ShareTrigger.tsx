import { Share2 } from "lucide-react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceMenuCopy } from "../workspaceLocale";

type ShareTriggerProps = {
  isLive: boolean;
  language: WorkspaceLanguage;
  shareOpen: boolean;
  onToggleShare: () => void;
};

export function ShareTrigger({
  isLive,
  language,
  shareOpen,
  onToggleShare,
}: ShareTriggerProps) {
  const copy = getWorkspaceMenuCopy(language).share;

  return (
    <div className="share-wrap">
      <button
        className={`share-button share-trigger ${shareOpen ? "active" : ""} ${isLive ? "live" : ""}`}
        type="button"
        aria-label={copy.modalTitle}
        title={isLive ? `${copy.trigger}: live collaboration active` : copy.trigger}
        aria-expanded={shareOpen}
        onClick={onToggleShare}
      >
        <Share2 size={15} />
        {isLive ? <span className="share-live-dot" aria-hidden="true" /> : null}
        <span className="share-label-visible">{copy.trigger}</span>
      </button>
    </div>
  );
}
