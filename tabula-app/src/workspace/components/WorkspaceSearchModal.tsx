import { lazy, Suspense } from "react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import { X } from "lucide-react";
import { ModalSurface } from "../../ui/ModalSurface";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import {
  WorkspaceCommandPalette,
  type WorkspaceSearchCommand,
} from "./WorkspaceCommandPalette";
import type { WorkspaceSearchMode } from "../state/workspaceUiStore";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { getWorkspaceChromeCopy, getWorkspaceMenuCopy } from "../workspaceLocale";

const WorkspaceSearch = lazy(() => import("./WorkspaceDeepSearch").then(
  ({ WorkspaceDeepSearch }) => ({ default: WorkspaceDeepSearch }),
));

export type WorkspaceSearchModalProps = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  index?: WorkspaceKnowledgeIndex;
  isOpen: boolean;
  mode: WorkspaceSearchMode;
  language: WorkspaceLanguage;
  activeFileId?: string;
  openFileIds: readonly string[];
  pending: boolean;
  onClose: () => void;
  onModeChange: (mode: WorkspaceSearchMode) => void;
  onSelectFile: (fileId: string) => void;
  commands: readonly WorkspaceSearchCommand[];
};

export function WorkspaceSearchModal({
  files,
  folders,
  index,
  isOpen,
  mode,
  language,
  activeFileId,
  openFileIds,
  pending,
  onClose,
  onModeChange,
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
      ariaLabel={mode === "palette" ? "Command palette" : copy.tabs.search}
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
      {mode === "palette" ? (
        <WorkspaceCommandPalette
          files={files}
          folders={folders}
          activeFileId={activeFileId}
          openFileIds={openFileIds}
          copy={paletteCopy}
          onSelectFile={selectFile}
          commands={commands.map((command) => ({
            ...command,
            onSelect: () => {
              command.onSelect();
              if (command.closeOnSelect !== false) onClose();
            },
          }))}
        />
      ) : pending && files.length > 0 && !index ? (
        <section className="workspace-search-loading" aria-busy="true" />
      ) : (
        <Suspense fallback={<section className="workspace-search-loading" aria-busy="true" />}>
          <WorkspaceSearch
            copy={copy.search}
            paletteCopy={copy.commandPalette}
            files={files}
            folders={folders}
            index={index}
            language={language}
            onBack={() => onModeChange("palette")}
            onSelectFile={selectFile}
          />
        </Suspense>
      )}
    </ModalSurface>
  );
}
