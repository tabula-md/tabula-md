import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Ellipsis,
  File,
  Folder,
  FolderInput,
  PencilLine,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { RenameFileResult } from "../hooks/useWorkspaceFiles";
import { WORKSPACE_ROOT_FOLDER_ID, type FileComment, type WorkspaceFile, type WorkspaceFolder } from "../workspaceStorage";
import {
  getWorkspaceFileDisplayTitles,
  getWorkspaceFolderDisplayTitles,
} from "../workspaceDisplayTitles";
import { NewDocumentButton } from "./NewDocumentButton";
import { NewFolderButton } from "./NewFolderButton";

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

type RightPanelFilesProps = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  openFileIds: string[];
  activeFileId: string;
  fileQuery: string;
  isLiveWorkspace: boolean;
  commentsByFileId: Record<string, FileComment[]>;
  collapsedFolderIds: Set<string>;
  getFileSearchText: (file: WorkspaceFile) => string;
  onFileQueryChange: (query: string) => void;
  onNewFile: () => void;
  onNewFolder: (parentId?: string) => WorkspaceFolder | undefined;
  onImportFile: () => void;
  onToggleFolder: (folderId: string) => void;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
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

const collectVisibleFileIds = (
  node: FileTreeFolderNode,
  collapsedFolderIds: Set<string>,
  fileIds: string[] = [],
) => {
  for (const childNode of node.children) {
    if (childNode.type === "file") {
      fileIds.push(childNode.file.id);
      continue;
    }

    if (!collapsedFolderIds.has(childNode.id)) {
      collectVisibleFileIds(childNode, collapsedFolderIds, fileIds);
    }
  }

  return fileIds;
};

