import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import { X } from "lucide-react";
import { ModalSurface } from "../../ui/ModalSurface";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import {
  WorkspaceCommandPalette,
  type WorkspaceSearchCommand,
} from "./WorkspaceCommandPalette";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { getWorkspaceChromeCopy, getWorkspaceMenuCopy } from "../workspaceLocale";

export type WorkspaceSearchModalProps = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  index?: WorkspaceKnowledgeIndex;
  isOpen: boolean;
  language: WorkspaceLanguage;
  activeFileId?: string;
  openFileIds: readonly string[];
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
  activeFileId,
  openFileIds,
  onClose,
  onSelectFile,
  commands,
}: WorkspaceSearchModalProps) {
  if (!isOpen) return null;

  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const closeLabel = getWorkspaceChromeCopy(language).documentControls.closeSearch;
  const paletteCopy = {
    ...copy.commandPalette,
    actions: getWorkspaceMenuCopy(language).aria.workspaceActions,
  };
  const selectFile = (fileId: string) => {
    onSelectFile(fileId);
    onClose();
  };

  return (
    <ModalSurface
      ariaLabel="Command palette"
      className="workspace-search-modal command-palette-modal"
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
      <WorkspaceCommandPalette
        files={files}
        folders={folders}
        index={index}
        activeFileId={activeFileId}
        openFileIds={openFileIds}
        copy={paletteCopy}
        searchCopy={copy.search}
        onSelectFile={selectFile}
        commands={commands.map((command) => ({
          ...command,
          onSelect: () => {
            command.onSelect();
            if (command.closeOnSelect !== false) onClose();
          },
        }))}
      />
    </ModalSurface>
  );
}
