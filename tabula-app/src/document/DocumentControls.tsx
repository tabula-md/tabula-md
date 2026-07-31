import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  Code2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ListChecks,
  MoreHorizontal,
  PencilLine,
  Replace,
  ReplaceAll,
  Search,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import type { CenterPopover } from "../ui/uiTypes";
import type { SearchOptions } from "../editor/editorSearchModel";
import {
  buildDocumentControlsModel,
  getEditingModeViewMode,
  type FileEditingMode,
  type FileViewMode,
  type ReadingWidth,
  type DocumentViewModeIcon,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspace/workspaceLocale";
import { getWorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "../ui/Popover";

type DocumentControlsProps = {
  activeEditingMode: FileEditingMode;
  activeViewMode: FileViewMode;
  activeReadingWidth: ReadingWidth;
  activeLineWrapping: boolean;
  activeLineNumbers: boolean;
  activeSyncScrolling: boolean;
  centerPopover: CenterPopover;
  language: WorkspaceLanguage;
  searchOpen: boolean;
  showSearch?: boolean;
  showSyncScrolling?: boolean;
  sourceOnly?: boolean;
  onSetViewMode: (viewMode: FileViewMode) => void;
  onPreparePreview: () => void;
  onToggleViewOptions: () => void;
  onSetReadingWidth: (readingWidth: ReadingWidth) => void;
  onToggleSyncScrolling: () => void;
  onToggleLineWrapping: () => void;
  onToggleLineNumbers: () => void;
  onToggleSearch: () => void;
};

export type DocumentSearchBarProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  replaceQuery: string;
  searchMatchCount: number;
  searchMatchesTruncated: boolean;
  searchError: string | null;
  searchOptions: SearchOptions;
  activeSearchMatchIndex: number;
  replaceAvailable: boolean;
  target: "source" | "preview";
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
  edit: <Code2 size={16} />,
  preview: <Eye size={16} />,
  split: <SplitSquareHorizontal size={16} />,
  visual: <PencilLine size={16} />,
};

export function DocumentControls({
  activeEditingMode,
  activeViewMode,
  activeReadingWidth,
  activeLineWrapping,
  activeLineNumbers,
  activeSyncScrolling,
  centerPopover,
  language,
  searchOpen,
  showSearch = true,
  showSyncScrolling = true,
  sourceOnly = false,
  onSetViewMode,
  onPreparePreview,
  onToggleViewOptions,
  onSetReadingWidth,
  onToggleSyncScrolling,
  onToggleLineWrapping,
  onToggleLineNumbers,
  onToggleSearch,
}: DocumentControlsProps) {
  const copy = getWorkspaceChromeCopy(language).documentControls;
  const controls = buildDocumentControlsModel({
    activeEditingMode,
    activeLineNumbers,
    activeLineWrapping,
    activeReadingWidth,
    activeSyncScrolling,
    activeViewMode,
    copy,
  });
  const viewModeOptions = sourceOnly
    ? controls.viewModeOptions.filter((option) => option.viewMode === "edit")
    : controls.viewModeOptions;
  const editingModeOptions = sourceOnly
    ? controls.editingModeOptions.filter(
        (option) => option.editingMode === "source",
      )
    : controls.editingModeOptions;
  return (
    <div className="document-controls-wrap">
      <nav className="document-controls" aria-label={controls.documentControlsLabel}>
        <div className="document-view-mode-control" role="group" aria-label={controls.viewModeLabel}>
          {viewModeOptions.map((option) => {
            const nextViewMode =
              option.active && option.viewMode === "preview"
                ? getEditingModeViewMode(activeEditingMode)
                : option.active && option.viewMode === "split"
                  ? "edit"
                  : option.viewMode;

            return (
              <button
                key={option.viewMode}
                className={`ui-icon-button tool-button document-view-mode-button ${option.active ? "active" : ""}`}
                type="button"
                aria-label={option.label}
                data-tooltip={option.label}
                aria-pressed={option.active}
                data-view-mode={option.viewMode}
                onFocus={
                  option.viewMode === "preview" || option.viewMode === "split"
                    ? onPreparePreview
                    : undefined
                }
                onPointerEnter={
                  option.viewMode === "preview" || option.viewMode === "split"
                    ? onPreparePreview
                    : undefined
                }
                onClick={() => onSetViewMode(nextViewMode)}
              >
                {viewModeIcons[option.icon]}
              </button>
            );
          })}
        </div>
        <div className="document-utility-controls">
          {showSearch && (
            <button
              className={`ui-icon-button tool-button document-search-toggle ${searchOpen ? "active" : ""}`}
              type="button"
              aria-label={copy.search}
              data-tooltip={copy.search}
              aria-pressed={searchOpen}
              onClick={onToggleSearch}
            >
              <Search size={16} />
            </button>
          )}
          <PopoverRoot
            open={centerPopover === "view"}
            onOpenChange={(open) => {
              if (open !== (centerPopover === "view")) onToggleViewOptions();
            }}
          >
            <PopoverTrigger asChild>
              <button
                className={`ui-icon-button tool-button document-options-button ${centerPopover === "view" ? "active" : ""}`}
                type="button"
                aria-label={controls.controlsLabel}
                data-tooltip={controls.controlsLabel}
              >
                <MoreHorizontal size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="document-controls-popover editor-controls-popover"
              role="dialog"
              aria-label={controls.controlsLabel}
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <section className="editor-controls-section">
                <h3 className="editor-controls-heading">{controls.editingModeLabel}</h3>
                <div
                  className="editing-mode-options"
                  role="group"
                  aria-label={controls.editingModeLabel}
                >
                  {editingModeOptions.map((option) => (
                    <button
                      key={option.editingMode}
                      className={`editor-controls-row editing-mode-option ${option.active ? "active" : ""}`}
                      type="button"
                      aria-label={option.label}
                      aria-pressed={option.active}
                      data-editing-mode={option.editingMode}
                      onClick={() => onSetViewMode(option.viewMode)}
                    >
                      <span className="editing-mode-option-icon">
                        {viewModeIcons[option.icon]}
                      </span>
                      <span>{option.label}</span>
                      <span className="editor-controls-check">
                        {option.active && <Check size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <div className="editor-controls-divider" role="separator" />
              <section className="editor-controls-section">
                <h3 className="editor-controls-heading">{controls.viewModeLabel}</h3>
                <div role="group" aria-label={controls.viewModeLabel}>
                  {viewModeOptions.map((option) => (
                    <button
                      key={option.viewMode}
                      className={`editor-controls-row editor-view-option ${option.active ? "active" : ""}`}
                      type="button"
                      aria-pressed={option.active}
                      data-view-mode-option={option.viewMode}
                      onClick={() => onSetViewMode(option.viewMode)}
                    >
                      <span className="editing-mode-option-icon">
                        {viewModeIcons[option.icon]}
                      </span>
                      <span>{option.label}</span>
                      <span className="editor-controls-check">
                        {option.active && <Check size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              {controls.showEditorToggles && (
                <>
                  <div className="editor-controls-divider" role="separator" />
                  <section className="editor-controls-section view-controls-settings">
                    <h3 className="editor-controls-heading">{controls.sourceOptionsLabel}</h3>
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
                    {showSyncScrolling && controls.showSplitToggles && (
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
                  </section>
                </>
              )}
              <div className="editor-controls-divider" role="separator" />
              <section className="editor-controls-section view-controls-settings">
                <h3 className="editor-controls-heading">{controls.layoutLabel}</h3>
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
              </section>
            </PopoverContent>
          </PopoverRoot>
        </div>
      </nav>

    </div>
  );
}

export function DocumentSearchBar({
  searchInputRef,
  searchQuery,
  replaceQuery,
  searchMatchCount,
  searchMatchesTruncated,
  searchError,
  searchOptions,
  activeSearchMatchIndex,
  replaceAvailable,
  target,
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
  const surfaceCopy = getWorkspaceSurfaceCopy(language);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasSearchError = Boolean(searchError);
  const hasMatches = !hasSearchError && searchMatchCount > 0;
  const hasCompleteMatchSet = hasMatches && !searchMatchesTruncated;
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
    <section className={`document-search-row search-target-${target} ${replaceOpen && replaceAvailable ? "with-replace" : ""}`} aria-label={copy.search}>
      <div className={`document-search-bar ${replaceOpen && replaceAvailable ? "with-replace" : ""}`}>
        <div className={`document-search-line ${replaceAvailable ? "" : "without-replace-toggle"}`}>
          <div className="document-search-field">
            <Search size={16} />
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
              data-tooltip={searchError ?? undefined}
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
            <div className="document-search-options" aria-label={surfaceCopy.searchOptions}>
              <button
                type="button"
                className={`document-search-option ${searchOptions.caseSensitive ? "active" : ""}`}
                data-tooltip={copy.matchCase}
                aria-label={copy.matchCase}
                aria-pressed={searchOptions.caseSensitive}
                onClick={() => onToggleSearchOption("caseSensitive")}
              >
                Aa
              </button>
              <button
                type="button"
                className={`document-search-option ${searchOptions.wholeWord ? "active" : ""}`}
                data-tooltip={copy.matchWholeWord}
                aria-label={copy.matchWholeWord}
                aria-pressed={searchOptions.wholeWord}
                onClick={() => onToggleSearchOption("wholeWord")}
              >
                wd
              </button>
              <button
                type="button"
                className={`document-search-option ${searchOptions.regexp ? "active" : ""}`}
                data-tooltip={copy.useRegularExpression}
                aria-label={copy.useRegularExpression}
                aria-pressed={searchOptions.regexp}
                onClick={() => onToggleSearchOption("regexp")}
              >
                .*
              </button>
            </div>
          </div>
          <div className="document-search-actions">
            {replaceAvailable && (
              <button
                type="button"
                className={replaceOpen ? "active" : ""}
                data-tooltip={copy.toggleReplace}
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
                data-tooltip={copy.selectAllMatches}
                aria-label={copy.selectAllMatches}
                disabled={!hasCompleteMatchSet}
                onClick={onSelectAllSearchMatches}
              >
                <ListChecks size={14} />
              </button>
            )}
            <button
              type="button"
              data-tooltip={copy.previousMatch}
              aria-label={copy.previousMatch}
              disabled={!hasMatches}
              onClick={() => onGoToSearchMatch(-1)}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              data-tooltip={copy.nextMatch}
              aria-label={copy.nextMatch}
              disabled={!hasMatches}
              onClick={() => onGoToSearchMatch(1)}
            >
              <ChevronRight size={14} />
            </button>
            <span
              className="document-search-count"
              role="status"
              aria-live="polite"
              aria-label={searchError ?? undefined}
            >
              {hasSearchQuery && hasMatches && activeSearchMatchIndex >= 0
                ? `${activeSearchMatchIndex + 1}/${searchMatchCount}${searchMatchesTruncated ? "+" : ""}`
                : `0/${hasSearchQuery && !hasSearchError ? searchMatchCount : 0}${searchMatchesTruncated ? "+" : ""}`}
            </span>
            <button
              type="button"
              data-tooltip={copy.closeSearch}
              aria-label={copy.closeSearch}
              onClick={onCloseSearch}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        {replaceOpen && replaceAvailable && (
          <div className="document-search-line document-replace-line">
            <div className="document-search-field">
              <Replace size={16} />
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
            </div>
            <div className="document-search-actions document-replace-actions">
              <button
                type="button"
                data-tooltip={copy.replaceMatch}
                aria-label={copy.replaceMatch}
                disabled={!hasMatches}
                onClick={onReplaceCurrentMatch}
              >
                <Replace size={14} />
              </button>
              <button
                type="button"
                data-tooltip={copy.replaceAllMatches}
                aria-label={copy.replaceAllMatches}
                disabled={!hasCompleteMatchSet}
                onClick={onReplaceAllMatches}
              >
                <ReplaceAll size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
