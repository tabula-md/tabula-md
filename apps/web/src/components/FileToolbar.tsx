import { type ReactNode, type RefObject } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  ListOrdered,
  PencilLine,
  Search,
  SlidersHorizontal,
  SplitSquareHorizontal,
  WrapText,
} from "lucide-react";
import type { SearchMatch } from "../markdown";
import type { CenterPopover } from "../uiTypes";
import type { FileViewMode, ReadingWidth } from "../workspaceStorage";

type FileToolbarProps = {
  activeFileTitle: string;
  activeViewMode: FileViewMode;
  activeReadingWidth: ReadingWidth;
  activeLineWrapping: boolean;
  activeLineNumbers: boolean;
  centerPopover: CenterPopover;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchMatches: SearchMatch[];
  activeSearchMatchIndex: number;
  onSetViewMode: (viewMode: FileViewMode) => void;
  onToggleSearch: () => void;
  onToggleViewOptions: () => void;
  onNarrower: () => void;
  onWider: () => void;
  onToggleLineWrapping: () => void;
  onToggleLineNumbers: () => void;
  onSearchQueryChange: (query: string) => void;
  onGoToSearchMatch: (direction: 1 | -1) => void;
  onSelectSearchMatch: (match: SearchMatch, index: number) => void;
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

export function FileToolbar({
  activeFileTitle,
  activeViewMode,
  activeReadingWidth,
  activeLineWrapping,
  activeLineNumbers,
  centerPopover,
  searchInputRef,
  searchQuery,
  searchMatches,
  activeSearchMatchIndex,
  onSetViewMode,
  onToggleSearch,
  onToggleViewOptions,
  onNarrower,
  onWider,
  onToggleLineWrapping,
  onToggleLineNumbers,
  onSearchQueryChange,
  onGoToSearchMatch,
  onSelectSearchMatch,
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
          title="View options"
          aria-label={`View options for ${activeFileTitle}`}
          onClick={onToggleViewOptions}
        >
          <SlidersHorizontal size={16} />
        </button>
        <span className="toolbar-separator" />
        <button
          className={`tool-button ${centerPopover === "search" ? "active" : ""}`}
          type="button"
          title="Search"
          aria-label={`Search ${activeFileTitle}`}
          onClick={onToggleSearch}
        >
          <Search size={16} />
        </button>
      </nav>

      {centerPopover === "view" && (
        <section className="file-tool-popover view-options" aria-label="View options">
          <div className="tool-popover-title">View {activeFileTitle}</div>
          <div className="tool-popover-row">
            <span className="tool-popover-label">Reading width</span>
            <div className="view-width-control">
              <button
                type="button"
                title="Narrower reading width"
                aria-label="Narrower reading width"
                disabled={activeReadingWidth === "narrow"}
                onClick={onNarrower}
              >
                <ChevronLeft size={14} />
              </button>
              <span>{activeReadingWidth}</span>
              <button
                type="button"
                title="Wider reading width"
                aria-label="Wider reading width"
                disabled={activeReadingWidth === "wide"}
                onClick={onWider}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          {activeViewMode !== "preview" && (
            <>
              <button
                className={`view-toggle-button ${activeLineNumbers ? "active" : ""}`}
                type="button"
                aria-pressed={activeLineNumbers}
                onClick={onToggleLineNumbers}
              >
                <ListOrdered size={15} />
                <span>Line numbers</span>
                <small>{activeLineNumbers ? "On" : "Off"}</small>
              </button>
              <button
                className={`view-toggle-button ${activeLineWrapping ? "active" : ""}`}
                type="button"
                aria-pressed={activeLineWrapping}
                onClick={onToggleLineWrapping}
              >
                <WrapText size={15} />
                <span>Line wrapping</span>
                <small>{activeLineWrapping ? "On" : "Off"}</small>
              </button>
            </>
          )}
        </section>
      )}

      {centerPopover === "search" && (
        <section className="file-tool-popover" aria-label="File search">
          <div className="tool-popover-title">Search {activeFileTitle}</div>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              onGoToSearchMatch(event.shiftKey ? -1 : 1);
            }}
            placeholder="Find in file"
            aria-label="Search query"
          />
          <div className="tool-popover-meta">
            {searchQuery.trim()
              ? `${searchMatches.length} matches${
                  searchMatches.length > 0 && activeSearchMatchIndex >= 0
                    ? ` · ${activeSearchMatchIndex + 1} selected`
                    : ""
                }`
              : "Search is scoped to the active tab."}
          </div>
          {searchMatches.length > 0 && (
            <>
              <div className="search-controls">
                <button type="button" onClick={() => onGoToSearchMatch(-1)}>
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>
                <button type="button" onClick={() => onGoToSearchMatch(1)}>
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
              <ol className="search-match-list">
                {searchMatches.slice(0, 6).map((match, index) => (
                  <li key={`${match.start}-${match.end}`}>
                    <button
                      className={index === activeSearchMatchIndex ? "active" : ""}
                      type="button"
                      onClick={() => onSelectSearchMatch(match, index)}
                    >
                      {match.preview}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

    </div>
  );
}
