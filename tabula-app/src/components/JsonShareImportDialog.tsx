import { AlertTriangle, Loader2, X } from "lucide-react";

type JsonShareImportDialogProps = {
  errorMessage?: string;
  fileCount?: number;
  onCancel: () => void;
  onReplace: () => void;
  status: "loading" | "ready" | "error";
};

export function JsonShareImportDialog({
  errorMessage,
  fileCount = 0,
  onCancel,
  onReplace,
  status,
}: JsonShareImportDialogProps) {
  const fileLabel = fileCount === 1 ? "file" : "files";

  return (
    <div className="share-modal-layer json-import-modal-layer">
      <section className="share-modal json-import-modal" role="dialog" aria-modal="true" aria-labelledby="json-import-title">
        <button className="share-modal-close" type="button" aria-label="Close export link dialog" onClick={onCancel}>
          <X size={20} />
        </button>

        {status === "loading" && (
          <>
            <header className="share-modal-header">
              <h2 id="json-import-title">Load export link</h2>
            </header>
            <div className="json-import-state">
              <Loader2 size={20} aria-hidden="true" />
              <p>Preparing encrypted export.</p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <header className="share-modal-header compact">
              <h2 id="json-import-title">Unable to open link</h2>
            </header>
            <div className="json-import-warning">
              <AlertTriangle size={22} aria-hidden="true" />
              <p>{errorMessage || "This shared link could not be loaded."}</p>
            </div>
            <div className="share-modal-actions">
              <button className="share-modal-primary" type="button" onClick={onCancel}>
                Return to workspace
              </button>
            </div>
          </>
        )}

        {status === "ready" && (
          <>
            <header className="share-modal-header compact">
              <h2 id="json-import-title">Load export link</h2>
              <p>Loading this link will replace your current local content.</p>
            </header>
            <div className="json-import-warning">
              <AlertTriangle size={22} aria-hidden="true" />
              <p>
                The link contains {fileCount} {fileLabel}.
              </p>
            </div>
            <div className="share-modal-actions">
              <button className="share-modal-secondary" type="button" onClick={onCancel}>
                Cancel
              </button>
              <button className="share-modal-primary" type="button" onClick={onReplace}>
                Load export
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
