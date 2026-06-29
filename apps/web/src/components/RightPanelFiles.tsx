import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Ellipsis,
  File,
  Folder,
  PencilLine,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ConnectionStatus } from "../collab";
import type { RenameFileResult } from "../hooks/useWorkspaceFiles";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";

type FileTreeFolderNode = {
  type: "folder";
  id: string;
  name: string;
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
  openFileIds: string[];
  activeFileId: string;
  fileQuery: string;
  commentsByFileId: Record<string, FileComment[]>;
  collapsedFolderIds: Set<string>;
  getFileStatus: (file: WorkspaceFile) => ConnectionStatus;
  getFileSearchText: (file: WorkspaceFile) => string;
  onFileQueryChange: (query: string) => void;
  onNewFile: () => void;
  onImportFile: () => void;
  onToggleFolder: (folderId: string) => void;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onDuplicateFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
};

const RIGHT_TREE_INDENT = 20;

const getStatusLabel = (status: ConnectionStatus) =>
  ({
    idle: "Local",
    connecting: "Connecting",
    connected: "Live",
    offline: "Offline",
  })[status];

const getFileTreeParts = (title: string) =>
  title
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter(Boolean);

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

const buildFileTree = (files: WorkspaceFile[]): FileTreeFolderNode => {
  const rootNode: FileTreeFolderNode = {
    type: "folder",
    id: "project-root",
    name: "Project",
    children: [],
  };

  for (const file of files) {
    const parts = getFileTreeParts(file.title);
    const fileName = parts.at(-1) || file.title;
    let currentFolder = rootNode;

    for (const folderName of parts.slice(0, -1)) {
      const existingFolder = currentFolder.children.find(
        (child): child is FileTreeFolderNode => child.type === "folder" && child.name === folderName,
      );

      if (existingFolder) {
        currentFolder = existingFolder;
        continue;
      }

      const nextFolder: FileTreeFolderNode = {
        type: "folder",
        id: `${currentFolder.id}/${folderName}`,
        name: folderName,
        children: [],
      };
      currentFolder.children.push(nextFolder);
      currentFolder = nextFolder;
    }

    currentFolder.children.push({
      type: "file",
      id: file.id,
      name: fileName,
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
  openFileIds,
  activeFileId,
  fileQuery,
  commentsByFileId,
  collapsedFolderIds,
  getFileStatus,
  getFileSearchText,
  onFileQueryChange,
  onNewFile,
  onImportFile,
  onToggleFolder,
  onSelectFile,
  onCloseFile,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
}: RightPanelFilesProps) {
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [actionMenuFileId, setActionMenuFileId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const fileButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const getFileComments = (fileId: string) => commentsByFileId[fileId] ?? [];
  const openFileIdSet = new Set(openFileIds);
  const normalizedQuery = fileQuery.trim().toLowerCase();
  const visibleFiles = normalizedQuery
    ? files.filter((file) => getFileSearchText(file).toLowerCase().includes(normalizedQuery))
    : files;
  const fileTreeRoot = buildFileTree(visibleFiles);
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
    if (!actionMenuFileId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest(".right-file-menu-wrap")) {
        return;
      }

      setActionMenuFileId(null);
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
  }, [actionMenuFileId]);

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

  const renderFileTreeNode = (node: FileTreeNode, depth: number) => {
    if (node.type === "folder") {
      const folderCollapsed = collapsedFolderIds.has(node.id);

      return (
        <li className="right-file-tree-node folder" key={node.id}>
          <button
            className="right-row right-file-tree-row folder"
            type="button"
            style={{ paddingLeft: `${depth * RIGHT_TREE_INDENT}px` }}
            aria-expanded={!folderCollapsed}
            onClick={() => onToggleFolder(node.id)}
          >
            {folderCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            <Folder size={15} />
            <span className="right-row-label">{node.name}</span>
          </button>
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
    const status = getFileStatus(file);
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
              <File size={16} />
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
                {file.roomId && <span className={`right-live-dot ${status}`} title={getStatusLabel(status)} />}
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
                <File size={16} />
                <span className="right-row-label">{getFileDisplayTitle(node.name)}</span>
                <span className="right-file-tree-signals">
                  {file.roomId && <span className={`right-live-dot ${status}`} title={getStatusLabel(status)} />}
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
        <button
          className="right-file-create-button"
          type="button"
          title="New file"
          aria-label="New file"
          onClick={onNewFile}
        >
          <Plus size={15} />
        </button>
      </div>
      {visibleFiles.length > 0 ? (
        <ol className="right-file-tree" aria-label="Project files">
          {renderFileTreeNode(fileTreeRoot, 0)}
        </ol>
      ) : (
        <p className="right-empty-state">No files found.</p>
      )}
    </section>
  );
}
