import { Check, MessageSquare } from "lucide-react";
import { getStatusBarSaveState } from "../statusBarViewModel";

type StatusBarProps = {
  activeFileTitle: string;
  isLive: boolean;
  statusLabel: string;
  wordCount: number;
  commentCount: number;
  cursorPositionLabel: string;
  selectedCharacterCount: number;
  selectedLineCount: number;
  onOpenComments: () => void;
};

export function StatusBar({
  activeFileTitle,
  isLive,
  statusLabel,
  wordCount,
  commentCount,
  cursorPositionLabel,
  selectedCharacterCount,
  selectedLineCount,
  onOpenComments,
}: StatusBarProps) {
  const hasComments = commentCount > 0;
  const saveState = getStatusBarSaveState({ isLive, statusLabel });
  const cursorLabel =
    selectedCharacterCount > 0
      ? `${cursorPositionLabel} (${selectedLineCount > 1 ? `${selectedLineCount} lines, ` : ""}${selectedCharacterCount} ${
          selectedCharacterCount === 1 ? "character" : "characters"
        })`
      : cursorPositionLabel;

  return (
    <footer className="file-status-bar" aria-label={`Status for ${activeFileTitle}`}>
      <div className="status-bar-right">
        {saveState.visible && (
          <span className="status-save-state">
            <Check size={13} />
            <span>{saveState.label}</span>
          </span>
        )}
        <span>{wordCount} words</span>
        <span className="status-cursor-position">{cursorLabel}</span>
        {hasComments && (
          <button className="status-comments-button" type="button" onClick={onOpenComments}>
            <MessageSquare size={13} />
            <span>
              {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </span>
          </button>
        )}
      </div>
    </footer>
  );
}
