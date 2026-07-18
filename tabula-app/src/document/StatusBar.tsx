import { Check, TriangleAlert } from "lucide-react";
import { getStatusBarSaveState } from "@tabula-md/tabula";
import { useEffect, useState } from "react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import type { FileViewMode } from "../workspaceStorage";

interface StatusBarProps {
  activeFileTitle: string;
  activeViewMode: FileViewMode;
  isLive: boolean;
  language: WorkspaceLanguage;
  saveRevision: number;
  statusLabel: string;
  wordCount: number;
  cursorPositionLabel: string;
  selectedCharacterCount: number;
  selectedLineCount: number;
}

export function StatusBar({
  activeFileTitle,
  activeViewMode,
  isLive,
  language,
  saveRevision,
  statusLabel,
  wordCount,
  cursorPositionLabel,
  selectedCharacterCount,
  selectedLineCount,
}: StatusBarProps) {
  const copy = getWorkspaceChromeCopy(language).statusBar;
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
  const showCursorPosition = activeViewMode !== "preview" || selectedCharacterCount > 0;
  const [showLocalSaveLabel, setShowLocalSaveLabel] = useState(false);

  useEffect(() => {
    if (isLive || saveRevision === 0) {
      setShowLocalSaveLabel(false);
      return;
    }

    setShowLocalSaveLabel(true);
    const timer = window.setTimeout(() => setShowLocalSaveLabel(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [isLive, saveRevision]);

  const showSaveState = isLive ? saveState.visible : saveRevision > 0;
  const showSaveLabel = isLive || showLocalSaveLabel;

  return (
    <footer
      className="file-status-bar"
      aria-label={copy.statusFor(activeFileTitle)}
    >
      <div className="status-bar-right">
        {showSaveState && (
          <span
            className={`status-save-state ${
              saveState.tone === "attention" ? "attention" : showSaveLabel ? "" : "quiet"
            }`}
            role="status"
            aria-label={saveState.label}
            data-tooltip={showSaveLabel ? undefined : saveState.label}
          >
            {saveState.tone === "attention" ? (
              <TriangleAlert size={14} aria-hidden="true" />
            ) : (
              <Check size={14} aria-hidden="true" />
            )}
            {showSaveLabel && <span>{saveState.label}</span>}
          </span>
        )}
        <span>{wordCountLabel}</span>
        {showCursorPosition && (
          <span className="status-cursor-position">{cursorLabel}</span>
        )}
      </div>
    </footer>
  );
}
