import type { RefObject } from "react";
import { useState } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  FilePlus2,
  FolderPlus,
  Plus,
  Upload,
} from "lucide-react";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "../../ui/Menu";
import type { WorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";

type ExplorerCopy = WorkspaceInterfaceCopy["sidePanel"]["files"];

type WorkspaceExplorerToolbarProps = {
  allFoldersCollapsed: boolean;
  collapsibleFolderIds: string[];
  copy: ExplorerCopy;
  onCancelRename: () => void;
  onCollapseAllFolders: (folderIds: Iterable<string>) => void;
  onCommitRename: () => void;
  onCreateDocument: () => void;
  onCreateFolder: () => void;
  onExpandAllFolders: () => void;
  onImportFile: () => void;
  onRenameTitleChange: (title: string) => void;
  onStartRename: () => void;
  renaming: boolean;
  renameInputRef: RefObject<HTMLInputElement | null>;
  renameTitle: string;
  showWorkspaceIdentity: boolean;
  workspaceName: string;
};

export function WorkspaceExplorerToolbar({
  allFoldersCollapsed,
  collapsibleFolderIds,
  copy,
  onCancelRename,
  onCollapseAllFolders,
  onCommitRename,
  onCreateDocument,
  onCreateFolder,
  onExpandAllFolders,
  onImportFile,
  onRenameTitleChange,
  onStartRename,
  renaming,
  renameInputRef,
  renameTitle,
  showWorkspaceIdentity,
  workspaceName,
}: WorkspaceExplorerToolbarProps) {
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  return (
    <div className="right-file-toolbar">
      {showWorkspaceIdentity && (
        <div className="right-file-workspace-identity">
          {renaming ? (
            <input
              ref={renameInputRef}
              className="ui-input-surface right-file-workspace-name-input"
              value={renameTitle}
              aria-label={copy.renameInPanel(workspaceName)}
              onChange={(event) => onRenameTitleChange(event.target.value)}
              onBlur={onCommitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") onCommitRename();
                if (event.key === "Escape") onCancelRename();
              }}
            />
          ) : (
            <button
              className="right-file-workspace-name"
              type="button"
              aria-label={copy.renameInPanel(workspaceName)}
              data-tooltip={copy.rename}
              onClick={onStartRename}
            >
              {workspaceName}
            </button>
          )}
        </div>
      )}
      <div className="right-file-toolbar-actions">
        {collapsibleFolderIds.length > 0 && (
          <button
            className="right-file-toolbar-button"
            type="button"
            aria-label={allFoldersCollapsed ? copy.expandAll : copy.collapseAll}
            data-tooltip={allFoldersCollapsed ? copy.expandAll : copy.collapseAll}
            onClick={() => {
              if (allFoldersCollapsed) onExpandAllFolders();
              else onCollapseAllFolders(collapsibleFolderIds);
            }}
          >
            {allFoldersCollapsed
              ? <ChevronsUpDown size={16} />
              : <ChevronsDownUp size={16} />}
          </button>
        )}
        <button
          className="right-file-toolbar-button"
          type="button"
          aria-label={copy.openMarkdown}
          data-tooltip={copy.openMarkdown}
          onClick={onImportFile}
        >
          <Upload size={16} />
        </button>
        <MenuRoot open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
          <div className="right-file-create-menu-wrap">
            <MenuTrigger asChild>
              <button
                className={`right-file-toolbar-button ${createMenuOpen ? "active" : ""}`}
                type="button"
                aria-label={copy.create}
                data-tooltip={copy.create}
              >
                <Plus size={16} />
              </button>
            </MenuTrigger>
          </div>
          <MenuContent
            className="right-file-create-menu"
            ariaLabel={copy.createInWorkspace}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <MenuItem icon={<FilePlus2 size={16} />} label={copy.newDocument} onSelect={onCreateDocument} />
            <MenuItem icon={<FolderPlus size={16} />} label={copy.newFolder} onSelect={onCreateFolder} />
          </MenuContent>
        </MenuRoot>
      </div>
    </div>
  );
}
