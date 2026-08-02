import { useState, type RefObject } from "react";
import { Files, Library } from "lucide-react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import type { RenameFileResult } from "../workspace/state/useWorkspaceFiles";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type { WorkspaceFile, WorkspaceFolder } from "../workspace/workspaceStorage";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { WorkspaceFileTree } from "./WorkspaceFileTree";
import { useWorkspaceFileTreeState } from "./useWorkspaceFileTreeState";
import { LibraryPanel } from "../libraries/LibraryPanel";
import { getLibraryPanelCopy } from "../libraries/libraryPanelLocale";
import { WorkspaceNavigationControls } from "../workspace/components/WorkspaceNavigationControls";
import { PanelShell } from "../shared/PanelShell";

type LeftPanelView = "files" | "libraries";

export type LeftPanelProps = {
  isOpen: boolean;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  knowledgeIndex?: WorkspaceKnowledgeIndex;
  knowledgeIndexSource: "none" | "worker" | "fallback";
  activeFileId: string;
  isLiveWorkspace: boolean;
  language: WorkspaceLanguage;
  workspaceMenuOpen: boolean;
  workspaceName: string;
  workspaceSearchOpen: boolean;
  onNewFile: (overrides?: Partial<WorkspaceFile>) => WorkspaceFile | undefined;
  onNewFolder: (parentId?: string) => WorkspaceFolder | undefined;
  onImportFile: () => void;
  onSelectFile: (fileId: string) => void;
  onOpenProperties: (fileId: string, section: "freshness" | "trust") => void;
  onRenameFile: (fileId: string, nextTitle: string) => Promise<RenameFileResult>;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCopyFile: (fileId: string) => void;
  onMoveFileToFolder: (fileId: string, folderId: string) => Promise<void>;
  onMoveFolder: (folderId: string, parentId: string) => Promise<void>;
  onRenameFolder: (folderId: string, nextTitle: string) => Promise<boolean>;
  onClose: () => void;
  onToggleWorkspaceMenu: () => void;
  onToggleWorkspaceSearch: () => void;
  overlayMode?: boolean;
  panelRef?: RefObject<HTMLElement | null>;
};

export function LeftPanel({
  isOpen,
  files,
  folders,
  knowledgeIndex,
  knowledgeIndexSource,
  activeFileId,
  isLiveWorkspace,
  language,
  workspaceMenuOpen,
  workspaceName,
  workspaceSearchOpen,
  onNewFile,
  onNewFolder,
  onImportFile,
  onSelectFile,
  onOpenProperties,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onDeleteFolder,
  onCopyFile,
  onMoveFileToFolder,
  onMoveFolder,
  onRenameFolder,
  onClose,
  onToggleWorkspaceMenu,
  onToggleWorkspaceSearch,
  overlayMode = false,
  panelRef,
}: LeftPanelProps) {
  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const chromeCopy = getWorkspaceChromeCopy(language).topChrome;
  const knowledgeCopy = getKnowledgePanelCopy(language);
  const libraryCopy = getLibraryPanelCopy(language);
  const [activeView, setActiveView] = useState<LeftPanelView>("files");
  const {
    collapsedFolderIds,
    toggleFolderCollapsed,
    collapseAllFolders,
    expandAllFolders,
  } = useWorkspaceFileTreeState();

  return (
    <PanelShell
      side="left"
      panelRef={panelRef}
      isOpen={isOpen}
      overlayMode={overlayMode}
      ariaLabel={chromeCopy.workspacePanel}
      data-knowledge-index-source={knowledgeIndexSource}
      data-live-workspace={isLiveWorkspace || undefined}
    >
      <header className="panel-chrome-row workspace-panel-chrome">
        <WorkspaceNavigationControls
          language={language}
          leftPanelOpen={isOpen}
          workspaceMenuOpen={workspaceMenuOpen}
          workspaceName={workspaceName}
          workspaceSearchOpen={workspaceSearchOpen}
          onToggleLeftPanel={onClose}
          onToggleWorkspaceMenu={onToggleWorkspaceMenu}
          onToggleWorkspaceSearch={onToggleWorkspaceSearch}
        />
      </header>
      <header className="workspace-panel-header">
        <nav className="ui-panel-tabs workspace-panel-tabs" aria-label={libraryCopy.sections}>
          <button
            type="button"
            className={`ui-panel-tab ${activeView === "files" ? "active" : ""}`}
            aria-label={libraryCopy.files}
            aria-pressed={activeView === "files"}
            data-tooltip={libraryCopy.files}
            onClick={() => setActiveView("files")}
          >
            <Files size={16} />
          </button>
          <button
            type="button"
            className={`ui-panel-tab ${activeView === "libraries" ? "active" : ""}`}
            aria-label={libraryCopy.libraries}
            aria-pressed={activeView === "libraries"}
            data-tooltip={libraryCopy.libraries}
            onClick={() => setActiveView("libraries")}
          >
            <Library size={16} />
          </button>
        </nav>
      </header>
      {activeView === "files" ? (
        <div className="workspace-panel-body files" id="workspace-panel-files-view">
          <WorkspaceFileTree
            files={files}
            folders={folders}
            activeFileId={activeFileId}
            copy={copy.files}
            knowledgeIndex={knowledgeIndex}
            knowledgeStatusCopy={knowledgeCopy}
            collapsedFolderIds={collapsedFolderIds}
            onNewFile={(parentId) => onNewFile(parentId ? { parentId } : undefined)}
            onNewFolder={onNewFolder}
            onImportFile={onImportFile}
            onToggleFolder={toggleFolderCollapsed}
            onCollapseAllFolders={collapseAllFolders}
            onExpandAllFolders={expandAllFolders}
            onSelectFile={onSelectFile}
            onReviewKnowledgeFile={onOpenProperties}
            onRenameFile={onRenameFile}
            onDuplicateFile={onDuplicateFile}
            onDeleteFile={onDeleteFile}
            onDeleteFolder={onDeleteFolder}
            onCopyFile={onCopyFile}
            onMoveFileToFolder={onMoveFileToFolder}
            onMoveFolder={onMoveFolder}
            onRenameFolder={onRenameFolder}
          />
        </div>
      ) : (
        <div className="workspace-panel-body libraries" id="workspace-panel-libraries-view">
          <LibraryPanel language={language} />
        </div>
      )}
    </PanelShell>
  );
}
