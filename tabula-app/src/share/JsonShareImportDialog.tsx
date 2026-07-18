import { AlertTriangle, FileArchive, Loader2, X } from "lucide-react";
import { ModalSurface } from "../ui/ModalSurface";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";

type JsonShareImportDialogProps = {
  errorMessage?: string;
  fileCount?: number;
  filePaths?: readonly string[];
  language: WorkspaceLanguage;
  onCancel: () => void;
  onReplace: () => void;
  status: "loading" | "ready" | "error";
};

export function JsonShareImportDialog({
  errorMessage,
  fileCount = 0,
  filePaths = [],
  language,
  onCancel,
  onReplace,
  status,
}: JsonShareImportDialogProps) {
  const copy = getWorkspaceSurfaceCopy(language);

  return (
    <ModalSurface
      ariaLabelledBy="json-import-title"
      className="json-import-modal"
      layerClassName="json-import-modal-layer"
      onClose={onCancel}
    >
        <button
          className="share-modal-close"
          type="button"
          aria-label={copy.jsonClose}
          data-modal-initial-focus
          onClick={onCancel}
        >
          <X size={18} />
        </button>

        {status === "loading" && (
          <>
            <header className="share-modal-header">
              <h2 id="json-import-title">{copy.jsonOpen}</h2>
            </header>
            <div className="json-import-state">
              <Loader2 size={18} aria-hidden="true" />
              <p>{copy.jsonPreparing}</p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <header className="share-modal-header compact">
              <h2 id="json-import-title">{copy.jsonUnable}</h2>
            </header>
            <div className="json-import-warning">
              <AlertTriangle size={18} aria-hidden="true" />
              <p>{errorMessage || copy.jsonLoadError}</p>
            </div>
            <div className="share-modal-actions">
              <button className="share-modal-primary" type="button" onClick={onCancel}>
                {copy.jsonReturn}
              </button>
            </div>
          </>
        )}

        {status === "ready" && (
          <>
            <header className="share-modal-header compact">
              <h2 id="json-import-title">{copy.jsonOpen}</h2>
              <p>{copy.jsonDescription}</p>
            </header>
            <div className="json-import-copy">
              <FileArchive size={18} aria-hidden="true" />
              <div>
                <p>{copy.jsonContains(fileCount)}</p>
                {filePaths.length > 0 && (
                  <ul className="json-import-files" aria-label={copy.jsonDocuments}>
                    {filePaths.slice(0, 5).map((filePath) => <li key={filePath}>{filePath}</li>)}
                    {filePaths.length > 5 && <li>{copy.jsonMore(filePaths.length - 5)}</li>}
                  </ul>
                )}
                <p>{copy.jsonEdits}</p>
              </div>
            </div>
            <div className="share-modal-actions">
              <button className="share-modal-secondary" type="button" onClick={onCancel}>
                {copy.jsonCancel}
              </button>
              <button className="share-modal-primary" type="button" onClick={onReplace}>
                {copy.jsonOpenCopy}
              </button>
            </div>
          </>
        )}
    </ModalSurface>
  );
}
