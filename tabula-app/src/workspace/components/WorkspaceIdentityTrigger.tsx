import {
  FolderOpen,
  HardDrive,
  LoaderCircle,
  Radio,
  TriangleAlert,
} from "lucide-react";
import type { WorkspaceContextSummaryViewModel } from "../workspaceContextSummary";
import { getWorkspaceStatusIndicator } from "../workspaceStatusIndicator";

type WorkspaceIdentityTriggerProps = {
  contextSummary: WorkspaceContextSummaryViewModel;
  isOpen: boolean;
  label: string;
  workspaceName: string;
  onToggle: () => void;
};

export function WorkspaceIdentityTrigger({
  contextSummary,
  isOpen,
  label,
  workspaceName,
  onToggle,
}: WorkspaceIdentityTriggerProps) {
  const status = getWorkspaceStatusIndicator(contextSummary);
  const statusContext = contextSummary.items.find(
    (item) => item.kind === status.kind,
  ) ?? contextSummary.primary;
  const StatusIcon = status.tone === "attention"
    ? TriangleAlert
    : status.tone === "working"
      ? LoaderCircle
      : status.kind === "collaboration"
        ? Radio
        : status.kind === "folder"
          ? FolderOpen
          : HardDrive;
  const statusLabel = `${workspaceName} · ${statusContext.title} · ${status.description}`;

  return (
    <button
      className={`workspace-identity-trigger ${status.tone}${isOpen ? " active" : ""}`}
      type="button"
      aria-label={label}
      aria-expanded={isOpen}
      data-workspace-context={statusContext.kind}
      data-workspace-state={statusContext.state}
      data-tooltip={statusLabel}
      onClick={onToggle}
    >
      <StatusIcon
        className={status.tone === "working" ? "workspace-identity-spinner" : undefined}
        size={16}
        aria-hidden="true"
      />
      <span className="workspace-identity-name">{workspaceName}</span>
      <span className="workspace-identity-context">{statusContext.title}</span>
    </button>
  );
}
