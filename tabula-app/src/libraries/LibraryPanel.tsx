import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  File,
  Folder,
  FolderArchive,
  Library,
  Upload,
} from "lucide-react";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import {
  createLibraryBundle,
  getLibraryBundleRows,
  readLibraryBundles,
  saveLibraryBundle,
  TABULA_LIBRARY_CATALOG_URL,
  type LibraryBundle,
} from "./libraryBundleStore";
import { getLibraryPanelCopy } from "./libraryPanelLocale";

type LibraryPanelProps = {
  language: WorkspaceLanguage;
};

export function LibraryPanel({ language }: LibraryPanelProps) {
  const copy = getLibraryPanelCopy(language);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [bundles, setBundles] = useState<LibraryBundle[]>([]);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void readLibraryBundles().then((stored) => {
      if (active) setBundles(stored);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const importBundle = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    try {
      setError("");
      const bundle = createLibraryBundle(selectedFiles);
      await saveLibraryBundle(bundle);
      setBundles((current) => [bundle, ...current]);
      setExpandedIds((current) => new Set(current).add(bundle.id));
    } catch {
      setError(copy.importFailed);
    }
  };

  const toggleBundle = (bundleId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(bundleId)) next.delete(bundleId);
      else next.add(bundleId);
      return next;
    });
  };

  return (
    <section className="library-panel" aria-label={copy.libraries}>
      <input
        ref={inputRef}
        className="workspace-file-input"
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={(event) => void importBundle(event)}
        aria-label={copy.importBundle}
      />
      {error && <p className="library-panel-error" role="alert">{error}</p>}
      {bundles.length === 0 ? (
        <div className="library-empty-state">
          <span className="library-empty-icon" aria-hidden="true"><Library size={20} /></span>
          <div>
            <h3>{copy.emptyTitle}</h3>
            <p>{copy.emptyDescription}</p>
          </div>
          <div className="library-empty-actions">
            <button type="button" className="library-primary-action" onClick={() => inputRef.current?.click()}>
              <Upload size={15} />
              {copy.importBundle}
            </button>
            <a className="library-secondary-action" href={TABULA_LIBRARY_CATALOG_URL} target="_blank" rel="noreferrer">
              {copy.browseLibraries}
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      ) : (
        <div className="library-list">
          <div className="library-toolbar">
            <button type="button" className="right-file-toolbar-button" onClick={() => inputRef.current?.click()}>
              <Upload size={15} />
              <span>{copy.importBundle}</span>
            </button>
            <a href={TABULA_LIBRARY_CATALOG_URL} target="_blank" rel="noreferrer">
              {copy.browseLibraries}
            </a>
          </div>
          {bundles.map((bundle) => {
            const expanded = expandedIds.has(bundle.id);
            return (
              <section className="library-bundle" key={bundle.id}>
                <button
                  type="button"
                  className="library-bundle-header"
                  aria-expanded={expanded}
                  onClick={() => toggleBundle(bundle.id)}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <FolderArchive size={16} />
                  <span>{bundle.name}</span>
                  <small>{copy.fileCount(bundle.files.length)}</small>
                </button>
                {expanded && (
                  <ul className="library-file-tree" aria-label={copy.tree(bundle.name)}>
                    {getLibraryBundleRows(bundle.files).map((row) => (
                      <li
                        key={row.path}
                        title={row.path}
                        style={{ paddingLeft: `${8 + row.depth * 16}px` }}
                      >
                        {row.kind === "folder" ? <Folder size={14} /> : <File size={14} />}
                        <span>{row.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
