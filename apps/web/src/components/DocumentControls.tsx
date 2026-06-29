import { type ReactNode, type RefObject } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  PencilLine,
  Search,
  SlidersHorizontal,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import type { SearchMatch } from "../markdown";
import type { CenterPopover } from "../uiTypes";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import {
  READING_WIDTHS,
  type FileViewMode,
  type ReadingWidth,
} from "../workspaceStorage";

type DocumentControlsProps = {
  activeViewMode: FileViewMode;
  activeReadingWidth: ReadingWidth;
  activeLineWrapping: boolean;
  activeLineNumbers: boolean;
  canCopyFile: boolean;
  centerPopover: CenterPopover;
  language: WorkspaceLanguage;
  searchOpen: boolean;
  onCopyFile: () => void;
  onSetViewMode: (viewMode: FileViewMode) => void;
  onToggleSearch: () => void;
  onToggleViewOptions: () => void;
  onSetReadingWidth: (readingWidth: ReadingWidth) => void;
  onToggleLineWrapping: () => void;
  onToggleLineNumbers: () => void;
};

type DocumentSearchBarProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchMatches: SearchMatch[];
  activeSearchMatchIndex: number;
  language: WorkspaceLanguage;
  onSearchQueryChange: (query: string) => void;
  onGoToSearchMatch: (direction: 1 | -1) => void;
  onCloseSearch: () => void;
};

type ViewModeAction = {
  viewMode: FileViewMode;
  label: string;
  icon: ReactNode;
};

type ViewModeSlot = {
  slot: "edit-preview" | "split";
  action: ViewModeAction;
};

export function DocumentControls({
  activeViewMode,
  activeReadingWidth,
  activeLineWrapping,
  activeLineNumbers,
  canCopyFile,
  centerPopover,
  language,
  searchOpen,
  onCopyFile,
  onSetViewMode,
  onToggleSearch,
  onToggleViewOptions,
  onSetReadingWidth,
  onToggleLineWrapping,
  onToggleLineNumbers,
}: DocumentControlsProps) {
  const copy = getWorkspaceChromeCopy(language).documentControls;
  const readingWidthLabels: Record<ReadingWidth, string> = {
    narrow: copy.focusWidth,
    standard: copy.standardWidth,
    wide: copy.fillWidth,
  };
  const controlsLabel =
    activeViewMode === "preview"
      ? copy.viewControls
      : activeViewMode === "split"
        ? copy.layoutControls
        : copy.editorControls;
  const viewModeSlots: ViewModeSlot[] = [
    {
      slot: "split",
      action:
        activeViewMode === "split"
          ? {
              viewMode: "edit",
              label: copy.edit,
              icon: <PencilLine size={16} />,
            }
          : {
              viewMode: "split",
              label: copy.split,
              icon: <SplitSquareHorizontal size={16} />,
            },
    },
    {
      slot: "edit-preview",
      action:
        activeViewMode === "preview"
          ? {
              viewMode: "edit",
              label: copy.edit,
              icon: <PencilLine size={16} />,
            }
          : {
              viewMode: "preview",
              label: copy.preview,
              icon: <Eye size={16} />,
            },
    },
  ];

  return (
    <div className="document-controls-wrap">
      <nav className="document-controls" aria-label={copy.documentControlsLabel}>
        {viewModeSlots.map(({ slot, action }) => (
          <button
            key={slot}
            className="tool-button"
            type="button"
            title={action.label}
            aria-label={action.label}
            data-view-mode-slot={slot}
            data-view-mode-action={action.viewMode}
            onClick={() => onSetViewMode(action.viewMode)}
          >
            {action.icon}
          </button>
        ))}
        <button
          className="tool-button"
          type="button"
          title={canCopyFile ? copy.copyFile : copy.nothingToCopy}
          aria-label={copy.copyCurrentFile}
          disabled={!canCopyFile}
          onClick={onCopyFile}
        >
          <Copy size={16} />
        </button>
        <button
          className={`tool-button ${centerPopover === "view" ? "active" : ""}`}
          type="button"
          title={controlsLabel}
          aria-label={controlsLabel}
          onClick={onToggleViewOptions}
        >
          <SlidersHorizontal size={16} />
        </button>
        <button
          className={`tool-button ${searchOpen ? "active" : ""}`}
          type="button"
          title={copy.search}
          aria-label={copy.search}
          onClick={onToggleSearch}
        >
          <Search size={16} />
        </button>
      </nav>

      {centerPopover === "view" && (
        <section
          className="document-controls-popover editor-controls-popover"
          aria-label={controlsLabel}
        >
          <div className="editor-controls-section">
            {activeViewMode !== "preview" && (
              <>
                <button
                  className={`editor-controls-row ${activeLineNumbers ? "active" : ""}`}
                  type="button"
                  aria-pressed={activeLineNumbers}
                  onClick={onToggleLineNumbers}
                >
                  <span className="editor-controls-check">
                    {activeLineNumbers && <Check size={14} />}
                  </span>
                  <span>{copy.lineNumbers}</span>
                </button>
                <button
                  className={`editor-controls-row ${activeLineWrapping ? "active" : ""}`}
                  type="button"
                  aria-pressed={activeLineWrapping}
                  onClick={onToggleLineWrapping}
                >
                  <span className="editor-controls-check">
                    {activeLineWrapping && <Check size={14} />}
                  </span>
                  <span>{copy.lineWrapping}</span>
                </button>
              </>
            )}
            <div className="editor-controls-width-row">
              <span>{copy.textWidth}</span>
              <div className="editor-width-control" aria-label={copy.textWidth}>
                {READING_WIDTHS.map((readingWidth) => (
                  <button
                    key={readingWidth}
                    className={
                      readingWidth === activeReadingWidth ? "active" : ""
                    }
                    type="button"
                    aria-pressed={readingWidth === activeReadingWidth}
                    onClick={() => onSetReadingWidth(readingWidth)}
                  >
                    {readingWidthLabels[readingWidth]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function DocumentSearchBar({
  searchInputRef,
  searchQuery,
  searchMatches,
  activeSearchMatchIndex,
  language,
  onSearchQueryChange,
  onGoToSearchMatch,
  onCloseSearch,
}: DocumentSearchBarProps) {
  const copy = getWorkspaceChromeCopy(language).documentControls;

  return (
    <section className="document-search-row" aria-label={copy.findInFile}>
      <div className="document-search-bar">
        <Search size={15} />
        <input
          type="text"
          role="searchbox"
          ref={searchInputRef}
          value={searchQuery}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }

            event.preventDefault();
            onGoToSearchMatch(event.shiftKey ? -1 : 1);
          }}
          placeholder={copy.findInFile}
          aria-label={copy.findInFile}
        />
        <span className="document-search-count">
          {searchQuery.trim() &&
          searchMatches.length > 0 &&
          activeSearchMatchIndex >= 0
            ? `${activeSearchMatchIndex + 1}/${searchMatches.length}`
            : `0/${searchQuery.trim() ? searchMatches.length : 0}`}
        </span>
        <button
          type="button"
          title={copy.previousMatch}
          aria-label={copy.previousMatch}
          disabled={searchMatches.length === 0}
          onClick={() => onGoToSearchMatch(-1)}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          title={copy.nextMatch}
          aria-label={copy.nextMatch}
          disabled={searchMatches.length === 0}
          onClick={() => onGoToSearchMatch(1)}
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          title={copy.closeSearch}
          aria-label={copy.closeSearch}
          onClick={onCloseSearch}
        >
          <X size={14} />
        </button>
      </div>
    </section>
  );
}
