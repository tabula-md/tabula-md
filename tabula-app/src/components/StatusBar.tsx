import { Check, MessageSquare } from "lucide-react";
import { getStatusBarSaveState } from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import type { FileViewMode } from "../workspaceStorage";

type StatusBarProps = {
  activeFileTitle: string;
  activeViewMode: FileViewMode;
  isLive: boolean;
  language: WorkspaceLanguage;
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
  activeViewMode,
  isLive,
  language,
  statusLabel,
  wordCount,
  commentCount,
  cursorPositionLabel,
  selectedCharacterCount,
  selectedLineCount,
  onOpenComments,
}: StatusBarProps) {
  const copy = getWorkspaceChromeCopy(language).statusBar;
  const hasComments = commentCount > 0;
  const saveState = getStatusBarSaveState({
    isLive,
    roomOfflineLabel: copy.roomOffline,
    savedLocallyLabel: copy.savedLocally,
    statusLabel,
  });
  const cursorLabel =
    selectedCharacterCount > 0
      ? `${cursorPositionLabel} (${
          selectedLineCount > 1 ? `${selectedLineCount} ${copy.lines}, ` : ""
        }${selectedCharacterCount} ${
          selectedCharacterCount === 1 ? copy.character : copy.characters
        })`
      : cursorPositionLabel;
  const wordCountLabel = `${wordCount} ${wordCount === 1 ? copy.word : copy.words}`;
  const commentCountLabel = `${commentCount} ${commentCount === 1 ? copy.comment : copy.comments}`;
  const showCursorPosition = activeViewMode !== "preview" || selectedCharacterCount > 0;

  return (
    <footer
      className="file-status-bar"
      aria-label={`Status for ${activeFileTitle}`}
    >
      <div className="status-bar-right">
        {saveState.visible && (
          <span className="status-save-state">
            <Check size={13} />
            <span>{saveState.label}</span>
          </span>
        )}
        <span>{wordCountLabel}</span>
        {showCursorPosition && (
          <span className="status-cursor-position">{cursorLabel}</span>
        )}
        {hasComments && (
          <button
            className="status-comments-button"
            type="button"
            onClick={onOpenComments}
          >
            <MessageSquare size={13} />
            <span>{commentCountLabel}</span>
          </button>
        )}
      </div>
    </footer>
  );
}