export function RightPanelFiles({
  files,
  folders,
  openFileIds,
  activeFileId,
  fileQuery,
  isLiveWorkspace,
  commentsByFileId,
  collapsedFolderIds,
  getFileSearchText,
  onFileQueryChange,
  onNewFile,
  onNewFolder,
  onImportFile,
  onToggleFolder,
  onSelectFile,
  onCloseFile,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onDeleteFolder,
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const fileButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const getFileComments = (fileId: string) => commentsByFileId[fileId] ?? [];
  const openFileIdSet = new Set(openFileIds);
  const normalizedQuery = fileQuery.trim().toLowerCase();
  const visibleFiles = normalizedQuery
    ? files.filter((file) => getFileSearchText(file).toLowerCase().includes(normalizedQuery))
    : files;
  const hasLiveWorkspace = isLiveWorkspace;
  const displayTitles = getWorkspaceFileDisplayTitles(files);
  const folderDisplayTitles = getWorkspaceFolderDisplayTitles(folders);
  const fileTreeRoot = buildFileTree(visibleFiles, folders, displayTitles, folderDisplayTitles);
  const visibleFileIds = collectVisibleFileIds(fileTreeRoot, collapsedFolderIds);

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

  useEffect(() => {
    if (!actionMenuFileId && !actionMenuFolderId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest(".right-file-menu-wrap")) {
        return;
      }

      setActionMenuFileId(null);
      setActionMenuFolderId(null);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setActionMenuFileId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionMenuFileId, actionMenuFolderId]);

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
    fileButtonRefs.current.get(visibleFileIds[nextIndex])?.focus();
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
        fileButtonRefs.current.get(firstFileId)?.focus();
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

  const renderFileTreeNode = (node: FileTreeNode, depth: number) => {
    if (node.type === "folder") {
      const folderCollapsed = collapsedFolderIds.has(node.id);
      const isRootFolder = node.id === WORKSPACE_ROOT_FOLDER_ID;
      const folderMenuOpen = actionMenuFolderId === node.id;
      const folderIsRenaming = renamingFolderId === node.id;

      return (
        <li className="right-file-tree-node folder" key={node.id}>
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
              {folderCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              <span
                className={`right-file-folder-icon ${isRootFolder && hasLiveWorkspace ? "live" : ""}`}
                title={isRootFolder && hasLiveWorkspace ? "Shared workspace" : undefined}
              >
                <Folder size={15} />
                {isRootFolder && hasLiveWorkspace && <span className="right-file-icon-live-dot" aria-hidden="true" />}
              </span>
              {folderIsRenaming ? (
                <input
                  className="right-file-rename-input"
                  value={renamingFolderTitle}
                  aria-label={`Rename ${node.name} folder`}
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
                    aria-label={`More actions for ${node.name}`}
                    onClick={() => setActionMenuFolderId(folderMenuOpen ? null : node.id)}
                  >
                    <Ellipsis size={14} />
                  </button>
                  {folderMenuOpen && (
                    <span className="right-file-action-menu" role="menu" aria-label={`${node.name} actions`}>
                      <button type="button" role="menuitem" onClick={() => {
                        setActionMenuFolderId(null);
                        createAndRenameFolder(node.id);
                      }}>
                        <Folder size={13} /><span>New subfolder</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setActionMenuFolderId(null); setRenamingFolderId(node.id); setRenamingFolderTitle(node.name); }}>
                        <PencilLine size={13} /><span>Rename</span>
                      </button>
                      <label className="right-file-move-field">
                        <FolderInput size={13} />
                        <select value={node.folder.parentId ?? WORKSPACE_ROOT_FOLDER_ID} aria-label={`Move ${node.name}`} onChange={(event) => { onMoveFolder(node.id, event.target.value); setActionMenuFolderId(null); }}>
                          {folders.filter((folder) => folder.id !== node.id).map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folderDisplayTitles.get(folder.id) ?? folder.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="danger" type="button" role="menuitem" onClick={() => { setActionMenuFolderId(null); onDeleteFolder(node.id); }}>
                        <Trash2 size={13} /><span>Delete</span>
                      </button>
                    </span>
                  )}
                </span>
              </span>
            )}
          </div>
          {!folderCollapsed && node.children.length > 0 && (
            <ol className="right-file-tree-children">
              {node.children.map((childNode) => renderFileTreeNode(childNode, depth + 1))}
            </ol>
          )}
        </li>
      );
    }

    const file = node.file;
    const openComments = getFileComments(file.id).filter((comment) => !comment.resolved);
    const isActiveFile = file.id === activeFileId;
    const isOpenFile = openFileIdSet.has(file.id);
    const isRenaming = file.id === renamingFileId;
    const menuOpen = file.id === actionMenuFileId;

    return (
      <li className="right-file-tree-node file" key={node.id}>
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
                aria-label={`Rename ${file.title} in Files`}
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
              <span className="right-file-tree-signals">
                {openComments.length > 0 && (
                  <span
                    className="right-row-badge right-file-tree-comment-count"
                    title={`${openComments.length} open comments`}
                  >
                    {openComments.length}
                  </span>
                )}
              </span>
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
                aria-label={`Open ${file.title}`}
                onClick={() => onSelectFile(file.id)}
                onKeyDown={(event) => handleFileKeyDown(event, file.id)}
              >
                <span
                  className="right-file-document-icon"
                  title={hasLiveWorkspace ? "Shared in this room" : "Local document"}
                >
                  <File size={16} />
                </span>
                <span className="right-row-label">{getFileDisplayTitle(node.name)}</span>
                <span className="right-file-tree-signals">
                  {openComments.length > 0 && (
                    <span
                      className="right-row-badge right-file-tree-comment-count"
                      title={`${openComments.length} open comments`}
                    >
                      {openComments.length}
                    </span>
                  )}
                </span>
              </button>
              <span className="right-file-actions" aria-label={`${file.title} actions`}>
                {isOpenFile && (
                  <button
                    className="right-file-action"
                    type="button"
                    title={`Close tab ${file.title}`}
                    aria-label={`Close tab ${file.title}`}
                    onClick={() => onCloseFile(file.id)}
                  >
                    <X size={13} />
                  </button>
                )}
                <span className="right-file-menu-wrap">
                  <button
                    className="right-file-action"
                    type="button"
                    title={`More actions for ${file.title}`}
                    aria-label={`More actions for ${file.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActionMenuFileId(menuOpen ? null : file.id);
                    }}
                  >
                    <Ellipsis size={14} />
                  </button>
                  {menuOpen && (
                    <span className="right-file-action-menu" role="menu" aria-label={`${file.title} actions`}>
                      <button role="menuitem" type="button" onClick={() => startRenamingFile(file)}>
                        <PencilLine size={13} />
                        <span>Rename</span>
                      </button>
                      <button role="menuitem" type="button" onClick={() => duplicateFileFromMenu(file.id)}>
                        <Copy size={13} />
                        <span>Duplicate</span>
                      </button>
                      <label className="right-file-move-field">
                        <FolderInput size={13} />
                        <select value={file.parentId ?? WORKSPACE_ROOT_FOLDER_ID} aria-label={`Move ${file.title}`} onChange={(event) => { onMoveFileToFolder(file.id, event.target.value); setActionMenuFileId(null); }}>
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
                        <Trash2 size={13} />
                        <span>Delete</span>
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
    <section className="right-panel-content">
      <div className="right-file-search-row">
        <input
          ref={searchInputRef}
          className="right-panel-search"
          type="search"
          value={fileQuery}
          placeholder="Search files"
          aria-label="Search files"
          onChange={(event) => onFileQueryChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <button
          className="right-file-import-button"
          type="button"
          title="Import file"
          aria-label="Import file"
          onClick={onImportFile}
        >
          <Upload size={15} />
        </button>
        <NewFolderButton
          buttonClassName="right-file-import-button"
          onCreate={() => createAndRenameFolder()}
        />
        <NewDocumentButton
          buttonClassName="right-file-create-button"
          iconSize={15}
          onCreate={onNewFile}
        />
      </div>
      {visibleFiles.length > 0 || fileTreeRoot.children.length > 0 ? (
        <ol className="right-file-tree" aria-label="Workspace files">
          {renderFileTreeNode(fileTreeRoot, 0)}
        </ol>
      ) : (
        <p className="right-empty-state">No files found.</p>
      )}
    </section>
  );
}
