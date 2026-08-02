import { ExternalLink, Library } from "lucide-react";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getLibraryPanelCopy } from "./libraryPanelLocale";

const TABULA_LIBRARY_CATALOG_URL = "https://libraries.tabula.md/";

type LibraryPanelProps = {
  language: WorkspaceLanguage;
};

export function LibraryPanel({ language }: LibraryPanelProps) {
  const copy = getLibraryPanelCopy(language);

  return (
    <section className="library-panel" aria-label={copy.libraries}>
      <div className="library-empty-state">
        <span className="library-empty-icon" aria-hidden="true"><Library size={20} /></span>
        <div>
          <h3>{copy.emptyTitle}</h3>
          <p>{copy.emptyDescription}</p>
        </div>
        <a
          className="library-browse-action"
          href={TABULA_LIBRARY_CATALOG_URL}
          target="_blank"
          rel="noreferrer"
        >
          {copy.browseLibraries}
          <ExternalLink size={14} />
        </a>
      </div>
    </section>
  );
}
