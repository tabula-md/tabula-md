import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  PencilLine,
  Replace,
  ReplaceAll,
  Search,
  SlidersHorizontal,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import type { SearchMatch } from "@tabula-md/tabula";
import type { CenterPopover } from "../uiTypes";
import {
  buildDocumentControlsModel,
  type FileViewMode,
  type ReadingWidth,
  type DocumentViewModeIcon,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";

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
  replaceQuery: string;
  searchMatches: SearchMatch[];
  activeSearchMatchIndex: number;
  language: WorkspaceLanguage;
  onSearchQueryChange: (query: string) => void;
  onReplaceQueryChange: (query: string) => void;
  onGoToSearchMatch: (direction: 1 | -1) => void;
  onReplaceCurrentMatch: () => void;
  onReplaceAllMatches: () => void;
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
  replaceQuery,
  searchMatches,
  activeSearchMatchIndex,
  language,
  onSearchQueryChange,
  onReplaceQueryChange,
  onGoToSearchMatch,
  onReplaceCurrentMatch,
  onReplaceAllMatches,
  onCloseSearch,
}: DocumentSearchBarProps) {
  const copy = getWorkspaceChromeCopy(language).documentControls;
  const hasMatches = searchMatches.length > 0;
  const [replaceOpen, setReplaceOpen] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!replaceOpen) {
      return;
    }

    replaceInputRef.current?.focus();
  }, [replaceOpen]);

  return (
    <section className={`document-search-row ${replaceOpen ? "with-replace" : ""}`} aria-label={copy.search}>
      <div className={`document-search-bar ${replaceOpen ? "with-replace" : ""}`}>
        <div className="document-search-line">
          <button
            type="button"
            className={replaceOpen ? "active" : ""}
            title={copy.toggleReplace}
            aria-label={copy.toggleReplace}
            aria-pressed={replaceOpen}
            onClick={() => setReplaceOpen((nextReplaceOpen) => !nextReplaceOpen)}
          >
            <Replace size={14} />
          </button>
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
            placeholder={copy.search}
            aria-label={copy.search}
          />
          <span className="document-search-count">
            {searchQuery.trim() && hasMatches && activeSearchMatchIndex >= 0
              ? `${activeSearchMatchIndex + 1}/${searchMatches.length}`
              : `0/${searchQuery.trim() ? searchMatches.length : 0}`}
          </span>
          <button
            type="button"
            title={copy.previousMatch}
            aria-label={copy.previousMatch}
            disabled={!hasMatches}
            onClick={() => onGoToSearchMatch(-1)}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            title={copy.nextMatch}
            aria-label={copy.nextMatch}
            disabled={!hasMatches}
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
        {replaceOpen && (
          <div className="document-search-line document-replace-line">
            <Replace size={15} />
            <input
              ref={replaceInputRef}
              type="text"
              value={replaceQuery}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onReplaceQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }

                event.preventDefault();
                if (event.altKey) {
                  onReplaceAllMatches();
                  return;
                }

                onReplaceCurrentMatch();
              }}
              placeholder={copy.replaceWith}
              aria-label={copy.replaceWith}
            />
            <span className="document-search-spacer" />
            <button
              type="button"
              title={copy.replaceMatch}
              aria-label={copy.replaceMatch}
              disabled={!hasMatches}
              onClick={onReplaceCurrentMatch}
            >
              <Replace size={14} />
            </button>
            <button
              type="button"
              title={copy.replaceAllMatches}
              aria-label={copy.replaceAllMatches}
              disabled={!hasMatches}
              onClick={onReplaceAllMatches}
            >
              <ReplaceAll size={14} />
            </button>
            <span className="document-search-spacer" />
          </div>
        )}
      </div>
    </section>
  );
}
