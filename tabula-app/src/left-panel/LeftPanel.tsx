import { type RefObject } from "react";
import { Files, Library, Menu, PanelLeft } from "lucide-react";
import type { LeftPanelView } from "../ui/uiTypes";
import type { RenameFileResult } from "../workspace/state/useWorkspaceFiles";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type { WorkspaceFile, WorkspaceFolder } from "../workspace/workspaceStorage";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import { RightPanelFiles } from "../right-panel/RightPanelFiles";
import { useRightPanelCollapseState } from "../right-panel/useRightPanelCollapseState";
import { LibraryPanel } from "../libraries/LibraryPanel";
import { getLibraryPanelCopy } from "../libraries/libraryPanelLocale";

export type LeftPanelProps = {
  isOpen: boolean;
  view: LeftPanelView;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  knowledgeIndexSource: "none" | "worker" | "fallback";
  activeFileId: string;
  isLiveWorkspace: boolean;
  language: WorkspaceLanguage;
  onClose: () => void;
  onViewChange: (view: LeftPanelView) => void;
  workspaceMenuOpen?: boolean;
  onToggleWorkspaceMenu?: () => void;
  onNewFile: (overrides?: Partial<WorkspaceFile>) => WorkspaceFile | undefined;
  onNewFolder: (parentId?: string) => WorkspaceFolder | undefined;
  onImportFile: () => void;
  onSelectFile: (fileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => Promise<RenameFileResult>;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCopyFile: (fileId: string) => void;
  onMoveFileToFolder: (fileId: string, folderId: string) => Promise<void>;
  onMoveFolder: (folderId: string, parentId: string) => Promise<void>;
  onRenameFolder: (folderId: string, nextTitle: string) => Promise<boolean>;
  onRenameWorkspace: (nextTitle: string) => boolean;
  overlayMode?: boolean;
  panelRef?: RefObject<HTMLElement | null>;
};

export function LeftPanel({
  isOpen,
  view,
  files,
  folders,
  knowledgeIndexSource,
  activeFileId,
  isLiveWorkspace,
  language,
  onClose,
  onViewChange,
  workspaceMenuOpen,
  onToggleWorkspaceMenu,
  onNewFile,
  onNewFolder,
  onImportFile,
  onSelectFile,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onDeleteFolder,
  onCopyFile,
  onMoveFileToFolder,
  onMoveFolder,
  onRenameFolder,
  onRenameWorkspace,
  overlayMode = false,
  panelRef,
}: LeftPanelProps) {
  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const closeLabel = getWorkspaceChromeCopy(language).topChrome.closeSidePanel;
  const workspaceMenuLabel = workspaceMenuOpen
    ? getWorkspaceChromeCopy(language).topChrome.closeWorkspaceMenu
    : getWorkspaceChromeCopy(language).topChrome.openWorkspaceMenu;
  const libraryCopy = getLibraryPanelCopy(language);
  const {
    collapsedFileTreeFolderIds,
    toggleFileTreeFolderCollapsed,
    collapseAllFileTreeFolders,
    expandAllFileTreeFolders,
  } = useRightPanelCollapseState({
    activeFileId,
    commentsByFileId: {},
  });
  if (!isOpen) return null;

  const title = view === "libraries" ? libraryCopy.libraries : copy.tabs[view];

  return (
    <aside
      ref={panelRef}
      className="left-panel"
      role={overlayMode ? "dialog" : undefined}
      aria-modal={overlayMode || undefined}
      aria-label={title}
      tabIndex={overlayMode ? -1 : undefined}
      data-knowledge-index-source={knowledgeIndexSource}
      data-live-workspace={isLiveWorkspace || undefined}
    >
      <header className="left-panel-header">
        <button
          className={`left-panel-menu ${workspaceMenuOpen ? "active" : ""}`}
          type="button"
          aria-label={workspaceMenuLabel}
          data-tooltip={workspaceMenuLabel}
          aria-expanded={workspaceMenuOpen}
          onClick={onToggleWorkspaceMenu}
        >
          <Menu size={16} />
        </button>
        <nav className="left-panel-tabs" aria-label={libraryCopy.sections}>
            <button
              type="button"
              className={view === "files" ? "active" : ""}
              aria-label={libraryCopy.files}
              aria-pressed={view === "files"}
              data-tooltip={libraryCopy.files}
              onClick={() => onViewChange("files")}
            >
              <Files size={16} />
            </button>
            <button
              type="button"
              className={view === "libraries" ? "active" : ""}
              aria-label={libraryCopy.libraries}
              aria-pressed={view === "libraries"}
              data-tooltip={libraryCopy.libraries}
              onClick={() => onViewChange("libraries")}
            >
              <Library size={16} />
            </button>
        </nav>
        <button
          className="left-panel-close"
          type="button"
          aria-label={closeLabel}
          data-tooltip={closeLabel}
          onClick={onClose}
        >
          <PanelLeft size={16} />
        </button>
      </header>

      <div className={`right-panel-body ${view}`}>
        {view === "files" && (
          <RightPanelFiles
            files={files}
            folders={folders}
            activeFileId={activeFileId}
            copy={copy.files}
            collapsedFolderIds={collapsedFileTreeFolderIds}
            onNewFile={(parentId) => onNewFile(parentId ? { parentId } : undefined)}
            onNewFolder={onNewFolder}
            onImportFile={onImportFile}
            onToggleFolder={toggleFileTreeFolderCollapsed}
            onCollapseAllFolders={collapseAllFileTreeFolders}
            onExpandAllFolders={expandAllFileTreeFolders}
            onSelectFile={onSelectFile}
            onRenameFile={onRenameFile}
            onDuplicateFile={onDuplicateFile}
            onDeleteFile={onDeleteFile}
            onDeleteFolder={onDeleteFolder}
            onCopyFile={onCopyFile}
            onMoveFileToFolder={onMoveFileToFolder}
            onMoveFolder={onMoveFolder}
            onRenameFolder={onRenameFolder}
            onRenameWorkspace={onRenameWorkspace}
          />
        )}

        {view === "libraries" && <LibraryPanel language={language} />}
      </div>
    </aside>
  );
}
