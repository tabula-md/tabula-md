import { lazy, Suspense } from "react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import { X } from "lucide-react";
import { ModalSurface } from "../../ui/ModalSurface";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import type { WorkspaceSearchCommand } from "../../right-panel/RightPanelSearch";
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
  onSelectFile: (fileId: string) => void;
  commands: readonly WorkspaceSearchCommand[];
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
  commands,
}: WorkspaceSearchModalProps) {
  if (!isOpen) return null;

  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const closeLabel = getWorkspaceChromeCopy(language).documentControls.closeSearch;
  const selectFile = (fileId: string) => {
    onSelectFile(fileId);
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
      {pending && files.length > 0 && !index ? (
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
            commands={commands.map((command) => ({
              ...command,
              onSelect: () => {
                command.onSelect();
                onClose();
              },
            }))}
          />
        </Suspense>
      )}
    </ModalSurface>
  );
}
