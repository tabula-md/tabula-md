import { Copy, Download, FileText, FolderArchive } from "lucide-react";
import type { WorkspaceShareCopy } from "../../workspaceLocale";

type ShareExportPanelProps = {
  copy: WorkspaceShareCopy;
  onCopyFile: () => void;
  onDownloadFile: () => void;
  onDownloadProjectArchive: () => void;
};

export function ShareExportPanel({
  copy,
  onCopyFile,
  onDownloadFile,
  onDownloadProjectArchive,
}: ShareExportPanelProps) {
  return (
    <>
      <div className="share-panel-heading">
        <span className="share-modal-option-icon">
          <Download size={17} />
        </span>
        <div>
          <h3>{copy.exportPanel.title}</h3>
          <p>{copy.exportPanel.description}</p>
        </div>
      </div>
      <div className="share-export-grid" aria-label={copy.exportPanel.title}>
        <button
          className="share-export-card"
          type="button"
          onClick={onDownloadFile}
        >
          <span className="share-export-icon">
            <FileText size={18} />
          </span>
          <strong>
            {copy.exportPanel.fileTitle} <span>.md</span>
          </strong>
          <p>{copy.exportPanel.fileDescription}</p>
        </button>
        <button
          className="share-export-card"
          type="button"
          onClick={onCopyFile}
        >
          <span className="share-export-icon">
            <Copy size={18} />
          </span>
          <strong>{copy.exportPanel.copyFileTitle}</strong>
          <p>{copy.exportPanel.copyFileDescription}</p>
        </button>
        <button
          className="share-export-card"
          type="button"
          onClick={onDownloadProjectArchive}
        >
          <span className="share-export-icon">
            <FolderArchive size={18} />
          </span>
          <strong>
            {copy.exportPanel.projectArchiveTitle} <span>.zip</span>
          </strong>
          <p>{copy.exportPanel.projectArchiveDescription}</p>
        </button>
      </div>
    </>
  );
}
