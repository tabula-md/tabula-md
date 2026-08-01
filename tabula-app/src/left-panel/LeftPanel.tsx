import { lazy, Suspense, type RefObject } from "react";
import { PanelLeftClose } from "lucide-react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import type { LeftPanelView } from "../ui/uiTypes";
import type { RenameFileResult } from "../workspace/state/useWorkspaceFiles";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type { WorkspaceFile, WorkspaceFolder } from "../workspace/workspaceStorage";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { RightPanelFiles } from "../right-panel/RightPanelFiles";
import { PanelEmptyState } from "../right-panel/PanelEmptyState";
import { useRightPanelCollapseState } from "../right-panel/useRightPanelCollapseState";

const RightPanelSearch = lazy(() => import("../right-panel/RightPanelSearch").then((module) => ({
  default: module.RightPanelSearch,
})));

const panelFallback = <section className="right-panel-content" aria-busy="true" />;

export type LeftPanelProps = {
  isOpen: boolean;
  view: LeftPanelView;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  knowledgeIndex?: WorkspaceKnowledgeIndex;
  knowledgeIndexPending: boolean;
  knowledgeIndexSource: "none" | "worker" | "fallback";
  activeFileId: string;
  isLiveWorkspace: boolean;
  language: WorkspaceLanguage;
  onClose: () => void;
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
  onRenameWorkspace: (nextTitle: string) => boolean;
  overlayMode?: boolean;
  panelRef?: RefObject<HTMLElement | null>;
};

export function LeftPanel({
  isOpen,
  view,
  files,
  folders,
  knowledgeIndex,
  knowledgeIndexPending,
  knowledgeIndexSource,
  activeFileId,
  isLiveWorkspace,
  language,
  onClose,
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
  onRenameWorkspace,
  overlayMode = false,
  panelRef,
}: LeftPanelProps) {
  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const knowledgeCopy = getKnowledgePanelCopy(language);
  const closeLabel = getWorkspaceChromeCopy(language).topChrome.closeSidePanel;
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

  const title = copy.tabs[view];
  const hasDocuments = files.length > 0;

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
        <strong>{title}</strong>
        <button
          className="left-panel-close"
          type="button"
          aria-label={closeLabel}
          data-tooltip={closeLabel}
          onClick={onClose}
        >
          <PanelLeftClose size={16} />
        </button>
      </header>

      <div className={`right-panel-body ${view}`}>
        {view === "files" && (
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
            onRenameWorkspace={onRenameWorkspace}
          />
        )}

        {!hasDocuments && view === "search" && (
          <section className="right-panel-content">
            <PanelEmptyState>{copy.search.noDocuments}</PanelEmptyState>
          </section>
        )}

        {hasDocuments && view === "search" && knowledgeIndexPending && !knowledgeIndex &&
          panelFallback}

        {hasDocuments && view === "search" && (!knowledgeIndexPending || knowledgeIndex) && (
          <Suspense fallback={panelFallback}>
            <RightPanelSearch
              copy={copy.search}
              files={files}
              folders={folders}
              index={knowledgeIndex}
              language={language}
              onSelectFile={onSelectFile}
            />
          </Suspense>
        )}
      </div>
    </aside>
  );
}
