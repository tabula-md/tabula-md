import { useState } from "react";
import { BadgeCheck, FileText, Info, X } from "lucide-react";
import { ModalSurface } from "../../ui/ModalSurface";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { WorkspaceImportResult } from "../io/workspaceImportResultModel";
import { getWorkspaceImportResultCopy } from "../io/workspaceImportResultLocale";

type WorkspaceImportResultDialogProps = {
  language: WorkspaceLanguage;
  result: WorkspaceImportResult;
  onClose: () => void;
  onOpenRootIndex: () => void;
};

export function WorkspaceImportResultDialog({
  language,
  result,
  onClose,
  onOpenRootIndex,
}: WorkspaceImportResultDialogProps) {
  const copy = getWorkspaceImportResultCopy(language);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const summary = [
    [copy.format, `OKF ${result.standardVersion}`],
    [copy.concepts, result.conceptCount],
    [copy.directoryIndexes, result.directoryIndexCount],
    [copy.activityLog, result.hasActivityLog ? copy.present : copy.missing],
    [copy.supportFiles, result.preservedSupportPaths.length],
    [copy.requiredFixes, result.requiredChangeCount],
    [copy.healthAttention, result.attentionCount],
  ] as const;

  const pathList = (label: string, paths: readonly string[]) => (
    <section>
      <h3>{label}</h3>
      {paths.length > 0
        ? (
            <ul className="json-import-files" aria-label={label}>
              {paths.map((path) => <li key={path}>{path}</li>)}
            </ul>
          )
        : <p>{copy.noPaths}</p>}
    </section>
  );

  return (
    <ModalSurface
      ariaLabelledBy="workspace-import-result-title"
      className="workspace-import-result-modal"
      onClose={onClose}
    >
      <button
        className="share-modal-close"
        type="button"
        aria-label={copy.close}
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <header className="share-modal-header compact">
        <span className="workspace-import-result-mark" aria-hidden="true">
          <BadgeCheck size={18} />
        </span>
        <div>
          <h2 id="workspace-import-result-title">{copy.title}</h2>
          <p>{copy.description(result.standardVersion)}</p>
        </div>
      </header>

      <dl className="workspace-import-result-summary">
        {summary.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {result.suggestsV02Transition && (
        <div className="workspace-import-result-guidance">
          <Info size={17} aria-hidden="true" />
          <p>{copy.v02Guidance}</p>
        </div>
      )}

      <button
        className="workspace-import-result-details-toggle"
        type="button"
        aria-expanded={detailsOpen}
        aria-controls="workspace-import-result-details"
        onClick={() => setDetailsOpen((current) => !current)}
      >
        <FileText size={16} aria-hidden="true" />
        {detailsOpen ? copy.hideDetails : copy.showDetails}
      </button>
      {detailsOpen && (
        <div
          className="workspace-import-result-details"
          id="workspace-import-result-details"
          aria-label={copy.detailsLabel}
        >
          {pathList(copy.preservedPaths, result.preservedSupportPaths)}
        </div>
      )}

      <div className="share-modal-actions workspace-import-result-actions">
        <button
          className="ui-modal-action secondary share-modal-secondary"
          type="button"
          onClick={onClose}
        >
          {copy.dismiss}
        </button>
        {result.rootIndexDocumentId && (
          <button
            className="share-modal-primary"
            type="button"
            data-modal-initial-focus
            onClick={onOpenRootIndex}
          >
            {copy.openRootIndex}
          </button>
        )}
      </div>
    </ModalSurface>
  );
}
