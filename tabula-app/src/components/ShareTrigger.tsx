import { Share2 } from "lucide-react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceMenuCopy } from "../workspaceLocale";

type ShareTriggerProps = {
  activeFileTitle: string;
  language: WorkspaceLanguage;
  shareOpen: boolean;
  onToggleShare: () => void;
};

export function ShareTrigger({
  activeFileTitle,
  language,
  shareOpen,
  onToggleShare,
}: ShareTriggerProps) {
  const copy = getWorkspaceMenuCopy(language).share;
  const activeFileDisplayTitle = activeFileTitle.replace(/\.(?:md|markdown)$/i, "");
  const shareModalTitle = copy.modalTitle(activeFileDisplayTitle);

  return (
    <div className="share-wrap">
      <button
        className={`share-button share-trigger ${shareOpen ? "active" : ""}`}
        type="button"
        aria-label={shareModalTitle}
        title={copy.trigger}
        aria-expanded={shareOpen}
        onClick={onToggleShare}
      >
        <Share2 size={15} />
        <span className="share-label-visible">{copy.trigger}</span>
      </button>
    </div>
  );
}
