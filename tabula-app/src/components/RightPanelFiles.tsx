import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCopy,
  Copy,
  CornerUpLeft,
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

type RightPanelFilesCopy = WorkspaceInterfaceCopy["sidePanel"]["files"];

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
  collapsedFolderIds: Set<string>;
  copy: RightPanelFilesCopy;
  onNewFile: () => void;
  onNewFolder: (parentId?: string) => WorkspaceFolder | undefined;
  onImportFile: () => void;
  onToggleFolder: (folderId: string) => void;
  onCollapseAllFolders: (folderIds: Iterable<string>) => void;
  onExpandAllFolders: () => void;
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

const RIGHT_TREE_INDENT = 16;
const MOVE_SEARCH_THRESHOLD = 12;
const FOLDER_AUTO_EXPAND_DELAY = 600;

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
  const isVirtualRoot = root.id === WORKSPACE_ROOT_FOLDER_ID;
  if (!isVirtualRoot) rows.push({ node: root, depth });
  if (!collapsedFolderIds.has(root.id)) {
    const childDepth = isVirtualRoot ? depth : depth + 1;
    for (const childNode of root.children) {
      if (childNode.type === "folder") {
        flattenVisibleFileTree(childNode, collapsedFolderIds, rows, childDepth);
      } else {
        rows.push({ node: childNode, depth: childDepth });
      }
    }
  }

  return rows;
};

export const pruneEmptyFileTreeFolders = (
  root: FileTreeFolderNode,
): FileTreeFolderNode => {
  const pruneFolder = (folder: FileTreeFolderNode): FileTreeFolderNode | null => {
    const children: FileTreeNode[] = [];
    for (const child of folder.children) {
      if (child.type === "file") {
        children.push(child);
        continue;
      }
      const nextFolder = pruneFolder(child);
      if (nextFolder) children.push(nextFolder);
    }
    if (folder.id !== WORKSPACE_ROOT_FOLDER_ID && children.length === 0) return null;
    return { ...folder, children };
  };

  return pruneFolder(root) ?? { ...root, children: [] };
};

type MoveTarget = {
  type: "file" | "folder";
  id: string;
  title: string;
  parentId: string | null;
};

export type MoveDestinationRow = {
  folderId: string;
  label: string;
  depth: number;
  current: boolean;
  disabled: boolean;
  root: boolean;
};

