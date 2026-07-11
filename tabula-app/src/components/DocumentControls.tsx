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
  ListChecks,
  MoreHorizontal,
  PencilLine,
  Replace,
  ReplaceAll,
  Search,
  SlidersHorizontal,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import type { CenterPopover } from "../uiTypes";
import type { SearchOptions } from "../editor/editorSearchModel";
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
  activeSyncScrolling: boolean;
  canCopyFile: boolean;
  centerPopover: CenterPopover;
  language: WorkspaceLanguage;
  searchOpen: boolean;
  onCopyFile: () => void;
  onSetViewMode: (viewMode: FileViewMode) => void;
  onToggleSearch: () => void;
  onToggleViewOptions: () => void;
  onSetReadingWidth: (readingWidth: ReadingWidth) => void;
  onToggleSyncScrolling: () => void;
  onToggleLineWrapping: () => void;
  onToggleLineNumbers: () => void;
};

type DocumentSearchBarProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  replaceQuery: string;
  searchMatchCount: number;
  searchError: string | null;
  searchOptions: SearchOptions;
  activeSearchMatchIndex: number;
  replaceAvailable: boolean;
  language: WorkspaceLanguage;
  onSearchQueryChange: (query: string) => void;
  onReplaceQueryChange: (query: string) => void;
  onToggleSearchOption: (option: keyof SearchOptions) => void;
  onGoToSearchMatch: (direction: 1 | -1) => void;
  onSelectAllSearchMatches: () => void;
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
  activeSyncScrolling,
  canCopyFile,
  centerPopover,
  language,
  searchOpen,
  onCopyFile,
  onSetViewMode,
  onToggleSearch,
  onToggleViewOptions,
  onSetReadingWidth,
  onToggleSyncScrolling,
  onToggleLineWrapping,
  onToggleLineNumbers,
}: DocumentControlsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const copy = getWorkspaceChromeCopy(language).documentControls;
  const controls = buildDocumentControlsModel({
    activeLineNumbers,
    activeLineWrapping,
    activeReadingWidth,
    activeSyncScrolling,
    activeViewMode,
    canCopyFile,
    copy,
  });

  useEffect(() => {
    if (!moreOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || moreRef.current?.contains(event.target)) return;
      setMoreOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setMoreOpen(false);
      window.requestAnimationFrame(() => moreButtonRef.current?.focus());
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  return (
    <div className="document-controls-wrap">
      <nav className="document-controls" aria-label={controls.documentControlsLabel}>
        <div className="document-view-mode-control" role="group" aria-label={controls.viewModeLabel}>
          {controls.viewModeOptions.map((option) => (
            <button
              key={option.viewMode}
              className={`tool-button ${option.active ? "active" : ""}`}
              type="button"
              title={option.label}
              aria-label={option.label}
              aria-pressed={option.active}
              data-view-mode={option.viewMode}
              onClick={() => onSetViewMode(option.viewMode)}
            >
              {viewModeIcons[option.icon]}
            </button>
          ))}
        </div>
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
        <div className="document-more-menu-wrap" ref={moreRef}>
          <button
            ref={moreButtonRef}
            className={`tool-button ${moreOpen ? "active" : ""}`}
            type="button"
            title="More document actions"
            aria-label="More document actions"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <MoreHorizontal size={16} />
          </button>
          {moreOpen && (
            <div className="document-more-menu" role="menu" aria-label="More document actions">
              <button
                type="button"
                role="menuitem"
                disabled={!canCopyFile}
                onClick={() => {
                  onCopyFile();
                  setMoreOpen(false);
                }}
              >
                <Copy size={15} />
                <span>{controls.copyButtonAriaLabel}</span>
              </button>
            </div>
          )}
        </div>
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
            {controls.showSplitToggles && (
              <button
                className={`editor-controls-row ${controls.syncScrolling.active ? "active" : ""}`}
                type="button"
                aria-pressed={controls.syncScrolling.active}
                onClick={onToggleSyncScrolling}
              >
                <span className="editor-controls-check">
                  {controls.syncScrolling.active && <Check size={14} />}
                </span>
                <span>{controls.syncScrolling.label}</span>
              </button>
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
  searchMatchCount,
  searchError,
  searchOptions,
  activeSearchMatchIndex,
  replaceAvailable,
  language,
  onSearchQueryChange,
  onReplaceQueryChange,
  onToggleSearchOption,
  onGoToSearchMatch,
  onSelectAllSearchMatches,
  onReplaceCurrentMatch,
  onReplaceAllMatches,
  onCloseSearch,
}: DocumentSearchBarProps) {
  const copy = getWorkspaceChromeCopy(language).documentControls;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasSearchError = Boolean(searchError);
  const hasMatches = !hasSearchError && searchMatchCount > 0;
  const hasNoSearchResults = hasSearchQuery && !hasSearchError && searchMatchCount === 0;
  const [replaceOpen, setReplaceOpen] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!replaceAvailable && replaceOpen) {
      setReplaceOpen(false);
    }
  }, [replaceAvailable, replaceOpen]);

  useEffect(() => {
    if (!replaceOpen) {
      return;
    }

    replaceInputRef.current?.focus();
  }, [replaceOpen]);

  return (
    <section className={`document-search-row ${replaceOpen && replaceAvailable ? "with-replace" : ""}`} aria-label={copy.search}>
      <div className={`document-search-bar ${replaceOpen && replaceAvailable ? "with-replace" : ""}`}>
        <div className={`document-search-line ${replaceAvailable ? "" : "without-replace-toggle"}`}>
          <div className="document-search-field">
            <Search size={15} />
            <input
              type="text"
              role="searchbox"
              ref={searchInputRef}
              value={searchQuery}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={hasSearchError}
              data-empty-result={hasNoSearchResults ? "true" : undefined}
              title={searchError ?? undefined}
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
            <div className="document-search-options" aria-label="Search options">
              <button
                type="button"
                className={`document-search-option ${searchOptions.caseSensitive ? "active" : ""}`}
                title={copy.matchCase}
                aria-label={copy.matchCase}
                aria-pressed={searchOptions.caseSensitive}
                onClick={() => onToggleSearchOption("caseSensitive")}
              >
                Aa
              </button>
              <button
                type="button"
                className={`document-search-option ${searchOptions.wholeWord ? "active" : ""}`}
                title={copy.matchWholeWord}
                aria-label={copy.matchWholeWord}
                aria-pressed={searchOptions.wholeWord}
                onClick={() => onToggleSearchOption("wholeWord")}
              >
                wd
              </button>
              <button
                type="button"
                className={`document-search-option ${searchOptions.regexp ? "active" : ""}`}
                title={copy.useRegularExpression}
                aria-label={copy.useRegularExpression}
                aria-pressed={searchOptions.regexp}
                onClick={() => onToggleSearchOption("regexp")}
              >
                .*
              </button>
            </div>
          </div>
          {replaceAvailable && (
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
          )}
          {replaceAvailable && (
            <button
              type="button"
              title={copy.selectAllMatches}
              aria-label={copy.selectAllMatches}
              disabled={!hasMatches}
              onClick={onSelectAllSearchMatches}
            >
              <ListChecks size={14} />
            </button>
          )}
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
          <span className="document-search-count">
            {hasSearchQuery && hasMatches && activeSearchMatchIndex >= 0
              ? `${activeSearchMatchIndex + 1}/${searchMatchCount}`
              : `0/${hasSearchQuery && !hasSearchError ? searchMatchCount : 0}`}
          </span>
          <button
            type="button"
            title={copy.closeSearch}
            aria-label={copy.closeSearch}
            onClick={onCloseSearch}
          >
            <X size={14} />
          </button>
        </div>
        {replaceOpen && replaceAvailable && (
          <div className="document-search-line document-replace-line">
            <div className="document-search-field">
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
              <span className="document-search-field-spacer" aria-hidden="true" />
            </div>
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
          </div>
        )}
      </div>
    </section>
  );
}
