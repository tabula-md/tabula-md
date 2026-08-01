import { lazy, Suspense } from "react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import { X } from "lucide-react";
import { ModalSurface } from "../../ui/ModalSurface";
import { PanelEmptyState } from "../../right-panel/PanelEmptyState";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { getWorkspaceChromeCopy } from "../workspaceLocale";

const WorkspaceSearch = lazy(() => import("../../right-panel/RightPanelSearch").then(
  ({ RightPanelSearch }) => ({ default: RightPanelSearch }),
));

export type WorkspaceSearchModalProps = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  index?: WorkspaceKnowledgeIndex;
  isOpen: boolean;
  language: WorkspaceLanguage;
  pending: boolean;
  onClose: () => void;
  onSelectFile: (fileId: string, range?: { from: number; to: number }) => void;
};

export function WorkspaceSearchModal({
  files,
  folders,
  index,
  isOpen,
  language,
  pending,
  onClose,
  onSelectFile,
}: WorkspaceSearchModalProps) {
  if (!isOpen) return null;

  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const closeLabel = getWorkspaceChromeCopy(language).documentControls.closeSearch;
  const selectFile = (fileId: string, range?: { from: number; to: number }) => {
    onSelectFile(fileId, range);
    onClose();
  };

  return (
    <ModalSurface
      ariaLabel={copy.tabs.search}
      className="workspace-search-modal"
      layerClassName="workspace-search-layer"
      onClose={onClose}
    >
      <button
        className="workspace-search-close"
        type="button"
        aria-label={closeLabel}
        data-tooltip={closeLabel}
        onClick={onClose}
      >
        <X size={16} aria-hidden="true" />
      </button>
      {files.length === 0 ? (
        <PanelEmptyState>{copy.search.noDocuments}</PanelEmptyState>
      ) : pending && !index ? (
        <section className="workspace-search-loading" aria-busy="true" />
      ) : (
        <Suspense fallback={<section className="workspace-search-loading" aria-busy="true" />}>
          <WorkspaceSearch
            copy={copy.search}
            files={files}
            folders={folders}
            index={index}
            language={language}
            onSelectFile={selectFile}
          />
        </Suspense>
      )}
    </ModalSurface>
  );
}
