import type { WorkspaceShareCopy } from "../../workspaceLocale";
import type { WorkspaceFile } from "../../workspaceStorage";

type ShareIncludedDocumentsProps = {
  copy: WorkspaceShareCopy;
  excludedFileIds: ReadonlySet<string>;
  files: WorkspaceFile[];
  includedFileCount: number;
  onToggleFileExcluded: (fileId: string) => void;
};

export function ShareIncludedDocuments({
  copy,
  excludedFileIds,
  files,
  includedFileCount,
  onToggleFileExcluded,
}: ShareIncludedDocumentsProps) {
  return (
    <div
      className="share-included-documents"
      aria-label={copy.live.roomDocumentsAria}
    >
      <header>
        <span>{copy.live.roomDocumentsLabel}</span>
        <strong>
          {copy.live.includedCount(includedFileCount, files.length)}
        </strong>
      </header>
      <div className="share-included-document-list">
        {files.map((file) => {
          const included = !excludedFileIds.has(file.id);
          const disabled = included && includedFileCount <= 1;
          return (
            <label className="share-included-document-row" key={file.id}>
              <input
                type="checkbox"
                checked={included}
                disabled={disabled}
                onChange={() => onToggleFileExcluded(file.id)}
              />
              <span>{file.title}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