export const getMoveDestinationRows = (
  folders: WorkspaceFolder[],
  moveTarget: MoveTarget,
  folderDisplayTitles = getWorkspaceFolderDisplayTitles(folders),
  query = "",
): MoveDestinationRow[] => {
  const invalidFolderIds = new Set<string>();
  if (moveTarget.type === "folder") {
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

  const currentFolderId = moveTarget.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
  const tree = buildFileTree([], folders, new Map(), folderDisplayTitles);
  const folderRows = flattenVisibleFileTree(tree, new Set())
    .filter((row): row is VisibleFileTreeRow & { node: FileTreeFolderNode } => row.node.type === "folder")
    .map(({ node, depth }) => ({
      folderId: node.id,
      label: node.name,
      depth,
      current: node.id === currentFolderId,
      disabled: invalidFolderIds.has(node.id) || node.id === currentFolderId,
      root: false,
    }));
  const rows: MoveDestinationRow[] = [
    {
      folderId: WORKSPACE_ROOT_FOLDER_ID,
      label: "",
      depth: 0,
      current: currentFolderId === WORKSPACE_ROOT_FOLDER_ID,
      disabled: currentFolderId === WORKSPACE_ROOT_FOLDER_ID,
      root: true,
    },
    ...folderRows,
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return normalizedQuery
    ? rows.filter((row) => row.root || row.label.toLocaleLowerCase().includes(normalizedQuery))
    : rows;
};

export function RightPanelFiles({
  files,
  folders,
  activeFileId,
  collapsedFolderIds,
  copy,
  onNewFile,
  onNewFolder,
  onImportFile,
  onToggleFolder,
  onCollapseAllFolders,
  onExpandAllFolders,
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
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [moveQuery, setMoveQuery] = useState("");
  const [draggedItem, setDraggedItem] = useState<MoveTarget | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const autoExpandTimerRef = useRef<number | null>(null);
  const autoExpandFolderIdRef = useRef<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const folderRenameInputRef = useRef<HTMLInputElement | null>(null);
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const fileButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const { folderDisplayTitles, visibleRows } = useMemo(() => {
    const nextFolderDisplayTitles = getWorkspaceFolderDisplayTitles(folders);
    const nextFileTreeRoot = buildFileTree(
      files,
      folders,
      getWorkspaceFileDisplayTitles(files),
      nextFolderDisplayTitles,
    );
    return {
      folderDisplayTitles: nextFolderDisplayTitles,
      visibleRows: flattenVisibleFileTree(nextFileTreeRoot, collapsedFolderIds),
    };
  }, [collapsedFolderIds, files, folders]);
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
  const moveFolderOptions = useMemo(
    () => moveTarget
      ? getMoveDestinationRows(folders, moveTarget, folderDisplayTitles, moveQuery)
      : [],
    [folderDisplayTitles, folders, moveQuery, moveTarget],
  );
  const showMoveSearch = folders.length - 1 >= MOVE_SEARCH_THRESHOLD;
  const validDropFolderIds = useMemo(
    () => new Set(
      draggedItem
        ? getMoveDestinationRows(folders, draggedItem, folderDisplayTitles)
          .filter((destination) => !destination.disabled)
          .map((destination) => destination.folderId)
        : [],
    ),
    [draggedItem, folderDisplayTitles, folders],
  );
  const collapsibleFolderIds = useMemo(
    () => folders
      .filter((folder) => folder.id !== WORKSPACE_ROOT_FOLDER_ID)
      .map((folder) => folder.id),
    [folders],
  );
  const allFoldersCollapsed = collapsibleFolderIds.length > 0
    && collapsibleFolderIds.every((folderId) => collapsedFolderIds.has(folderId));

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

  useLayoutEffect(() => {
    if (!renamingFolderId) return;
    const frame = window.requestAnimationFrame(() => {
      folderRenameInputRef.current?.focus();
      folderRenameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [renamingFolderId]);

  useEffect(() => () => {
    if (autoExpandTimerRef.current !== null) {
      window.clearTimeout(autoExpandTimerRef.current);
    }
  }, []);

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

  const clearAutoExpandTimer = () => {
    if (autoExpandTimerRef.current === null) return;
    window.clearTimeout(autoExpandTimerRef.current);
    autoExpandTimerRef.current = null;
    autoExpandFolderIdRef.current = null;
  };

  const finishDragging = () => {
    clearAutoExpandTimer();
    setDraggedItem(null);
    setDropTargetFolderId(null);
  };

  const startDragging = (event: ReactDragEvent<HTMLElement>, target: MoveTarget) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", target.id);
    setDraggedItem(target);
  };

  const prepareDrop = (
    event: ReactDragEvent<HTMLElement>,
    folderId: string,
    options: { autoExpand?: boolean } = {},
  ) => {
    if (!draggedItem || !validDropFolderIds.has(folderId)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTargetFolderId(folderId);

    if (
      options.autoExpand
      && collapsedFolderIds.has(folderId)
      && autoExpandFolderIdRef.current !== folderId
    ) {
      clearAutoExpandTimer();
      autoExpandFolderIdRef.current = folderId;
      autoExpandTimerRef.current = window.setTimeout(() => {
        onToggleFolder(folderId);
        autoExpandTimerRef.current = null;
        autoExpandFolderIdRef.current = null;
      }, FOLDER_AUTO_EXPAND_DELAY);
    } else if (!options.autoExpand || !collapsedFolderIds.has(folderId)) {
      clearAutoExpandTimer();
    }
  };

  const dropItem = (event: ReactDragEvent<HTMLElement>, folderId: string) => {
    if (!draggedItem || !validDropFolderIds.has(folderId)) return;
    event.preventDefault();
    event.stopPropagation();
    if (draggedItem.type === "file") onMoveFileToFolder(draggedItem.id, folderId);
    else onMoveFolder(draggedItem.id, folderId);
    finishDragging();
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
      const folderIsDragging = draggedItem?.type === "folder" && draggedItem.id === node.id;
      const folderIsDropTarget = dropTargetFolderId === node.id;

      return (
        <li
          ref={treeVirtualizer.measureElement}
          className={`right-file-tree-node folder ${folderIsDragging ? "dragging" : ""} ${folderIsDropTarget ? "drop-target" : ""}`.trim()}
          data-index={virtualRow.index}
          key={node.id}
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={!folderCollapsed}
          draggable={!folderIsRenaming}
          onDragStart={(event) => startDragging(event, {
            type: "folder",
            id: node.id,
            title: node.name,
            parentId: node.folder.parentId,
          })}
          onDragEnd={finishDragging}
          onDragOver={(event) => prepareDrop(event, node.id, { autoExpand: true })}
          onDrop={(event) => dropItem(event, node.id)}
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
                className="right-file-folder-icon"
              >
                <Folder size={16} />
              </span>
              {folderIsRenaming ? (
                <input
                  ref={folderRenameInputRef}
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
    const fileIsDragging = draggedItem?.type === "file" && draggedItem.id === file.id;
    const fileParentId = file.parentId ?? WORKSPACE_ROOT_FOLDER_ID;

    return (
      <li
        ref={treeVirtualizer.measureElement}
        className={`right-file-tree-node file ${fileIsDragging ? "dragging" : ""}`.trim()}
        data-index={virtualRow.index}
        key={node.id}
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={isActiveFile}
        draggable={!isRenaming}
        onDragStart={(event) => startDragging(event, {
          type: "file",
          id: file.id,
          title: file.title,
          parentId: file.parentId ?? null,
        })}
        onDragEnd={finishDragging}
        onDragOver={(event) => prepareDrop(event, fileParentId)}
        onDrop={(event) => dropItem(event, fileParentId)}
        style={virtualStyle}
      >
        <div
          className={`right-row right-file-tree-row file ${isActiveFile ? "active" : ""} ${isRenaming ? "renaming" : ""}`}
          style={{ paddingLeft: `${depth * RIGHT_TREE_INDENT}px` }}
          title={file.title}
        >
          {isRenaming ? (
            <div className="right-file-open-button">
              <span className="right-file-chevron-spacer" aria-hidden="true" />
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
                <span className="right-file-chevron-spacer" aria-hidden="true" />
                <span
                  className="right-file-document-icon"
                  data-tooltip={copy.open(file.title)}
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
      <div className="right-file-toolbar">
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
                <MenuItem icon={<FilePlus2 size={16} />} label={copy.newDocument} onSelect={onNewFile} />
                <MenuItem
                  icon={<FolderPlus size={16} />}
                  label={copy.newFolder}
                  onSelect={() => createAndRenameFolder()}
                />
              </MenuContent>
            </MenuRoot>
      </div>
      {visibleRows.length > 0 ? (
        <div
          className={`right-file-tree-scroll ${dropTargetFolderId === WORKSPACE_ROOT_FOLDER_ID ? "root-drop-target" : ""}`.trim()}
          ref={treeScrollRef}
          onDragOver={(event) => prepareDrop(event, WORKSPACE_ROOT_FOLDER_ID)}
          onDrop={(event) => dropItem(event, WORKSPACE_ROOT_FOLDER_ID)}
        >
          <ol
            className="right-file-tree virtual"
            aria-label={copy.tree}
            role="tree"
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
        {showMoveSearch && (
          <input
            className="move-workspace-item-search"
            type="search"
            value={moveQuery}
            placeholder={copy.searchFolders}
            aria-label={copy.searchFolders}
            data-modal-initial-focus
            onChange={(event) => setMoveQuery(event.target.value)}
          />
        )}
        <div className="move-workspace-item-list">
          {moveFolderOptions.length === 0 && (
            <p className="move-workspace-item-empty">{copy.noFoldersFound}</p>
          )}
          {moveFolderOptions.map((destination) => {
            const label = destination.root ? copy.topLevel : destination.label;
            return (
              <button
                className={`${destination.current ? "current" : ""} ${destination.root ? "root" : ""}`.trim()}
                type="button"
                disabled={destination.disabled}
                aria-label={destination.current ? `${label} · ${copy.currentLocation}` : label}
                onClick={() => moveItemToFolder(destination.folderId)}
                key={destination.folderId}
                style={{ "--move-destination-depth": destination.depth } as CSSProperties}
              >
                {destination.root
                  ? <CornerUpLeft size={16} aria-hidden="true" />
                  : <Folder size={16} aria-hidden="true" />}
                <span>{label}</span>
                {destination.current && <Check size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </ModalSurface>
    )}
    </>
  );
}
