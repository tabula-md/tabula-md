import { type ReactNode, type RefObject } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  PencilLine,
  Search,
  SlidersHorizontal,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import type { SearchMatch } from "../markdown";
import type { CenterPopover } from "../uiTypes";
import { READING_WIDTHS, type FileViewMode, type ReadingWidth } from "../workspaceStorage";

type FileToolbarProps = {
  activeViewMode: FileViewMode;
  activeReadingWidth: ReadingWidth;
  activeLineWrapping: boolean;
  activeLineNumbers: boolean;
  centerPopover: CenterPopover;
  searchOpen: boolean;
  onSetViewMode: (viewMode: FileViewMode) => void;
  onToggleSearch: () => void;
  onToggleViewOptions: () => void;
  onSetReadingWidth: (readingWidth: ReadingWidth) => void;
  onToggleLineWrapping: () => void;
  onToggleLineNumbers: () => void;
};

type FileSearchBarProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchMatches: SearchMatch[];
  activeSearchMatchIndex: number;
  onSearchQueryChange: (query: string) => void;
  onGoToSearchMatch: (direction: 1 | -1) => void;
  onCloseSearch: () => void;
};

type ViewModeAction = {
  viewMode: FileViewMode;
  label: string;
  icon: ReactNode;
  active?: boolean;
};

type ViewModeSlot = {
  slot: "edit-preview" | "split";
  action?: ViewModeAction;
};

const readingWidthLabels: Record<ReadingWidth, string> = {
  narrow: "Focus",
  standard: "Standard",
  wide: "Fill",
};

export function FileToolbar({
  activeViewMode,
  activeReadingWidth,
  activeLineWrapping,
  activeLineNumbers,
  centerPopover,
  searchOpen,
  onSetViewMode,
  onToggleSearch,
  onToggleViewOptions,
  onSetReadingWidth,
  onToggleLineWrapping,
  onToggleLineNumbers,
}: FileToolbarProps) {
  const viewModeSlots: ViewModeSlot[] = [
    {
      slot: "split",
      action:
        activeViewMode === "preview"
          ? undefined
          : {
              viewMode: activeViewMode === "split" ? "edit" : "split",
              label: "Split",
              icon: <SplitSquareHorizontal size={16} />,
              active: activeViewMode === "split",
            },
    },
    {
      slot: "edit-preview",
      action:
        activeViewMode === "preview"
          ? { viewMode: "edit", label: "Edit", icon: <PencilLine size={16} /> }
          : { viewMode: "preview", label: "Preview", icon: <Eye size={16} /> },
    },
  ];

  return (
    <div className="file-toolbar-wrap">
      <nav className="file-toolbar" aria-label="File tools">
        {viewModeSlots.map(({ slot, action }) =>
          action ? (
            <button
              key={slot}
              className={`tool-button ${action.active ? "active" : ""}`}
              type="button"
              title={action.label}
              aria-label={action.label}
              aria-pressed={action.active ? true : undefined}
              data-view-mode-slot={slot}
              data-view-mode-action={action.viewMode}
              onClick={() => onSetViewMode(action.viewMode)}
            >
              {action.icon}
            </button>
          ) : (
            <span key={slot} className="tool-button mode-slot-placeholder" aria-hidden="true" data-view-mode-slot={slot} />
          ),
        )}
        <button
          className={`tool-button ${centerPopover === "view" ? "active" : ""}`}
          type="button"
          title="Editor controls"
          aria-label="Editor controls"
          onClick={onToggleViewOptions}
        >
          <SlidersHorizontal size={16} />
        </button>
        <button
          className={`tool-button ${searchOpen ? "active" : ""}`}
          type="button"
          title="Search"
          aria-label="Search"
          onClick={onToggleSearch}
        >
          <Search size={16} />
        </button>
      </nav>

      {centerPopover === "view" && (
        <section className="file-tool-popover editor-controls-popover" aria-label="Editor controls">
          <div className="editor-controls-section">
            {activeViewMode !== "preview" && (
              <>
                <button
                  className={`editor-controls-row ${activeLineNumbers ? "active" : ""}`}
                  type="button"
                  aria-pressed={activeLineNumbers}
                  onClick={onToggleLineNumbers}
                >
                  <span className="editor-controls-check">{activeLineNumbers && <Check size={14} />}</span>
                  <span>Line Numbers</span>
                </button>
                <button
                  className={`editor-controls-row ${activeLineWrapping ? "active" : ""}`}
                  type="button"
                  aria-pressed={activeLineWrapping}
                  onClick={onToggleLineWrapping}
                >
                  <span className="editor-controls-check">{activeLineWrapping && <Check size={14} />}</span>
                  <span>Line Wrapping</span>
                </button>
              </>
            )}
            <div className="editor-controls-width-row">
              <span>Text Width</span>
              <div className="editor-width-control" aria-label="Text width">
                {READING_WIDTHS.map((readingWidth) => (
                  <button
                    key={readingWidth}
                    className={readingWidth === activeReadingWidth ? "active" : ""}
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

export function FileSearchBar({
  searchInputRef,
  searchQuery,
  searchMatches,
  activeSearchMatchIndex,
  onSearchQueryChange,
  onGoToSearchMatch,
  onCloseSearch,
}: FileSearchBarProps) {
  return (
    <section className="file-search-row" aria-label="Find in file">
      <div className="file-search-bar">
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
          placeholder="Find in file"
          aria-label="Find in file"
        />
        <span className="file-search-count">
          {searchQuery.trim() && searchMatches.length > 0 && activeSearchMatchIndex >= 0
            ? `${activeSearchMatchIndex + 1}/${searchMatches.length}`
            : `0/${searchQuery.trim() ? searchMatches.length : 0}`}
        </span>
        <button
          type="button"
          title="Previous match"
          aria-label="Previous match"
          disabled={searchMatches.length === 0}
          onClick={() => onGoToSearchMatch(-1)}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          title="Next match"
          aria-label="Next match"
          disabled={searchMatches.length === 0}
          onClick={() => onGoToSearchMatch(1)}
        >
          <ChevronRight size={14} />
        </button>
        <button type="button" title="Close search" aria-label="Close search" onClick={onCloseSearch}>
          <X size={14} />
        </button>
      </div>
    </section>
  );
}
