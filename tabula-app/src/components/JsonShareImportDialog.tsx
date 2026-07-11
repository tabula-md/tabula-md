import { AlertTriangle, FileArchive, Loader2, X } from "lucide-react";

type JsonShareImportDialogProps = {
  errorMessage?: string;
  fileCount?: number;
  filePaths?: readonly string[];
  onCancel: () => void;
  onReplace: () => void;
  status: "loading" | "ready" | "error";
};

export function JsonShareImportDialog({
  errorMessage,
  fileCount = 0,
  filePaths = [],
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
              <h2 id="json-import-title">Open export link</h2>
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
              <h2 id="json-import-title">Open export link</h2>
              <p>This encrypted point-in-time copy is independent from its source.</p>
            </header>
            <div className="json-import-copy">
              <FileArchive size={22} aria-hidden="true" />
              <div>
                <p>The copy contains {fileCount} {fileLabel}. Opening it replaces this local workspace.</p>
                {filePaths.length > 0 && (
                  <ul className="json-import-files" aria-label="Documents in this export link">
                    {filePaths.slice(0, 5).map((filePath) => <li key={filePath}>{filePath}</li>)}
                    {filePaths.length > 5 && <li>+{filePaths.length - 5} more</li>}
                  </ul>
                )}
                <p>Edits you make here will not update the source or this link.</p>
              </div>
            </div>
            <div className="share-modal-actions">
              <button className="share-modal-secondary" type="button" onClick={onCancel}>
                Cancel
              </button>
              <button className="share-modal-primary" type="button" onClick={onReplace}>
                Open copy
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
