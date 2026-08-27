import type { ReactNode } from "react";
import {
  FolderArchive,
  FolderInput,
  FolderSync,
  RefreshCw,
  Save,
  Trash2,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceMenuCopy } from "../workspaceLocale";
import type { WorkspaceContextSummaryViewModel } from "../workspaceContextSummary";
import { getWorkspaceStatusIndicator } from "../workspaceStatusIndicator";

function MenuRow({
  children,
  className = "",
  danger = false,
  icon,
  onClick,
  pressed,
  trailing,
}: {
  children: ReactNode;
  className?: string;
  danger?: boolean;
  icon: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      className={`workspace-menu-row${danger ? " danger" : ""} ${className}`.trim()}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
      {trailing}
    </button>
  );
}

export type WorkspaceMenuProps = {
  isOpen: boolean;
  language: WorkspaceLanguage;
  onImportWorkspace?: () => void;
  onOpenLiveWorkspace?: () => void;
  onSaveLiveWorkspace?: () => void;
  onReviewLiveFolderConflict?: () => void;
  onDisconnectLiveWorkspace?: () => void;
  liveFolderAutoSave?: boolean;
  onToggleLiveFolderAutoSave?: () => void;
  collaborationActive?: boolean;
  onRetryCollaboration?: () => void;
  onExportWorkspace?: () => void;
  onClearWorkspace?: () => void;
  workspaceContextSummary: WorkspaceContextSummaryViewModel;
};

export function WorkspaceMenu({
  isOpen,
  language,
  onImportWorkspace,
  onOpenLiveWorkspace,
  onSaveLiveWorkspace,
  onReviewLiveFolderConflict,
  onDisconnectLiveWorkspace,
  liveFolderAutoSave = false,
  onToggleLiveFolderAutoSave,
  collaborationActive = false,
  onRetryCollaboration,
  onExportWorkspace,
  onClearWorkspace,
  workspaceContextSummary,
}: WorkspaceMenuProps) {
  if (!isOpen) return null;

  const copy = getWorkspaceMenuCopy(language);
  const status = getWorkspaceStatusIndicator(workspaceContextSummary);
  const statusContext = workspaceContextSummary.items.find(
    (item) => item.kind === status.kind,
  ) ?? workspaceContextSummary.primary;

  return (
    <section
      className="workspace-menu-popover"
      role="dialog"
      aria-label={copy.aria.workspaceMenu}
    >
      <header className="workspace-menu-context">
        <span className={`workspace-menu-context-dot ${status.tone}`} aria-hidden="true" />
        <span>
          <strong>{statusContext.title}</strong>
          <small>{status.description}</small>
        </span>
      </header>
      <nav className="workspace-menu-list" aria-label={copy.aria.workspaceActions}>
        {onImportWorkspace && (
          <MenuRow icon={<FolderInput size={16} />} onClick={onImportWorkspace}>
            {copy.actions.importWorkspace}
          </MenuRow>
        )}
        {onOpenLiveWorkspace && (
          <MenuRow icon={<FolderSync size={16} />} onClick={onOpenLiveWorkspace}>
            {copy.actions.openLiveWorkspace}
          </MenuRow>
        )}
        {onReviewLiveFolderConflict && (
          <MenuRow
            className="attention"
            icon={<TriangleAlert size={16} />}
            onClick={onReviewLiveFolderConflict}
          >
            {copy.actions.reviewLiveFolderConflict}
          </MenuRow>
        )}
        {onSaveLiveWorkspace && !onReviewLiveFolderConflict && (
          <MenuRow icon={<Save size={16} />} onClick={onSaveLiveWorkspace}>
            {copy.actions.saveLiveWorkspace}
          </MenuRow>
        )}
        {onToggleLiveFolderAutoSave && (
          <MenuRow
            icon={<FolderSync size={16} />}
            onClick={onToggleLiveFolderAutoSave}
            pressed={liveFolderAutoSave}
            trailing={<small>{liveFolderAutoSave ? "On" : "Off"}</small>}
          >
            {copy.actions.autoSaveLiveWorkspace}
          </MenuRow>
        )}
        {onDisconnectLiveWorkspace && (
          <MenuRow danger icon={<Unplug size={16} />} onClick={onDisconnectLiveWorkspace}>
            {copy.actions.disconnectLiveWorkspace}
          </MenuRow>
        )}
        {collaborationActive && onRetryCollaboration && (
          <MenuRow
            className="attention"
            icon={<RefreshCw size={16} />}
            onClick={onRetryCollaboration}
          >
            {copy.share.live.retrySession}
          </MenuRow>
        )}
        {(onExportWorkspace || onClearWorkspace) && (
          <div className="workspace-menu-divider" role="separator" />
        )}
        {onExportWorkspace && (
          <MenuRow icon={<FolderArchive size={16} />} onClick={onExportWorkspace}>
            {copy.actions.exportWorkspace}
          </MenuRow>
        )}
        {onClearWorkspace && (
          <MenuRow danger icon={<Trash2 size={16} />} onClick={onClearWorkspace}>
            {copy.actions.clearWorkspace}
          </MenuRow>
        )}
      </nav>
    </section>
  );
}
