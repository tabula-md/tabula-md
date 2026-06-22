import { Check, MessageSquare, Redo2, Undo2 } from "lucide-react";

type StatusBarProps = {
  activeFileTitle: string;
  canUndo: boolean;
  canRedo: boolean;
  isLive: boolean;
  statusLabel: string;
  wordCount: number;
  commentCount: number;
  cursorPositionLabel: string;
  selectedCharacterCount: number;
  selectedLineCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onOpenComments: () => void;
};

export function StatusBar({
  activeFileTitle,
  canUndo,
  canRedo,
  isLive,
  statusLabel,
  wordCount,
  commentCount,
  cursorPositionLabel,
  selectedCharacterCount,
  selectedLineCount,
  onUndo,
  onRedo,
  onOpenComments,
}: StatusBarProps) {
  const hasComments = commentCount > 0;
  const saveLabel = isLive ? statusLabel : "Saved locally";
  const cursorLabel =
    selectedCharacterCount > 0
      ? `${cursorPositionLabel} (${selectedLineCount > 1 ? `${selectedLineCount} lines, ` : ""}${selectedCharacterCount} ${
          selectedCharacterCount === 1 ? "character" : "characters"
        })`
      : cursorPositionLabel;

  return (
    <footer className="file-status-bar" aria-label={`Status for ${activeFileTitle}`}>
      <div className="status-bar-left">
        <button className="status-icon-button" type="button" title="Undo" aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={15} />
        </button>
        <button className="status-icon-button" type="button" title="Redo" aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
          <Redo2 size={15} />
        </button>
      </div>

      <div className="status-bar-right">
        <span className="status-save-state">
          <Check size={13} />
          <span>{saveLabel}</span>
        </span>
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
