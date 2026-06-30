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
import {
  buildDocumentControlsModel,
  type DocumentViewModeIcon,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import {
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

const viewModeIcons: Record<DocumentViewModeIcon, ReactNode> = {
  edit: <PencilLine size={16} />,
  preview: <Eye size={16} />,
  split: <SplitSquareHorizontal size={16} />,
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
  const controls = buildDocumentControlsModel({
    activeLineNumbers,
    activeLineWrapping,
    activeReadingWidth,
    activeViewMode,
    canCopyFile,
    copy,
  });

  return (
    <div className="document-controls-wrap">
      <nav className="document-controls" aria-label={controls.documentControlsLabel}>
        {controls.viewModeActions.map((action) => (
          <button
            key={action.slot}
            className="tool-button"
            type="button"
            title={action.label}
            aria-label={action.label}
            data-view-mode-slot={action.slot}
            data-view-mode-action={action.viewMode}
            onClick={() => onSetViewMode(action.viewMode)}
          >
            {viewModeIcons[action.icon]}
          </button>
        ))}
        <button
          className="tool-button"
          type="button"
          title={controls.copyButtonTitle}
          aria-label={controls.copyButtonAriaLabel}
          disabled={!canCopyFile}
          onClick={onCopyFile}
        >
          <Copy size={16} />
        </button>
        <button
          className={`tool-button ${centerPopover === "view" ? "active" : ""}`}
          type="button"
          title={controls.controlsLabel}
          aria-label={controls.controlsLabel}
          onClick={onToggleViewOptions}
        >
          <SlidersHorizontal size={16} />
        </button>
        <button
          className={`tool-button ${searchOpen ? "active" : ""}`}
          type="button"
          title={controls.searchLabel}
          aria-label={controls.searchLabel}
          onClick={onToggleSearch}
        >
          <Search size={16} />
        </button>
      </nav>

      {centerPopover === "view" && (
        <section
          className="document-controls-popover editor-controls-popover"
          aria-label={controls.controlsLabel}
        >
          <div className="editor-controls-section">
            {controls.showEditorToggles && (
              <>
                <button
                  className={`editor-controls-row ${controls.lineNumbers.active ? "active" : ""}`}
                  type="button"
                  aria-pressed={controls.lineNumbers.active}
                  onClick={onToggleLineNumbers}
                >
                  <span className="editor-controls-check">
                    {controls.lineNumbers.active && <Check size={14} />}
                  </span>
                  <span>{controls.lineNumbers.label}</span>
                </button>
                <button
                  className={`editor-controls-row ${controls.lineWrapping.active ? "active" : ""}`}
                  type="button"
                  aria-pressed={controls.lineWrapping.active}
                  onClick={onToggleLineWrapping}
                >
                  <span className="editor-controls-check">
                    {controls.lineWrapping.active && <Check size={14} />}
                  </span>
                  <span>{controls.lineWrapping.label}</span>
                </button>
              </>
            )}
            <div className="editor-controls-width-row">
              <span>{controls.readingWidthLabel}</span>
              <div className="editor-width-control" aria-label={controls.readingWidthLabel}>
                {controls.readingWidthOptions.map(({ active, label, readingWidth }) => (
                  <button
                    key={readingWidth}
                    className={active ? "active" : ""}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSetReadingWidth(readingWidth)}
                  >
                    {label}
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
