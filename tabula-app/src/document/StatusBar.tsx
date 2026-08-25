import {
  ChartNoAxesColumn,
  Check,
  Cloud,
  FolderSync,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PopoverAnchor, PopoverContent, PopoverRoot } from "../ui/Popover";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import type { FileViewMode } from "../workspace/workspaceStorage";
import type { WorkspaceContextSummaryViewModel } from "../workspace/workspaceContextSummary";
import { getWorkspaceStatusIndicator } from "../workspace/workspaceStatusIndicator";

interface StatusBarProps {
  activeFileTitle: string;
  activeViewMode: FileViewMode;
  isLive: boolean;
  language: WorkspaceLanguage;
  saveRevision: number;
  approximateTokenCount: number;
  wordCount: number;
  characterCount: number;
  cursorPositionLabel: string;
  selectedCharacterCount: number;
  selectedLineCount: number;
  workspaceContextSummary: WorkspaceContextSummaryViewModel;
  onOpenWorkspaceMenu: () => void;
}

export function StatusBar({
  activeFileTitle,
  activeViewMode,
  isLive,
  language,
  saveRevision,
  approximateTokenCount,
  wordCount,
  characterCount,
  cursorPositionLabel,
  selectedCharacterCount,
  selectedLineCount,
  workspaceContextSummary,
  onOpenWorkspaceMenu,
}: StatusBarProps) {
  const copy = getWorkspaceChromeCopy(language).statusBar;
  const workspaceStatus = getWorkspaceStatusIndicator(workspaceContextSummary);
  const cursorLabel =
    selectedCharacterCount > 0
      ? `${cursorPositionLabel} (${
          selectedLineCount > 1 ? `${selectedLineCount} ${copy.lines}, ` : ""
        }${selectedCharacterCount} ${
          selectedCharacterCount === 1 ? copy.character : copy.characters
        })`
      : cursorPositionLabel;
  const formatCount = (count: number) => count.toLocaleString(language);
  const documentMetricsLabel = [
    copy.statistics,
    `${formatCount(wordCount)} ${copy.words}`,
    `${formatCount(characterCount)} ${copy.characters}`,
    `~${formatCount(approximateTokenCount)} ${copy.tokens}`,
  ].join(": ");
  const showCursorPosition = activeViewMode !== "preview" || selectedCharacterCount > 0;
  const [showDocumentMetrics, setShowDocumentMetrics] = useState(false);
  const documentMetricsCloseTimerRef = useRef<number | null>(null);

  const clearDocumentMetricsCloseTimer = () => {
    if (documentMetricsCloseTimerRef.current !== null) {
      window.clearTimeout(documentMetricsCloseTimerRef.current);
      documentMetricsCloseTimerRef.current = null;
    }
  };
  const openDocumentMetrics = () => {
    clearDocumentMetricsCloseTimer();
    setShowDocumentMetrics(true);
  };
  const closeDocumentMetricsSoon = () => {
    clearDocumentMetricsCloseTimer();
    documentMetricsCloseTimerRef.current = window.setTimeout(() => {
      setShowDocumentMetrics(false);
      documentMetricsCloseTimerRef.current = null;
    }, 100);
  };

  useEffect(() => () => clearDocumentMetricsCloseTimer(), []);

  const showWorkspaceStatus = isLive || saveRevision > 0 || workspaceStatus.tone !== "quiet";
  const showWorkspaceStatusLabel = workspaceStatus.tone !== "quiet";
  const workspaceStatusAriaLabel =
    workspaceStatus.tone === "quiet" && workspaceStatus.kind === "browser"
      ? copy.savedLocally
      : workspaceStatus.description;
  const WorkspaceStatusIcon = workspaceStatus.tone === "attention"
    ? TriangleAlert
    : workspaceStatus.tone === "working"
      ? LoaderCircle
      : workspaceStatus.kind === "collaboration"
        ? Cloud
        : workspaceStatus.kind === "folder"
          ? FolderSync
          : Check;

  return (
    <footer
      className="file-status-bar"
      aria-label={copy.statusFor(activeFileTitle)}
    >
      <div className="status-bar-right">
        {showWorkspaceStatus && (
          <button
            className={`status-save-state ${workspaceStatus.tone}`}
            type="button"
            aria-label={workspaceStatusAriaLabel}
            aria-live="polite"
            data-tooltip={showWorkspaceStatusLabel ? undefined : workspaceStatus.description}
            onClick={onOpenWorkspaceMenu}
          >
            <WorkspaceStatusIcon
              className={workspaceStatus.tone === "working" ? "status-save-state-spinner" : undefined}
              size={14}
              aria-hidden="true"
            />
            {showWorkspaceStatusLabel && <span>{workspaceStatus.label}</span>}
          </button>
        )}
        <PopoverRoot open={showDocumentMetrics} onOpenChange={setShowDocumentMetrics}>
          <PopoverAnchor asChild>
            <button
              className="status-document-metrics-trigger"
              type="button"
              aria-label={documentMetricsLabel}
              data-tooltip={documentMetricsLabel}
              aria-expanded={showDocumentMetrics}
              aria-haspopup="dialog"
              onBlur={closeDocumentMetricsSoon}
              onClick={() => {
                clearDocumentMetricsCloseTimer();
                setShowDocumentMetrics(false);
              }}
              onFocus={openDocumentMetrics}
              onMouseEnter={openDocumentMetrics}
              onMouseLeave={closeDocumentMetricsSoon}
            >
              <ChartNoAxesColumn size={15} aria-hidden="true" />
            </button>
          </PopoverAnchor>
          <PopoverContent
            className="status-document-metrics-popover"
            side="top"
            sideOffset={8}
            role="dialog"
            aria-label={copy.statistics}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onMouseEnter={openDocumentMetrics}
            onMouseLeave={closeDocumentMetricsSoon}
          >
            <table className="status-document-metrics-table">
              <tbody>
                <tr>
                  <td>{formatCount(wordCount)}</td>
                  <th scope="row">{copy.words}</th>
                </tr>
                <tr>
                  <td>{formatCount(characterCount)}</td>
                  <th scope="row">{copy.characters}</th>
                </tr>
                <tr>
                  <td>~{formatCount(approximateTokenCount)}</td>
                  <th scope="row">{copy.tokens}</th>
                </tr>
              </tbody>
            </table>
          </PopoverContent>
        </PopoverRoot>
        {showCursorPosition && (
          <span className="status-cursor-position">{cursorLabel}</span>
        )}
      </div>
    </footer>
  );
}
