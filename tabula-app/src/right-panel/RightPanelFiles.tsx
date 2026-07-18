import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { stripMarkdownExtension } from "@tabula-md/tabula";
import {
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCopy,
  Copy,
  Ellipsis,
  File,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  PencilLine,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type { RenameFileResult } from "../workspace/state/useWorkspaceFiles";
import { WORKSPACE_ROOT_FOLDER_ID, type WorkspaceFile, type WorkspaceFolder } from "../workspace/workspaceStorage";
import {
  buildFileTree,
  flattenVisibleFileTree,
  getValidDropFolderIds,
  type DraggedTreeItem,
  type FileTreeNode,
} from "./fileTreeModel";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRoot,
  ContextMenuTrigger,
} from "../ui/ContextMenu";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "../ui/Menu";
import { PanelEmptyState } from "./PanelEmptyState";

type RightPanelFilesCopy = WorkspaceInterfaceCopy["sidePanel"]["files"];

type RightPanelFilesProps = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  activeFileId: string;
  collapsedFolderIds: Set<string>;
  copy: RightPanelFilesCopy;
  onNewFile: (parentId?: string) => WorkspaceFile | undefined;
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
const FOLDER_AUTO_EXPAND_DELAY = 600;

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
  const [draggedItem, setDraggedItem] = useState<DraggedTreeItem | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const autoExpandTimerRef = useRef<number | null>(null);
  const autoExpandFolderIdRef = useRef<string | null>(null);
  const pendingRenameFrameRef = useRef<number | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const folderRenameInputRef = useRef<HTMLInputElement | null>(null);
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const fileButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const filesBeforeCreateRef = useRef<ReadonlySet<string> | null>(null);
  const visibleRows = useMemo(() => {
    const nextFileTreeRoot = buildFileTree(files, folders);
    return flattenVisibleFileTree(nextFileTreeRoot, collapsedFolderIds);
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
  const validDropFolderIds = useMemo(
    () => draggedItem ? getValidDropFolderIds(folders, draggedItem) : new Set<string>(),
    [draggedItem, folders],
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
    const filesBeforeCreate = filesBeforeCreateRef.current;
    if (!filesBeforeCreate) return;

    const pendingFile = files.find((file) => !filesBeforeCreate.has(file.id));
    if (!pendingFile) return;

    const pendingRowIndex = rowIndexByFileId.get(pendingFile.id);
    if (!pendingFile || pendingRowIndex === undefined) return;

    filesBeforeCreateRef.current = null;
    treeVirtualizer.scrollToIndex(pendingRowIndex, { align: "auto" });
    pendingRenameFrameRef.current = window.requestAnimationFrame(() => {
      pendingRenameFrameRef.current = null;
      setRenamingFileId(pendingFile.id);
      setRenamingTitle(stripMarkdownExtension(pendingFile.title));
    });
  }, [files, rowIndexByFileId, treeVirtualizer]);

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
    if (pendingRenameFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingRenameFrameRef.current);
    }
  }, []);

  const startRenamingFile = (file: WorkspaceFile) => {
    setActionMenuFileId(null);
    setRenamingFileId(file.id);
    setRenamingTitle(stripMarkdownExtension(file.title));
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

  const createAndRenameDocument = (parentId = WORKSPACE_ROOT_FOLDER_ID) => {
    if (collapsedFolderIds.has(parentId)) onToggleFolder(parentId);
    filesBeforeCreateRef.current = new Set(files.map((file) => file.id));
    const file = onNewFile(parentId);
    if (!file) filesBeforeCreateRef.current = null;
  };

  const clearAutoExpandTimer = () => {
    if (autoExpandTimerRef.current !== null) window.clearTimeout(autoExpandTimerRef.current);
    autoExpandTimerRef.current = null;
    autoExpandFolderIdRef.current = null;
  };

  const finishDragging = () => {
    clearAutoExpandTimer();
    setDraggedItem(null);
    setDropTargetFolderId(null);
  };

  const startDragging = (event: ReactDragEvent<HTMLElement>, target: DraggedTreeItem) => {
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
        <ContextMenuRoot key={node.id}>
        <ContextMenuTrigger asChild>
        <li
          ref={treeVirtualizer.measureElement}
          className={`right-file-tree-node folder ${folderIsDragging ? "dragging" : ""} ${folderIsDropTarget ? "drop-target" : ""}`.trim()}
          data-index={virtualRow.index}
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
          onContextMenu={(event) => event.stopPropagation()}
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
              <span
                className="right-file-folder-icon"
              >
                {folderCollapsed ? <Folder size={16} /> : <FolderOpen size={16} />}
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
                      icon={<FilePlus2 size={14} />}
                      label={copy.newDocument}
                      onSelect={() => createAndRenameDocument(node.id)}
                    />
                    <MenuItem
                      icon={<FolderPlus size={14} />}
                      label={copy.newFolder}
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
        </ContextMenuTrigger>
        <ContextMenuContent className="right-file-action-menu" ariaLabel={copy.actions(node.name)}>
          <ContextMenuItem
            icon={<FilePlus2 size={14} />}
            label={copy.newDocument}
            onSelect={() => createAndRenameDocument(node.id)}
          />
          <ContextMenuItem
            icon={<FolderPlus size={14} />}
            label={copy.newFolder}
            onSelect={() => createAndRenameFolder(node.id)}
          />
          <ContextMenuItem
            icon={<PencilLine size={14} />}
            label={copy.rename}
            onSelect={() => {
              setRenamingFolderId(node.id);
              setRenamingFolderTitle(node.name);
            }}
          />
          <ContextMenuItem
            danger
            icon={<Trash2 size={14} />}
            label={copy.delete}
            onSelect={() => onDeleteFolder(node.id)}
          />
        </ContextMenuContent>
        </ContextMenuRoot>
      );
    }

    const file = node.file;
    const isActiveFile = file.id === activeFileId;
    const isRenaming = file.id === renamingFileId;
    const menuOpen = file.id === actionMenuFileId;
    const fileIsDragging = draggedItem?.type === "file" && draggedItem.id === file.id;
    const fileParentId = file.parentId ?? WORKSPACE_ROOT_FOLDER_ID;

    return (
      <ContextMenuRoot key={node.id}>
      <ContextMenuTrigger asChild>
      <li
        ref={treeVirtualizer.measureElement}
        className={`right-file-tree-node file ${fileIsDragging ? "dragging" : ""}`.trim()}
        data-index={virtualRow.index}
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
        onContextMenu={(event) => event.stopPropagation()}
        style={virtualStyle}
      >
        <div
          className={`right-row right-file-tree-row file ${isActiveFile ? "active" : ""} ${isRenaming ? "renaming" : ""}`}
          data-file-name={file.title}
          style={{ paddingLeft: `${depth * RIGHT_TREE_INDENT}px` }}
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
                aria-label={copy.open(file.title)}
                onClick={() => onSelectFile(file.id)}
                onKeyDown={(event) => handleFileKeyDown(event, file.id)}
              >
                <span className="right-file-document-icon">
                  <File size={16} />
                </span>
                <span className="right-row-label">{stripMarkdownExtension(node.name)}</span>
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
                      icon={<FilePlus2 size={14} />}
                      label={copy.newDocument}
                      onSelect={() => createAndRenameDocument(fileParentId)}
                    />
                    <MenuItem
                      icon={<FolderPlus size={14} />}
                      label={copy.newFolder}
                      onSelect={() => createAndRenameFolder(fileParentId)}
                    />
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
      </ContextMenuTrigger>
      <ContextMenuContent className="right-file-action-menu" ariaLabel={copy.actions(file.title)}>
        <ContextMenuItem
          icon={<FilePlus2 size={14} />}
          label={copy.newDocument}
          onSelect={() => createAndRenameDocument(fileParentId)}
        />
        <ContextMenuItem
          icon={<FolderPlus size={14} />}
          label={copy.newFolder}
          onSelect={() => createAndRenameFolder(fileParentId)}
        />
        <ContextMenuItem
          icon={<PencilLine size={14} />}
          label={copy.rename}
          onSelect={() => startRenamingFile(file)}
        />
        <ContextMenuItem
          icon={<ClipboardCopy size={14} />}
          label={copy.copyMarkdown}
          onSelect={() => onCopyFile(file.id)}
        />
        <ContextMenuItem
          icon={<Copy size={14} />}
          label={copy.duplicate}
          onSelect={() => duplicateFileFromMenu(file.id)}
        />
        <ContextMenuItem
          danger
          icon={<Trash2 size={14} />}
          label={copy.delete}
          onSelect={() => deleteFileFromMenu(file.id)}
        />
      </ContextMenuContent>
      </ContextMenuRoot>
    );
  };

  return (
    <ContextMenuRoot>
    <ContextMenuTrigger asChild>
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
                <MenuItem icon={<FilePlus2 size={16} />} label={copy.newDocument} onSelect={() => createAndRenameDocument()} />
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
        <PanelEmptyState>{copy.noneFound}</PanelEmptyState>
      )}
    </section>
    </ContextMenuTrigger>
    <ContextMenuContent className="right-file-action-menu" ariaLabel={copy.createInWorkspace}>
      <ContextMenuItem
        icon={<FilePlus2 size={14} />}
        label={copy.newDocument}
        onSelect={() => createAndRenameDocument()}
      />
      <ContextMenuItem
        icon={<FolderPlus size={14} />}
        label={copy.newFolder}
        onSelect={() => createAndRenameFolder()}
      />
    </ContextMenuContent>
    </ContextMenuRoot>
  );
}
