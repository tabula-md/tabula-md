import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { type KeyboardEvent as ReactKeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Ellipsis,
  File,
  FilePlus2,
  Folder,
  FolderInput,
  FolderPlus,
  PencilLine,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { RenameFileResult } from "../hooks/useWorkspaceFiles";
import { WORKSPACE_ROOT_FOLDER_ID, type WorkspaceFile, type WorkspaceFolder } from "../workspaceStorage";
import {
  getWorkspaceFileDisplayTitles,
  getWorkspaceFolderDisplayTitles,
} from "../workspaceDisplayTitles";
import type { WorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "./ui/Menu";
import { ModalSurface } from "./ui/ModalSurface";

type RightPanelFilesCopy = WorkspaceInterfaceCopy["projectContext"]["files"];

type FileTreeFolderNode = {
  type: "folder";
  id: string;
  name: string;
  folder: WorkspaceFolder;
  children: FileTreeNode[];
};

type FileTreeFileNode = {
  type: "file";
  id: string;
  name: string;
  file: WorkspaceFile;
};

type FileTreeNode = FileTreeFolderNode | FileTreeFileNode;

export type VisibleFileTreeRow = {
  node: FileTreeNode;
  depth: number;
};

type RightPanelFilesProps = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  activeFileId: string;
  fileQuery: string;
  isLiveWorkspace: boolean;
  collapsedFolderIds: Set<string>;
  copy: RightPanelFilesCopy;
  getFileSearchText: (file: WorkspaceFile) => string;
  onFileQueryChange: (query: string) => void;
  onNewFile: () => void;
  onNewFolder: (parentId?: string) => WorkspaceFolder | undefined;
  onImportFile: () => void;
  onToggleFolder: (folderId: string) => void;
  onSelectFile: (fileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCopyFile: (fileId: string) => void;
  onMoveFileToFolder: (fileId: string, folderId: string) => void;
  onMoveFolder: (folderId: string, parentId: string) => void;
  onRenameFolder: (folderId: string, nextTitle: string) => boolean;
};

const RIGHT_TREE_INDENT = 20;

const getFileDisplayTitle = (title: string) => title.replace(/\.(?:md|markdown)$/i, "");

const compareFileTreeNodes = (firstNode: FileTreeNode, secondNode: FileTreeNode) => {
  if (firstNode.type !== secondNode.type) {
    return firstNode.type === "folder" ? -1 : 1;
  }

  return firstNode.name.localeCompare(secondNode.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const sortFileTree = (folderNode: FileTreeFolderNode) => {
  folderNode.children.sort(compareFileTreeNodes);
  for (const childNode of folderNode.children) {
    if (childNode.type === "folder") {
      sortFileTree(childNode);
    }
  }
  return folderNode;
};

export const buildFileTree = (
  files: WorkspaceFile[],
  folders: WorkspaceFolder[],
  displayTitles = getWorkspaceFileDisplayTitles(files),
  folderDisplayTitles = getWorkspaceFolderDisplayTitles(folders),
): FileTreeFolderNode => {
  const rootFolder = folders.find((folder) => folder.id === WORKSPACE_ROOT_FOLDER_ID) ?? {
    id: WORKSPACE_ROOT_FOLDER_ID,
    title: "Project",
    parentId: null,
  };
  const rootNode: FileTreeFolderNode = {
    type: "folder",
    id: rootFolder.id,
    name: rootFolder.title,
    folder: rootFolder,
    children: [],
  };

  const nodesById = new Map<string, FileTreeFolderNode>([[rootNode.id, rootNode]]);
  const pendingFolders = folders.filter((folder) => folder.id !== rootNode.id);
  let attempts = 0;
  while (pendingFolders.length > 0 && attempts <= folders.length) {
    attempts += 1;
    for (let index = pendingFolders.length - 1; index >= 0; index -= 1) {
      const folder = pendingFolders[index];
      const parent = nodesById.get(folder.parentId ?? rootNode.id);
      if (!parent) continue;
      const node: FileTreeFolderNode = {
        type: "folder",
        id: folder.id,
        name: folderDisplayTitles.get(folder.id) ?? folder.title,
        folder,
        children: [],
      };
      parent.children.push(node);
      nodesById.set(folder.id, node);
      pendingFolders.splice(index, 1);
    }
  }
  for (const folder of pendingFolders) {
    const node: FileTreeFolderNode = {
      type: "folder",
      id: folder.id,
      name: folderDisplayTitles.get(folder.id) ?? folder.title,
      folder,
      children: [],
    };
    rootNode.children.push(node);
    nodesById.set(folder.id, node);
  }

  for (const file of files) {
    const parent = nodesById.get(file.parentId ?? rootNode.id) ?? rootNode;
    parent.children.push({
      type: "file",
      id: file.id,
      name: displayTitles.get(file.id) ?? file.title,
      file,
    });
  }

  return sortFileTree(rootNode);
};

export const flattenVisibleFileTree = (
  root: FileTreeFolderNode,
  collapsedFolderIds: Set<string>,
  rows: VisibleFileTreeRow[] = [],
  depth = 0,
) => {
  rows.push({ node: root, depth });
  if (!collapsedFolderIds.has(root.id)) {
    for (const childNode of root.children) {
      if (childNode.type === "folder") {
        flattenVisibleFileTree(childNode, collapsedFolderIds, rows, depth + 1);
      } else {
        rows.push({ node: childNode, depth: depth + 1 });
      }
    }
  }

  return rows;
};

export function RightPanelFiles({
  files,
  folders,
  activeFileId,
  fileQuery,
  isLiveWorkspace,
  collapsedFolderIds,
  copy,
  getFileSearchText,
  onFileQueryChange,
  onNewFile,
  onNewFolder,
  onImportFile,
  onToggleFolder,
  onSelectFile,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onDeleteFolder,
  onCopyFile,
  onMoveFileToFolder,
  onMoveFolder,
  onRenameFolder,
}: RightPanelFilesProps) {
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [actionMenuFileId, setActionMenuFileId] = useState<string | null>(null);
  const [actionMenuFolderId, setActionMenuFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderTitle, setRenamingFolderTitle] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{
    type: "file" | "folder";
    id: string;
    title: string;
    parentId: string | null;
  } | null>(null);
  const [moveQuery, setMoveQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const fileButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const normalizedQuery = fileQuery.trim().toLowerCase();
  const hasLiveWorkspace = isLiveWorkspace;
  const { visibleFiles, folderDisplayTitles, fileTreeRoot, visibleRows } = useMemo(() => {
    const nextVisibleFiles = normalizedQuery
      ? files.filter((file) => getFileSearchText(file).toLowerCase().includes(normalizedQuery))
      : files;
    const nextFolderDisplayTitles = getWorkspaceFolderDisplayTitles(folders);
    const nextFileTreeRoot = buildFileTree(
      nextVisibleFiles,
      folders,
      getWorkspaceFileDisplayTitles(files),
      nextFolderDisplayTitles,
    );
    return {
      visibleFiles: nextVisibleFiles,
      folderDisplayTitles: nextFolderDisplayTitles,
      fileTreeRoot: nextFileTreeRoot,
      visibleRows: flattenVisibleFileTree(nextFileTreeRoot, collapsedFolderIds),
    };
  }, [collapsedFolderIds, files, folders, getFileSearchText, normalizedQuery]);
  const visibleFileIds = useMemo(
    () => visibleRows.flatMap((row) => row.node.type === "file" ? [row.node.file.id] : []),
    [visibleRows],
  );
  const rowIndexByFileId = useMemo(
    () => new Map(visibleRows.flatMap((row, index) => row.node.type === "file" ? [[row.node.file.id, index] as const] : [])),
    [visibleRows],
  );
  const treeVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => treeScrollRef.current,
    estimateSize: () => 36,
    getItemKey: (index) => visibleRows[index]?.node.id ?? index,
    overscan: 8,
  });
  const moveFolderOptions = useMemo(() => {
    const invalidFolderIds = new Set<string>();
    if (moveTarget?.type === "folder") {
      invalidFolderIds.add(moveTarget.id);
      let changed = true;
      while (changed) {
        changed = false;
        for (const folder of folders) {
          if (folder.parentId && invalidFolderIds.has(folder.parentId) && !invalidFolderIds.has(folder.id)) {
            invalidFolderIds.add(folder.id);
            changed = true;
          }
        }
      }
    }
    const query = moveQuery.trim().toLowerCase();
    return folders.filter((folder) => {
      if (invalidFolderIds.has(folder.id)) return false;
      if (!query) return true;
      return (folderDisplayTitles.get(folder.id) ?? folder.title).toLowerCase().includes(query);
    });
  }, [folderDisplayTitles, folders, moveQuery, moveTarget]);

  useLayoutEffect(() => {
    if (!renamingFileId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [renamingFileId]);

  const startRenamingFile = (file: WorkspaceFile) => {
    setActionMenuFileId(null);
    setRenamingFileId(file.id);
    setRenamingTitle(getFileDisplayTitle(file.title));
  };

  const cancelRenamingFile = () => {
    setRenamingFileId(null);
    setRenamingTitle("");
  };

  const commitRenamingFile = (fileId: string, nextTitle: string) => {
    const result = onRenameFile(fileId, nextTitle);
    if (result.ok) {
      cancelRenamingFile();
      return true;
    }

    window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
    return false;
  };

  const duplicateFileFromMenu = (fileId: string) => {
    setActionMenuFileId(null);
    onDuplicateFile(fileId);
  };

  const deleteFileFromMenu = (fileId: string) => {
    setActionMenuFileId(null);
    onDeleteFile(fileId);
  };

  const focusFileByOffset = (fileId: string, offset: -1 | 1) => {
    if (visibleFileIds.length === 0) {
      return;
    }

    const currentIndex = Math.max(0, visibleFileIds.indexOf(fileId));
    const nextIndex = Math.min(visibleFileIds.length - 1, Math.max(0, currentIndex + offset));
    const nextFileId = visibleFileIds[nextIndex];
    const nextRowIndex = rowIndexByFileId.get(nextFileId);
    if (nextRowIndex === undefined) return;
    treeVirtualizer.scrollToIndex(nextRowIndex, { align: "auto" });
    window.requestAnimationFrame(() => fileButtonRefs.current.get(nextFileId)?.focus());
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      const firstFileId = visibleFileIds[0];
      if (firstFileId) {
        event.preventDefault();
        onSelectFile(firstFileId);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      const firstFileId = visibleFileIds[0];
      if (firstFileId) {
        event.preventDefault();
        const firstRowIndex = rowIndexByFileId.get(firstFileId);
        if (firstRowIndex !== undefined) treeVirtualizer.scrollToIndex(firstRowIndex, { align: "start" });
        window.requestAnimationFrame(() => fileButtonRefs.current.get(firstFileId)?.focus());
      }
      return;
    }

    if (event.key === "Escape" && fileQuery) {
      event.preventDefault();
      event.stopPropagation();
      onFileQueryChange("");
    }
  };

  const handleFileKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, fileId: string) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusFileByOffset(fileId, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusFileByOffset(fileId, -1);
      return;
    }

    if (event.key === "Escape" && fileQuery) {
      event.preventDefault();
      event.stopPropagation();
      onFileQueryChange("");
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  };

  const createAndRenameFolder = (parentId?: string) => {
    const folder = onNewFolder(parentId);
    if (!folder) return;
    if (parentId && collapsedFolderIds.has(parentId)) onToggleFolder(parentId);
    setRenamingFolderId(folder.id);
    setRenamingFolderTitle(folder.title);
  };

  const openMoveDialog = (target: NonNullable<typeof moveTarget>) => {
    setActionMenuFileId(null);
    setActionMenuFolderId(null);
    setMoveQuery("");
    setMoveTarget(target);
  };

  const moveItemToFolder = (folderId: string) => {
    if (!moveTarget) return;
    if (moveTarget.type === "file") onMoveFileToFolder(moveTarget.id, folderId);
    else onMoveFolder(moveTarget.id, folderId);
    setMoveTarget(null);
    setMoveQuery("");
  };

  const renderFileTreeNode = (node: FileTreeNode, depth: number, virtualRow: VirtualItem) => {
    const virtualStyle = {
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: "100%",
      transform: `translateY(${virtualRow.start}px)`,
    };
    if (node.type === "folder") {
      const folderCollapsed = collapsedFolderIds.has(node.id);
      const isRootFolder = node.id === WORKSPACE_ROOT_FOLDER_ID;
      const folderMenuOpen = actionMenuFolderId === node.id;
      const folderIsRenaming = renamingFolderId === node.id;

      return (
        <li
          ref={treeVirtualizer.measureElement}
          className="right-file-tree-node folder"
          data-index={virtualRow.index}
          key={node.id}
          style={virtualStyle}
        >
          <div
            className="right-row right-file-tree-row folder"
            style={{ paddingLeft: `${depth * RIGHT_TREE_INDENT}px` }}
          >
            <button
              className="right-file-open-button"
              type="button"
              aria-expanded={!folderCollapsed}
              onClick={() => onToggleFolder(node.id)}
            >
              {folderCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span
                className={`right-file-folder-icon ${isRootFolder && hasLiveWorkspace ? "live" : ""}`}
                data-tooltip={isRootFolder && hasLiveWorkspace ? copy.sharedWorkspace : undefined}
              >
                <Folder size={16} />
                {isRootFolder && hasLiveWorkspace && <span className="right-file-icon-live-dot" aria-hidden="true" />}
              </span>
              {folderIsRenaming ? (
                <input
                  className="right-file-rename-input"
                  value={renamingFolderTitle}
                  aria-label={copy.renameFolder(node.name)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setRenamingFolderTitle(event.target.value)}
                  onBlur={() => {
                    if (onRenameFolder(node.id, renamingFolderTitle)) setRenamingFolderId(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && onRenameFolder(node.id, renamingFolderTitle)) setRenamingFolderId(null);
                    if (event.key === "Escape") setRenamingFolderId(null);
                  }}
                  autoFocus
                />
              ) : (
                <span className="right-row-label">{node.name}</span>
              )}
            </button>
            {!isRootFolder && !folderIsRenaming && (
              <span className="right-file-actions">
                <MenuRoot
                  open={folderMenuOpen}
                  onOpenChange={(open) => setActionMenuFolderId(open ? node.id : null)}
                >
                  <span className="right-file-menu-wrap">
                    <MenuTrigger asChild>
                      <button
                        className="right-file-action"
                        type="button"
                        aria-label={copy.moreActions(node.name)}
                        data-tooltip={copy.moreActions(node.name)}
                      >
                        <Ellipsis size={14} />
                      </button>
                    </MenuTrigger>
                  </span>
                  <MenuContent className="right-file-action-menu" ariaLabel={copy.actions(node.name)}>
                    <MenuItem
                      icon={<Folder size={14} />}
                      label={copy.newSubfolder}
                      onSelect={() => createAndRenameFolder(node.id)}
                    />
                    <MenuItem
                      icon={<PencilLine size={14} />}
                      label={copy.rename}
                      onSelect={() => {
                        setRenamingFolderId(node.id);
                        setRenamingFolderTitle(node.name);
                      }}
                    />
                    <MenuItem
                      icon={<FolderInput size={14} />}
                      label={copy.moveTo}
                      onSelect={() => openMoveDialog({
                        type: "folder",
                        id: node.id,
                        title: node.name,
                        parentId: node.folder.parentId,
                      })}
                    />
                    <MenuItem
                      danger
                      icon={<Trash2 size={14} />}
                      label={copy.delete}
                      onSelect={() => onDeleteFolder(node.id)}
                    />
                  </MenuContent>
                </MenuRoot>
              </span>
            )}
          </div>
        </li>
      );
    }

    const file = node.file;
    const isActiveFile = file.id === activeFileId;
    const isRenaming = file.id === renamingFileId;
    const menuOpen = file.id === actionMenuFileId;

    return (
      <li
        ref={treeVirtualizer.measureElement}
        className="right-file-tree-node file"
        data-index={virtualRow.index}
        key={node.id}
        style={virtualStyle}
      >
        <div
          className={`right-row right-file-tree-row file ${isActiveFile ? "active" : ""} ${isRenaming ? "renaming" : ""}`}
          style={{ paddingLeft: `${depth * RIGHT_TREE_INDENT}px` }}
          title={file.title}
        >
          {isRenaming ? (
            <div className="right-file-open-button">
              <span className="right-file-document-icon">
                <File size={16} />
              </span>
              <input
                ref={renameInputRef}
                className="right-file-rename-input"
                type="text"
                defaultValue={renamingTitle}
                aria-label={copy.renameInPanel(file.title)}
                autoComplete="off"
                spellCheck={false}
                onBlur={(event) => {
                  commitRenamingFile(file.id, event.currentTarget.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    commitRenamingFile(file.id, event.currentTarget.value);
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    cancelRenamingFile();
                  }
                }}
              />
            </div>
          ) : (
            <>
              <button
                ref={(button) => {
                  if (button) {
                    fileButtonRefs.current.set(file.id, button);
                  } else {
                    fileButtonRefs.current.delete(file.id);
                  }
                }}
                className="right-file-open-button"
                type="button"
                title={file.title}
                aria-label={copy.open(file.title)}
                onClick={() => onSelectFile(file.id)}
                onKeyDown={(event) => handleFileKeyDown(event, file.id)}
              >
                <span
                  className="right-file-document-icon"
                  data-tooltip={hasLiveWorkspace ? copy.sharedInRoom : copy.localDocument}
                >
                  <File size={16} />
                </span>
                <span className="right-row-label">{getFileDisplayTitle(node.name)}</span>
              </button>
              <span className="right-file-actions" aria-label={copy.actions(file.title)}>
                <MenuRoot
                  open={menuOpen}
                  onOpenChange={(open) => setActionMenuFileId(open ? file.id : null)}
                >
                  <span className="right-file-menu-wrap">
                    <MenuTrigger asChild>
                      <button
                        className="right-file-action"
                        type="button"
                        aria-label={copy.moreActions(file.title)}
                        data-tooltip={copy.moreActions(file.title)}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Ellipsis size={14} />
                      </button>
                    </MenuTrigger>
                  </span>
                  <MenuContent className="right-file-action-menu" ariaLabel={copy.actions(file.title)}>
                    <MenuItem
                      icon={<PencilLine size={14} />}
                      label={copy.rename}
                      onSelect={() => startRenamingFile(file)}
                    />
                    <MenuItem
                      icon={<ClipboardCopy size={14} />}
                      label={copy.copyMarkdown}
                      onSelect={() => onCopyFile(file.id)}
                    />
                    <MenuItem
                      icon={<Copy size={14} />}
                      label={copy.duplicate}
                      onSelect={() => duplicateFileFromMenu(file.id)}
                    />
                    <MenuItem
                      icon={<FolderInput size={14} />}
                      label={copy.moveTo}
                      onSelect={() => openMoveDialog({
                        type: "file",
                        id: file.id,
                        title: file.title,
                        parentId: file.parentId ?? null,
                      })}
                    />
                    <MenuItem
                      danger
                      icon={<Trash2 size={14} />}
                      label={copy.delete}
                      onSelect={() => deleteFileFromMenu(file.id)}
                    />
                  </MenuContent>
                </MenuRoot>
              </span>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
    <section className="right-panel-content right-files-panel">
      <div className="right-file-search-row">
        <input
          ref={searchInputRef}
          className="right-panel-search"
          type="search"
          value={fileQuery}
          placeholder={copy.search}
          aria-label={copy.search}
          onChange={(event) => onFileQueryChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <button
          className="right-file-import-button"
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
                className={`right-file-create-button ${createMenuOpen ? "active" : ""}`}
                type="button"
                aria-label={copy.create}
                data-tooltip={copy.create}
              >
                <Plus size={16} />
              </button>
            </MenuTrigger>
          </div>
          <MenuContent className="right-file-create-menu" ariaLabel={copy.createInWorkspace}>
            <MenuItem icon={<FilePlus2 size={16} />} label={copy.newDocument} onSelect={onNewFile} />
            <MenuItem
              icon={<FolderPlus size={16} />}
              label={copy.newFolder}
              onSelect={() => createAndRenameFolder()}
            />
          </MenuContent>
        </MenuRoot>
      </div>
      {visibleFiles.length > 0 || fileTreeRoot.children.length > 0 ? (
        <div className="right-file-tree-scroll" ref={treeScrollRef}>
          <ol
            className="right-file-tree virtual"
            aria-label={copy.tree}
            style={{ height: `${treeVirtualizer.getTotalSize()}px` }}
          >
            {treeVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = visibleRows[virtualRow.index];
              return row ? renderFileTreeNode(row.node, row.depth, virtualRow) : null;
            })}
          </ol>
        </div>
      ) : (
        <p className="right-empty-state">{copy.noneFound}</p>
      )}
    </section>
    {moveTarget && (
      <ModalSurface
        ariaLabel={copy.move(moveTarget.title)}
        className="move-workspace-item-modal"
        onClose={() => setMoveTarget(null)}
      >
        <header className="move-workspace-item-header">
          <h2>{copy.move(moveTarget.title)}</h2>
          <button
            type="button"
            aria-label={copy.closeMoveDialog}
            data-tooltip={copy.closeMoveDialog}
            onClick={() => setMoveTarget(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <input
          className="move-workspace-item-search"
          type="search"
          value={moveQuery}
          placeholder={copy.searchFolders}
          aria-label={copy.searchFolders}
          data-modal-initial-focus
          onChange={(event) => setMoveQuery(event.target.value)}
        />
        <div className="move-workspace-item-list">
          {moveFolderOptions.length === 0 && (
            <p className="move-workspace-item-empty">{copy.noFoldersFound}</p>
          )}
          {moveFolderOptions.map((folder) => {
            const currentFolderId = moveTarget.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
            const isCurrentFolder = folder.id === currentFolderId;
            const label = folderDisplayTitles.get(folder.id) ?? folder.title;
            return (
              <button
                className={isCurrentFolder ? "active" : ""}
                type="button"
                disabled={isCurrentFolder}
                onClick={() => moveItemToFolder(folder.id)}
                key={folder.id}
              >
                <Folder size={16} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </ModalSurface>
    )}
    </>
  );
}
