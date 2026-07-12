import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Collaborator } from "../collaboration";
import type { RenameFileResult } from "../hooks/useWorkspaceFiles";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import { getWorkspaceFileTabLabels } from "../workspaceDisplayTitles";
import { NewDocumentButton } from "./NewDocumentButton";
import { getWorkspaceTabId, getWorkspaceTabPanelId } from "../workspaceA11yIds";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";

type TabScrollState = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

type FileTabsProps = {
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  activeFile?: WorkspaceFile;
  collaborators: Collaborator[];
  language: WorkspaceLanguage;
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
};

const getTabDisplayTitle = (title: string) => title.replace(/\.(?:md|markdown)$/i, "");

export const getDocumentCollaborators = (
  collaborators: readonly Collaborator[],
  documentId: string,
) => collaborators.filter(
  (collaborator) =>
    (collaborator.activeDocumentId ?? collaborator.selection?.documentId) === documentId,
);

export function FileTabs({
  files,
  folders,
  activeFile,
  collaborators,
  language,
  onAddFile,
  onSelectFile,
  onRenameFile,
  onCloseFile,
  onReorderFiles,
  onChromeInteraction,
}: FileTabsProps) {
  const copy = getWorkspaceInterfaceCopy(language).tabs;
  const [tabScrollState, setTabScrollState] = useState<TabScrollState>(emptyTabScrollState);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const tabLabels = useMemo(
    () => getWorkspaceFileTabLabels(files, folders),
    [files, folders],
  );

  const updateTabScrollState = () => {
    const element = tabsScrollRef.current;
    if (!element) {
      setTabScrollState(emptyTabScrollState);
      return;
    }

    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const nextState = {
      canScrollLeft: element.scrollLeft > 2,
      canScrollRight: element.scrollLeft < maxScrollLeft - 2,
    };

    setTabScrollState((currentState) =>
      currentState.canScrollLeft === nextState.canScrollLeft &&
      currentState.canScrollRight === nextState.canScrollRight
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

  const selectAndFocusFile = (fileId: string) => {
    selectFile(fileId);
    window.requestAnimationFrame(() => {
      const tab = Array.from(
        tabsScrollRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
      ).find((candidate) => candidate.dataset.fileId === fileId);
      tab?.focus();
    });
  };

  useLayoutEffect(() => {
    scrollActiveTabIntoView("auto");
    updateTabScrollState();
  }, [activeFile?.id, files.length]);

  useEffect(() => {
    const element = tabsScrollRef.current;
    if (!element) {
      return;
    }

    const handleScroll = () => updateTabScrollState();
    const handleResize = () => {
      scrollActiveTabIntoView("auto");
      updateTabScrollState();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    element.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    resizeObserver.observe(element);
    updateTabScrollState();

    return () => {
      element.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      resizeObserver.disconnect();
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
    <div
      className={`tabbar ${tabScrollState.canScrollLeft ? "can-scroll-left" : ""} ${
        tabScrollState.canScrollRight ? "can-scroll-right" : ""
      }`}
    >
      <button
        className="tab-scroll-button"
        type="button"
        aria-label={copy.scrollLeft}
        data-tooltip={copy.scrollLeft}
        disabled={!tabScrollState.canScrollLeft}
        onClick={() => scrollTabsBy(-1)}
      >
        <ChevronLeft size={14} />
      </button>
      <div className="tabs-scroll" ref={tabsScrollRef} role="tablist" aria-label={copy.openDocuments}>
        {files.map((file, fileIndex) => {
          const isActiveFile = file.id === activeFile?.id;
          const isRenaming = file.id === renamingFileId;
          const allDocumentCollaborators = getDocumentCollaborators(collaborators, file.id);
          const documentCollaborators = allDocumentCollaborators.slice(0, 2);
          const hiddenCollaboratorCount = allDocumentCollaborators.length - documentCollaborators.length;
          const tabLabel = tabLabels.get(file.id) ?? {
            displayTitle: file.title,
            fullPath: file.title,
          };
          const tabDisplayTitle = getTabDisplayTitle(tabLabel.displayTitle);
          return (
            <div
              className={`tab-item ${isActiveFile ? "active" : ""} ${
                draggedFileId === file.id ? "dragging" : ""
              }`}
              role="presentation"
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
              {isRenaming ? (
                <div className="tab-select-button tab-rename-shell">
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
                    aria-label={copy.renameDocument(tabLabel.fullPath)}
                  />
                </div>
              ) : (
                <button
                  className="tab-select-button"
                  type="button"
                  role="tab"
                  id={getWorkspaceTabId(file.id)}
                  aria-controls={getWorkspaceTabPanelId(file.id)}
                  aria-selected={isActiveFile}
                  tabIndex={isActiveFile ? 0 : -1}
                  data-file-id={file.id}
                  title={tabLabel.fullPath}
                  onMouseDown={(event) => {
                    if (event.detail >= 2) event.preventDefault();
                  }}
                  onClick={() => selectFile(file.id)}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startRenamingFile(file);
                  }}
                  onKeyDown={(event) => {
                    const lastIndex = files.length - 1;
                    const targetIndex =
                      event.key === "ArrowLeft"
                        ? Math.max(0, fileIndex - 1)
                        : event.key === "ArrowRight"
                          ? Math.min(lastIndex, fileIndex + 1)
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? lastIndex
                              : -1;
                    const targetFile = targetIndex >= 0 ? files[targetIndex] : undefined;
                    if (targetFile) {
                      event.preventDefault();
                      selectAndFocusFile(targetFile.id);
                    }
                  }}
                >
                  <span className="tab-title">{tabDisplayTitle}</span>
                  {documentCollaborators.length > 0 && (
                    <span
                      className="tab-presence-avatars"
                      role="img"
                      aria-label={copy.collaboratorsInDocument(
                        allDocumentCollaborators.map((collaborator) => collaborator.name).join(", "),
                      )}
                      data-tooltip={allDocumentCollaborators.map((collaborator) => collaborator.name).join(", ")}
                    >
                      {documentCollaborators.map((collaborator) => (
                        <span
                          className="tab-presence-avatar"
                          key={collaborator.id}
                          style={{ background: collaborator.color }}
                          aria-hidden="true"
                        >
                          {(collaborator.name || "?").trim().slice(0, 1) || "?"}
                        </span>
                      ))}
                      {hiddenCollaboratorCount > 0 && (
                        <span className="tab-presence-overflow" aria-hidden="true">
                          +{hiddenCollaboratorCount}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              )}

              {!isRenaming && (
                <div className="tab-actions">
                  <button
                    className="tab-action-button close"
                    type="button"
                    aria-label={copy.closeDocument(tabLabel.fullPath)}
                    data-tooltip={copy.close}
                    onClick={() => onCloseFile(file.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="tabbar-actions">
        <NewDocumentButton
          buttonClassName="add-tab-button"
          label={copy.newDocument}
          onCreate={onAddFile}
        />
        <button
          className="tab-scroll-button"
          type="button"
          aria-label={copy.scrollRight}
          data-tooltip={copy.scrollRight}
          disabled={!tabScrollState.canScrollRight}
          onClick={() => scrollTabsBy(1)}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
