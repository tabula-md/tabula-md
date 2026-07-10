import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import type { ConnectionStatus } from "../collaboration";
import type { RenameFileResult } from "../hooks/useWorkspaceFiles";
import type { WorkspaceFile } from "../workspaceStorage";

type TabScrollState = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  activeTabOutOfView: boolean;
  activeTabDirection: "left" | "right" | null;
};

type FileTabsProps = {
  files: WorkspaceFile[];
  activeFile?: WorkspaceFile;
  activeCollaboratorCount: number;
  getFileStatus: (file: WorkspaceFile) => ConnectionStatus;
  liveFileIds: readonly string[];
  onAddFile: () => void;
  onSelectFile: (fileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onCloseFile: (fileId: string) => void;
  onReorderFiles: (sourceFileId: string, targetFileId: string) => void;
  onChromeInteraction?: () => void;
};

const emptyTabScrollState: TabScrollState = {
  canScrollLeft: false,
  canScrollRight: false,
  activeTabOutOfView: false,
  activeTabDirection: null,
};

const getTabDisplayTitle = (title: string) => title.replace(/\.(?:md|markdown)$/i, "");

const getStatusLabel = (status: ConnectionStatus) =>
  ({
    idle: "Local draft",
    connecting: "Connecting",
    connected: "Live session",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
    failed: "Connection failed",
  })[status];

export function FileTabs({
  files,
  activeFile,
  activeCollaboratorCount,
  getFileStatus,
  liveFileIds,
  onAddFile,
  onSelectFile,
  onRenameFile,
  onCloseFile,
  onReorderFiles,
  onChromeInteraction,
}: FileTabsProps) {
  const [tabScrollState, setTabScrollState] = useState<TabScrollState>(emptyTabScrollState);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const liveFileIdSet = useMemo(() => new Set(liveFileIds), [liveFileIds]);

  const updateTabScrollState = () => {
    const element = tabsScrollRef.current;
    if (!element) {
      setTabScrollState(emptyTabScrollState);
      return;
    }

    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const activeTabElement = element.querySelector<HTMLElement>(".tab-item.active");
    const scrollRect = element.getBoundingClientRect();
    const activeRect = activeTabElement?.getBoundingClientRect();
    const activeTabDirection: TabScrollState["activeTabDirection"] =
      activeRect && activeRect.right < scrollRect.left + 4
        ? "left"
        : activeRect && activeRect.left > scrollRect.right - 4
          ? "right"
          : null;
    const nextState = {
      canScrollLeft: element.scrollLeft > 2,
      canScrollRight: element.scrollLeft < maxScrollLeft - 2,
      activeTabOutOfView: Boolean(activeTabDirection),
      activeTabDirection,
    };

    setTabScrollState((currentState) =>
      currentState.canScrollLeft === nextState.canScrollLeft &&
      currentState.canScrollRight === nextState.canScrollRight &&
      currentState.activeTabOutOfView === nextState.activeTabOutOfView &&
      currentState.activeTabDirection === nextState.activeTabDirection
        ? currentState
        : nextState,
    );
  };

  const scrollActiveTabIntoView = (behavior: ScrollBehavior = "smooth") => {
    const element = tabsScrollRef.current;
    const activeTabElement = element?.querySelector<HTMLElement>(".tab-item.active");
    if (!element || !activeTabElement) {
      return;
    }

    const scrollPadding = Math.min(44, Math.floor(element.clientWidth * 0.2));
    const activeLeft = activeTabElement.offsetLeft;
    const activeRight = activeLeft + activeTabElement.offsetWidth;
    const visibleLeft = element.scrollLeft + scrollPadding;
    const visibleRight = element.scrollLeft + element.clientWidth - scrollPadding;
    let nextScrollLeft = visibleLeft;

    if (activeLeft < visibleLeft) {
      nextScrollLeft = activeLeft - scrollPadding;
    } else if (activeRight > visibleRight) {
      nextScrollLeft = activeRight - element.clientWidth + scrollPadding;
    }

    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    element.scrollTo({
      left: Math.max(0, Math.min(nextScrollLeft, maxScrollLeft)),
      behavior,
    });
    window.setTimeout(updateTabScrollState, behavior === "smooth" ? 260 : 0);
  };

  const scrollTabsBy = (direction: -1 | 1) => {
    const element = tabsScrollRef.current;
    if (!element) {
      return;
    }

    element.scrollBy({ left: direction * Math.max(240, Math.floor(element.clientWidth * 0.65)), behavior: "smooth" });
    window.setTimeout(updateTabScrollState, 180);
  };

  const handleTabScrollButtonClick = (direction: -1 | 1) => {
    const activeDirection = direction === -1 ? "left" : "right";
    if (tabScrollState.activeTabDirection === activeDirection) {
      scrollActiveTabIntoView("auto");
      return;
    }

    scrollTabsBy(direction);
  };

  const startRenamingFile = (file: WorkspaceFile) => {
    setRenamingFileId(file.id);
    setRenamingTitle(getTabDisplayTitle(file.title));
    onChromeInteraction?.();
  };

  const commitRenamingFile = (nextRawTitle = renamingTitle) => {
    if (!renamingFileId) {
      return;
    }

    const result = onRenameFile(renamingFileId, nextRawTitle);
    if (!result.ok) {
      window.requestAnimationFrame(() => {
        const input = renameInputRef.current;
        if (!input) {
          return;
        }

        input.focus();
        input.setSelectionRange(0, input.value.length);
      });
      return;
    }

    setRenamingFileId(null);
    setRenamingTitle("");
  };

  const cancelRenamingFile = () => {
    setRenamingFileId(null);
    setRenamingTitle("");
  };

  const selectFile = (fileId: string) => {
    onSelectFile(fileId);
  };

  useEffect(() => {
    scrollActiveTabIntoView("auto");
  }, [activeFile?.id, files.length]);

  useEffect(() => {
    const element = tabsScrollRef.current;
    if (!element) {
      return;
    }

    const handleScroll = () => updateTabScrollState();
    element.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    updateTabScrollState();

    return () => {
      element.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [files.length]);

  useLayoutEffect(() => {
    if (!renamingFileId) {
      return;
    }

    const input = renameInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(0, input.value.length);
  }, [renamingFileId]);

  return (
    <nav
      className={`tabbar ${tabScrollState.canScrollLeft ? "can-scroll-left" : ""} ${
        tabScrollState.canScrollRight ? "can-scroll-right" : ""
      }`}
      aria-label="Open files"
    >
      <button
        className={`tab-scroll-button ${tabScrollState.activeTabDirection === "left" ? "has-current-tab" : ""}`}
        type="button"
        title={
          tabScrollState.activeTabDirection === "left" && activeFile
            ? `Show current tab: ${activeFile.title}`
            : "Scroll tabs left"
        }
        aria-label={
          tabScrollState.activeTabDirection === "left" && activeFile
            ? `Show current tab: ${activeFile.title}`
            : "Scroll tabs left"
        }
        disabled={!tabScrollState.canScrollLeft}
        onClick={() => handleTabScrollButtonClick(-1)}
      >
        <ChevronLeft size={14} />
      </button>
      <div className="tabs-scroll" ref={tabsScrollRef}>
        {files.map((file) => {
          const fileStatus = getFileStatus(file);
          const isActiveFile = file.id === activeFile?.id;
          const isRenaming = file.id === renamingFileId;
          const isLiveFile = liveFileIdSet.has(file.id);
          const liveLabel =
            isLiveFile && fileStatus !== "idle" ? getStatusLabel(fileStatus) : "Included in live room";
          const collaboratorCount = isActiveFile ? activeCollaboratorCount : (file.collaboratorCount ?? 0);
          const tabDisplayTitle = getTabDisplayTitle(file.title);
          return (
            <div
              className={`tab-item ${isActiveFile ? "active" : ""} ${isLiveFile ? "live" : ""} ${
                draggedFileId === file.id ? "dragging" : ""
              }`}
              data-file-id={file.id}
              data-file-name={file.title}
              data-room-id={file.roomId ?? ""}
              data-display-title={tabDisplayTitle}
              data-view-mode={file.viewMode}
              draggable={!isRenaming}
              key={file.id}
              onDragStart={() => setDraggedFileId(file.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedFileId) {
                  onReorderFiles(draggedFileId, file.id);
                }
                setDraggedFileId(null);
              }}
              onDragEnd={() => setDraggedFileId(null)}
            >
              <div
                className={`tab-select-button ${isRenaming ? "tab-rename-shell" : ""}`}
                role={isRenaming ? undefined : "button"}
                tabIndex={isRenaming ? undefined : 0}
                title={`${file.title} · ${isLiveFile ? liveLabel : "Local draft"}`}
                onMouseDown={(event) => {
                  if (event.detail >= 2) {
                    event.preventDefault();
                  }
                }}
                onClick={() => {
                  if (!isRenaming) {
                    selectFile(file.id);
                  }
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!isRenaming) {
                    startRenamingFile(file);
                  }
                }}
                onKeyDown={(event) => {
                  if (isRenaming) {
                    return;
                  }

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectFile(file.id);
                  }
                }}
              >
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    className="tab-title tab-rename-input"
                    type="text"
                    defaultValue={renamingTitle}
                    spellCheck={false}
                    onBlur={(event) => commitRenamingFile(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRenamingFile(event.currentTarget.value);
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRenamingFile();
                      }
                    }}
                    aria-label={`Rename ${file.title}`}
                  />
                ) : (
                  <span className="tab-title">{tabDisplayTitle}</span>
                )}
                {isLiveFile && collaboratorCount > 0 && (
                  <span className="tab-collaborator-count" title={`${collaboratorCount} collaborators`}>
                    {collaboratorCount}
                  </span>
                )}
              </div>

              {isLiveFile && (
                <span
                  className="tab-live-scope-dot"
                  title="Included in live room"
                  aria-hidden="true"
                />
              )}

              {!isRenaming && (
                <div className="tab-actions">
                  <button
                    className="tab-action-button close"
                    type="button"
                    title="Close tab"
                    aria-label={`Close ${file.title}`}
                    onClick={() => onCloseFile(file.id)}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="tabbar-actions">
        <button className="add-tab-button" type="button" onClick={onAddFile} title="New tab">
          <Plus size={16} />
        </button>
        <button
          className={`tab-scroll-button ${tabScrollState.activeTabDirection === "right" ? "has-current-tab" : ""}`}
          type="button"
          title={
            tabScrollState.activeTabDirection === "right" && activeFile
              ? `Show current tab: ${activeFile.title}`
              : "Scroll tabs right"
          }
          aria-label={
            tabScrollState.activeTabDirection === "right" && activeFile
              ? `Show current tab: ${activeFile.title}`
              : "Scroll tabs right"
          }
          disabled={!tabScrollState.canScrollRight}
          onClick={() => handleTabScrollButtonClick(1)}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}
