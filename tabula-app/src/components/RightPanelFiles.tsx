import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import type { RenameFileResult } from "../hooks/useWorkspaceFiles";
import { WORKSPACE_ROOT_FOLDER_ID, type WorkspaceFile, type WorkspaceFolder } from "../workspaceStorage";
import {
  getWorkspaceFileDisplayTitles,
  getWorkspaceFolderDisplayTitles,
} from "../workspaceDisplayTitles";
import { useDismissibleMenu } from "../hooks/useDismissibleMenu";
import type { WorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";

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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const actionMenuRef = useRef<HTMLElement | null>(null);
  const actionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
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

  const closeActionMenu = useCallback(() => {
    setActionMenuFileId(null);
    setActionMenuFolderId(null);
  }, []);
  const closeCreateMenu = useCallback(() => setCreateMenuOpen(false), []);
  const handleActionMenuKeyDown = useDismissibleMenu({
    menuRef: actionMenuRef,
    onClose: closeActionMenu,
    open: Boolean(actionMenuFileId || actionMenuFolderId),
    triggerRef: actionMenuTriggerRef,
  });
  const handleCreateMenuKeyDown = useDismissibleMenu({
    menuRef: createMenuRef,
    onClose: closeCreateMenu,
    open: createMenuOpen,
    triggerRef: createButtonRef,
  });

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
          style={{ ...virtualStyle, zIndex: folderMenuOpen ? 1 : undefined }}
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
                <span className="right-file-menu-wrap">
                  <button
                    className="right-file-action"
                    type="button"
                    aria-label={copy.moreActions(node.name)}
                    data-tooltip={copy.moreActions(node.name)}
                    onClick={(event) => {
                      actionMenuTriggerRef.current = event.currentTarget;
                      setActionMenuFolderId(folderMenuOpen ? null : node.id);
                    }}
                  >
                    <Ellipsis size={14} />
                  </button>
                  {folderMenuOpen && (
                    <span
                      ref={actionMenuRef}
                      className="right-file-action-menu ui-menu ui-command-menu"
                      role="menu"
                      aria-label={copy.actions(node.name)}
                      onKeyDown={handleActionMenuKeyDown}
                    >
                      <button type="button" role="menuitem" onClick={() => {
                        setActionMenuFolderId(null);
                        createAndRenameFolder(node.id);
                      }}>
                        <Folder size={14} /><span>{copy.newSubfolder}</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setActionMenuFolderId(null); setRenamingFolderId(node.id); setRenamingFolderTitle(node.name); }}>
                        <PencilLine size={14} /><span>{copy.rename}</span>
                      </button>
                      <label className="right-file-move-field">
                        <FolderInput size={14} />
                        <span>{copy.moveTo}</span>
                        <select value={node.folder.parentId ?? WORKSPACE_ROOT_FOLDER_ID} aria-label={copy.move(node.name)} onChange={(event) => { onMoveFolder(node.id, event.target.value); setActionMenuFolderId(null); }}>
                          {folders.filter((folder) => folder.id !== node.id).map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folderDisplayTitles.get(folder.id) ?? folder.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="danger" type="button" role="menuitem" onClick={() => { setActionMenuFolderId(null); onDeleteFolder(node.id); }}>
                        <Trash2 size={14} /><span>{copy.delete}</span>
                      </button>
                    </span>
                  )}
                </span>
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
        style={{ ...virtualStyle, zIndex: menuOpen ? 1 : undefined }}
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
                <span className="right-file-menu-wrap">
                  <button
                    className="right-file-action"
                    type="button"
                    aria-label={copy.moreActions(file.title)}
                    data-tooltip={copy.moreActions(file.title)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={(event) => {
                      event.stopPropagation();
                      actionMenuTriggerRef.current = event.currentTarget;
                      setActionMenuFileId(menuOpen ? null : file.id);
                    }}
                  >
                    <Ellipsis size={14} />
                  </button>
                  {menuOpen && (
                    <span
                      ref={actionMenuRef}
                      className="right-file-action-menu ui-menu ui-command-menu"
                      role="menu"
                      aria-label={copy.actions(file.title)}
                      onKeyDown={handleActionMenuKeyDown}
                    >
                      <button role="menuitem" type="button" onClick={() => startRenamingFile(file)}>
                        <PencilLine size={14} />
                        <span>{copy.rename}</span>
                      </button>
                      <button role="menuitem" type="button" onClick={() => { setActionMenuFileId(null); onCopyFile(file.id); }}>
                        <ClipboardCopy size={14} />
                        <span>{copy.copyMarkdown}</span>
                      </button>
                      <button role="menuitem" type="button" onClick={() => duplicateFileFromMenu(file.id)}>
                        <Copy size={14} />
                        <span>{copy.duplicate}</span>
                      </button>
                      <label className="right-file-move-field">
                        <FolderInput size={14} />
                        <span>{copy.moveTo}</span>
                        <select value={file.parentId ?? WORKSPACE_ROOT_FOLDER_ID} aria-label={copy.move(file.title)} onChange={(event) => { onMoveFileToFolder(file.id, event.target.value); setActionMenuFileId(null); }}>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folderDisplayTitles.get(folder.id) ?? folder.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="danger"
                        role="menuitem"
                        type="button"
                        onClick={() => deleteFileFromMenu(file.id)}
                      >
                        <Trash2 size={14} />
                        <span>{copy.delete}</span>
                      </button>
                    </span>
                  )}
                </span>
              </span>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
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
        <div className="right-file-create-menu-wrap">
          <button
            ref={createButtonRef}
            className={`right-file-create-button ${createMenuOpen ? "active" : ""}`}
            type="button"
            aria-label={copy.create}
            data-tooltip={copy.create}
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
            onClick={() => setCreateMenuOpen((open) => !open)}
          >
            <Plus size={16} />
          </button>
          {createMenuOpen && (
            <div
              ref={createMenuRef}
              className="right-file-create-menu ui-menu ui-command-menu"
              role="menu"
              aria-label={copy.createInWorkspace}
              onKeyDown={handleCreateMenuKeyDown}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setCreateMenuOpen(false);
                  onNewFile();
                }}
              >
                <FilePlus2 size={16} />
                <span>{copy.newDocument}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setCreateMenuOpen(false);
                  createAndRenameFolder();
                }}
              >
                <FolderPlus size={16} />
                <span>{copy.newFolder}</span>
              </button>
            </div>
          )}
        </div>
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
  );
}
