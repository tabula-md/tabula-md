import {
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import {
  Files,
  BookOpenText,
  CircleAlert,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  Radio,
  Search,
  Settings2,
  TriangleAlert,
  LibraryBig,
} from "lucide-react";
import { SIDE_PANEL_OVERLAY_ACCESSIBILITY } from "../ui/overlayAccessibility";
import type { LeftPanelView } from "../ui/uiTypes";
import type { RenameFileResult } from "../workspace/state/useWorkspaceFiles";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type { WorkspaceFile, WorkspaceFolder } from "../workspace/workspaceStorage";
import { getWorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { getWorkspaceMenuCopy } from "../workspace/workspaceLocale";
import { WorkspaceFileExplorer } from "../workspace/explorer/WorkspaceFileExplorer";
import { useFileTreeCollapseState } from "./useFileTreeCollapseState";
import type { WorkspaceContextSummaryViewModel } from "../workspace/workspaceContextSummary";
import { getWorkspaceStatusIndicator } from "../workspace/workspaceStatusIndicator";
import { SidePanelTabs } from "../workspace/components/SidePanelTabs";
import { WorkspaceSearchPanel } from "./WorkspaceSearchPanel";
import { WorkspaceKnowledgePanel } from "./WorkspaceKnowledgePanel";
import { WorkspaceChecksPanel } from "./WorkspaceChecksPanel";
import { WorkspaceLibrariesPanel } from "./WorkspaceLibrariesPanel";
import { buildWorkspaceSearchIndex } from "../workspace/workspaceSearchIndex";
import {
  buildWorkspaceKnowledgeBrowseModel,
  type WorkspaceKnowledgeFilters,
} from "../workspace/workspaceKnowledgeBrowseModel";

export type LeftPanelProps = {
  isOpen: boolean;
  view: LeftPanelView;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  knowledgeIndexSource: "none" | "worker" | "fallback";
  knowledgeIndex?: WorkspaceKnowledgeIndex;
  knowledgeIndexPending: boolean;
  activeFileId: string;
  isLiveWorkspace: boolean;
  language: WorkspaceLanguage;
  workspaceContextSummary: WorkspaceContextSummaryViewModel;
  workspaceMenuOpen: boolean;
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
  onSetView: (view: LeftPanelView) => void;
  onToggleWorkspaceMenu: () => void;
  onOpenPreferences: () => void;
  overlayMode?: boolean;
  panelRef?: RefObject<HTMLElement | null>;
};

export function LeftPanel({
  isOpen,
  view,
  files,
  folders,
  knowledgeIndexSource,
  knowledgeIndex,
  knowledgeIndexPending,
  activeFileId,
  isLiveWorkspace,
  language,
  workspaceContextSummary,
  workspaceMenuOpen,
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
  onSetView,
  onToggleWorkspaceMenu,
  onOpenPreferences,
  overlayMode = false,
  panelRef,
}: LeftPanelProps) {
  const copy = getWorkspaceInterfaceCopy(language).sidePanel;
  const menuCopy = getWorkspaceMenuCopy(language);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const [knowledgeFilters, setKnowledgeFilters] = useState<WorkspaceKnowledgeFilters>({ fields: {} });
  const workspaceSearchIndex = useMemo(
    () => buildWorkspaceSearchIndex(files, folders),
    [files, folders],
  );
  const knowledgeBrowseModel = useMemo(
    () => buildWorkspaceKnowledgeBrowseModel(workspaceSearchIndex, knowledgeIndex),
    [knowledgeIndex, workspaceSearchIndex],
  );
  const {
    collapsedFolderIds,
    toggleFolderCollapsed,
    collapseAllFolders,
    expandAllFolders,
  } = useFileTreeCollapseState();

  if (!isOpen) return null;

  const status = getWorkspaceStatusIndicator(workspaceContextSummary);
  const statusContext = workspaceContextSummary.items.find(
    (item) => item.kind === status.kind,
  ) ?? workspaceContextSummary.primary;
  const StatusIcon = status.tone === "attention"
    ? TriangleAlert
    : status.tone === "working"
      ? LoaderCircle
      : status.kind === "collaboration"
        ? Radio
        : status.kind === "folder"
          ? FolderOpen
          : HardDrive;
  const panelTitle = view === "search"
    ? copy.search.label
    : view === "checks"
      ? copy.checks.label
      : copy.tabs[view];
  const tabs = [
    { view: "files", label: copy.tabs.files, icon: <Files size={14} /> },
    { view: "search", label: copy.search.label, icon: <Search size={14} /> },
    { view: "knowledge", label: copy.tabs.knowledge, icon: <BookOpenText size={14} /> },
    { view: "libraries", label: copy.tabs.libraries, icon: <LibraryBig size={14} /> },
  ] satisfies Array<{ view: LeftPanelView; label: string; icon: ReactNode }>;

  return (
    <aside
      ref={panelRef}
      className="left-panel"
      role={overlayMode ? SIDE_PANEL_OVERLAY_ACCESSIBILITY.role : undefined}
      aria-modal={overlayMode && SIDE_PANEL_OVERLAY_ACCESSIBILITY.ariaModal ? true : undefined}
      aria-label={panelTitle}
      tabIndex={overlayMode ? -1 : undefined}
      data-knowledge-index-source={knowledgeIndexSource}
      data-live-workspace={isLiveWorkspace || undefined}
    >
      <header className="left-panel-header">
        <SidePanelTabs
          activeView={view}
          ariaLabel={copy.sections}
          controls="left-panel-body"
          items={tabs}
          onSelect={onSetView}
          side="left"
        />
      </header>

      <div className={`left-panel-body ${view}`} id="left-panel-body">
        {view === "files" && (
          <section className="left-panel-files" aria-label={copy.tabs.files}>
            <WorkspaceFileExplorer
              files={files}
              folders={folders}
              activeFileId={activeFileId}
              copy={copy.files}
              collapsedFolderIds={collapsedFolderIds}
              showWorkspaceIdentity
              onNewFile={(parentId) => onNewFile(parentId ? { parentId } : undefined)}
              onNewFolder={onNewFolder}
              onImportFile={onImportFile}
              onToggleFolder={toggleFolderCollapsed}
              onCollapseAllFolders={collapseAllFolders}
              onExpandAllFolders={expandAllFolders}
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
          </section>
        )}
        {view === "search" && (
          <WorkspaceSearchPanel
            copy={copy.search}
            entries={workspaceSearchIndex}
            query={workspaceSearchQuery}
            onQueryChange={setWorkspaceSearchQuery}
            onSelectFile={onSelectFile}
          />
        )}
        {view === "knowledge" && (
          <WorkspaceKnowledgePanel
            activeFileId={activeFileId}
            copy={copy.knowledge}
            entries={workspaceSearchIndex}
            filters={knowledgeFilters}
            model={knowledgeBrowseModel}
            onFiltersChange={setKnowledgeFilters}
            onSelectFile={onSelectFile}
          />
        )}
        {view === "libraries" && (
          <WorkspaceLibrariesPanel copy={copy.libraries} />
        )}
        {view === "checks" && (
          <WorkspaceChecksPanel
            activeFileId={activeFileId}
            copy={copy.checks}
            entries={workspaceSearchIndex}
            knowledgeIndexPending={knowledgeIndexPending}
            model={knowledgeBrowseModel}
            onSelectFile={onSelectFile}
          />
        )}
      </div>
      <footer className="left-panel-utilities">
        <button
          className={`left-panel-status-button ${status.tone}${workspaceMenuOpen ? " active" : ""}`}
          type="button"
          aria-label={`${statusContext.title} · ${status.description}`}
          aria-expanded={workspaceMenuOpen}
          data-workspace-context={status.kind}
          data-workspace-state={statusContext.state}
          data-tooltip={`${statusContext.title} · ${status.description}`}
          onClick={onToggleWorkspaceMenu}
        >
          <StatusIcon
            className={status.tone === "working" ? "workspace-identity-spinner" : undefined}
            size={16}
            aria-hidden="true"
          />
        </button>
        <button
          className={`left-panel-checks-button${view === "checks" ? " active" : ""}`}
          type="button"
          aria-label={copy.checks.label}
          aria-controls="left-panel-body"
          aria-pressed={view === "checks"}
          data-tooltip={knowledgeBrowseModel.reviewIssueCount > 0
            ? copy.checks.attention
            : copy.checks.label}
          onClick={() => onSetView("checks")}
        >
          <CircleAlert size={16} aria-hidden="true" />
          {knowledgeBrowseModel.reviewIssueCount > 0 && (
            <span className="left-panel-utility-indicator" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label={menuCopy.actions.preferences}
          data-tooltip={menuCopy.actions.preferences}
          onClick={onOpenPreferences}
        >
          <Settings2 size={16} aria-hidden="true" />
        </button>
      </footer>
    </aside>
  );
}
