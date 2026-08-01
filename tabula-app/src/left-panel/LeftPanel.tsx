import type { RefObject } from "react";
import { PanelLeftClose } from "lucide-react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import type { RenameFileResult } from "../workspace/state/useWorkspaceFiles";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type { WorkspaceFile, WorkspaceFolder } from "../workspace/workspaceStorage";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { RightPanelFiles } from "../right-panel/RightPanelFiles";
import { useRightPanelCollapseState } from "../right-panel/useRightPanelCollapseState";

export type LeftPanelProps = {
  isOpen: boolean;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  knowledgeIndex?: WorkspaceKnowledgeIndex;
  knowledgeIndexSource: "none" | "worker" | "fallback";
  activeFileId: string;
  isLiveWorkspace: boolean;
  language: WorkspaceLanguage;
  onNewFile: (overrides?: Partial<WorkspaceFile>) => WorkspaceFile | undefined;
  onNewFolder: (parentId?: string) => WorkspaceFolder | undefined;
  onImportFile: () => void;
  onSelectFile: (fileId: string) => void;
  onOpenProperties: (fileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => Promise<RenameFileResult>;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCopyFile: (fileId: string) => void;
  onMoveFileToFolder: (fileId: string, folderId: string) => Promise<void>;
  onMoveFolder: (folderId: string, parentId: string) => Promise<void>;
  onRenameFolder: (folderId: string, nextTitle: string) => Promise<boolean>;
  onClose: () => void;
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
  overlayMode = false,
  panelRef,
}: LeftPanelProps) {
  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const chromeCopy = getWorkspaceChromeCopy(language).topChrome;
  const knowledgeCopy = getKnowledgePanelCopy(language);
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

  return (
    <aside
      ref={panelRef}
      className="left-panel"
      role={overlayMode ? "dialog" : undefined}
      aria-modal={overlayMode || undefined}
      aria-label={chromeCopy.workspacePanel}
      tabIndex={overlayMode ? -1 : undefined}
      data-knowledge-index-source={knowledgeIndexSource}
      data-live-workspace={isLiveWorkspace || undefined}
    >
      <header className="workspace-panel-header">
        <h2>{chromeCopy.files}</h2>
        {overlayMode && (
          <button
            className="right-file-toolbar-button workspace-panel-close"
            type="button"
            aria-label={chromeCopy.closeSidePanel}
            data-tooltip={chromeCopy.closeSidePanel}
            onClick={onClose}
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </header>
      <div className="right-panel-body files" id="workspace-panel-files-view">
          <RightPanelFiles
            files={files}
            folders={folders}
            activeFileId={activeFileId}
            copy={copy.files}
            knowledgeIndex={knowledgeIndex}
            knowledgeStatusCopy={knowledgeCopy}
            collapsedFolderIds={collapsedFileTreeFolderIds}
            onNewFile={(parentId) => onNewFile(parentId ? { parentId } : undefined)}
            onNewFolder={onNewFolder}
            onImportFile={onImportFile}
            onToggleFolder={toggleFileTreeFolderCollapsed}
            onCollapseAllFolders={collapseAllFileTreeFolders}
            onExpandAllFolders={expandAllFileTreeFolders}
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
    </aside>
  );
}
