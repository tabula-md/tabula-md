import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MarkdownEditorHandle } from "../document/MarkdownEditor";
import {
  DEFAULT_SEARCH_OPTIONS,
  EDITOR_SEARCH_MATCH_LIMIT,
  getEditorSearchResultWithLimit,
  replaceAllEditorSearchMatches,
  replaceCurrentEditorSearchMatch,
  type SearchOptions,
} from "./editorSearchModel";
import { useAnimationFrameTask } from "../shared/useAnimationFrameTask";
import { useWorkspaceUiStore } from "../workspace/state/workspaceUiStore";
import type { FileViewMode } from "../workspace/workspaceStorage";

export type SearchTarget = "source" | "preview";

type PreviewSearchMatchCountState = {
  count: number;
  documentText: string;
  key: string | null;
  truncated: boolean;
};

type UseEditorSearchControllerOptions = {
  activeFileId?: string;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  previewSurfaceRef: RefObject<HTMLElement | null>;
  text: string;
  onFocusTextRange: (start: number, end: number) => void;
};

const getSearchTargetForViewMode = (viewMode: FileViewMode): SearchTarget =>
  viewMode === "preview" ? "preview" : "source";

const getSearchOptionsKey = (searchOptions: SearchOptions) =>
  [
    searchOptions.caseSensitive ? "case" : "nocase",
    searchOptions.wholeWord ? "word" : "partial",
    searchOptions.regexp ? "regexp" : "literal",
  ].join(":");

const getPreviewSearchMatchCountKey = ({
  activeFileId,
  normalizedSearchQuery,
  searchOptions,
  searchTarget,
}: {
  activeFileId?: string;
  normalizedSearchQuery: string;
  searchOptions: SearchOptions;
  searchTarget: SearchTarget;
}) =>
  searchTarget === "preview" && normalizedSearchQuery
    ? `${activeFileId ?? ""}:preview:${normalizedSearchQuery}:${getSearchOptionsKey(searchOptions)}`
    : null;

const normalizeSelectedSearchText = (selectedText: string) =>
  selectedText.replace(/\s+/g, " ").trim();

const getPreviewSelectedText = (previewSurface: HTMLElement | null) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return "";
  }

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (
    !previewSurface ||
    !anchorNode ||
    !focusNode ||
    !previewSurface.contains(anchorNode) ||
    !previewSurface.contains(focusNode)
  ) {
    return "";
  }

  return selection.toString();
};

export function useEditorSearchController({
  activeFileId,
  activeViewMode,
  editorRef,
  previewSurfaceRef,
  text,
  onFocusTextRange,
}: UseEditorSearchControllerOptions) {
  const searchOpen = useWorkspaceUiStore((state) => state.searchOpen);
  const setSearchOpen = useWorkspaceUiStore((state) => state.setSearchOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [, setSearchDocumentRevision] = useState(0);
  const [previewSearchMatchCount, setPreviewSearchMatchCount] = useState<PreviewSearchMatchCountState>({
    count: 0,
    documentText: text,
    key: null,
    truncated: false,
  });
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchRevealKeyRef = useRef<string | null>(null);
  const queueAnimationFrameTask = useAnimationFrameTask();
  const searchTarget = getSearchTargetForViewMode(activeViewMode);
  const normalizedSearchQuery = searchOpen ? searchQuery.trim() : "";
  const previewSearchMatchCountKey = getPreviewSearchMatchCountKey({
    activeFileId,
    normalizedSearchQuery,
    searchOptions,
    searchTarget,
  });
  const searchDocument = editorRef.current?.getSearchDocument() ?? text;
  const sourceSearchResult = useMemo(
    () =>
      normalizedSearchQuery && searchTarget === "source"
        ? getEditorSearchResultWithLimit(
            searchDocument,
            normalizedSearchQuery,
            searchOptions,
            EDITOR_SEARCH_MATCH_LIMIT,
          )
        : { error: null, matches: [], truncated: false },
    [normalizedSearchQuery, searchDocument, searchOptions, searchTarget],
  );
  const searchMatches = sourceSearchResult.matches;
  const searchError = sourceSearchResult.error;
  const searchMatchesTruncated =
    searchTarget === "source"
      ? sourceSearchResult.truncated
      : previewSearchMatchCount.key === previewSearchMatchCountKey && previewSearchMatchCount.documentText === text
        ? previewSearchMatchCount.truncated
        : false;
  const searchMatchCount =
    searchTarget === "source"
      ? searchMatches.length
      : previewSearchMatchCount.key === previewSearchMatchCountKey && previewSearchMatchCount.documentText === text
        ? previewSearchMatchCount.count
        : 0;
  const replaceAvailable = searchTarget === "source";

  useEffect(() => {
    const revealKey =
      searchOpen && normalizedSearchQuery
        ? `${activeFileId ?? ""}:${searchTarget}:${normalizedSearchQuery}:${JSON.stringify(searchOptions)}`
        : null;

    if (!searchOpen || !normalizedSearchQuery || searchError || searchMatchCount === 0) {
      setActiveSearchMatchIndex(-1);
      searchRevealKeyRef.current = revealKey;
      return;
    }

    if (searchRevealKeyRef.current !== revealKey) {
      setActiveSearchMatchIndex(0);
      searchRevealKeyRef.current = revealKey;
      if (searchTarget === "source") {
        const firstMatch = searchMatches[0];
        queueAnimationFrameTask(() => {
          editorRef.current?.revealRange(firstMatch.start, firstMatch.end);
        });
      }
      return;
    }

    setActiveSearchMatchIndex((currentIndex) => {
      if (currentIndex === -1) {
        return 0;
      }

      return Math.min(currentIndex, searchMatchCount - 1);
    });
  }, [
    activeFileId,
    editorRef,
    normalizedSearchQuery,
    queueAnimationFrameTask,
    searchError,
    searchMatchCount,
    searchMatches,
    searchOpen,
    searchOptions,
    searchTarget,
  ]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    queueAnimationFrameTask(() => searchInputRef.current?.focus());
  }, [queueAnimationFrameTask, searchOpen]);

  const focusSearchInput = () => {
    queueAnimationFrameTask(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  };

  const openSearchFromCurrentSelection = () => {
    const selectedText =
      searchTarget === "preview"
        ? getPreviewSelectedText(previewSurfaceRef.current)
        : (editorRef.current?.getSelectedText() ?? "");
    const normalizedSelectedText = normalizeSelectedSearchText(selectedText);
    if (normalizedSelectedText) {
      setSearchQuery(normalizedSelectedText);
    }

    setSearchOpen(true);
    focusSearchInput();
  };

  const toggleSearchOption = (option: keyof SearchOptions) => {
    setSearchOptions((currentOptions) => ({
      ...currentOptions,
      [option]: !currentOptions[option],
    }));
  };

  const handlePreviewSearchMatchCountChange = useCallback((matchCount: number, truncated = false) => {
    setPreviewSearchMatchCount((currentMatchCount) => {
      const nextState = {
        count: previewSearchMatchCountKey ? matchCount : 0,
        documentText: text,
        key: previewSearchMatchCountKey,
        truncated: previewSearchMatchCountKey ? truncated : false,
      };
      return currentMatchCount.count === nextState.count &&
        currentMatchCount.documentText === nextState.documentText &&
        currentMatchCount.key === nextState.key &&
        currentMatchCount.truncated === nextState.truncated
        ? currentMatchCount
        : nextState;
    });
  }, [previewSearchMatchCountKey, text]);

  const goToSearchMatch = (direction: 1 | -1) => {
    if (searchMatchCount === 0 || searchError) {
      return;
    }

    const currentIndex = activeSearchMatchIndex === -1 ? (direction === 1 ? -1 : 0) : activeSearchMatchIndex;
    const nextIndex =
      direction === 1
        ? (currentIndex + 1) % searchMatchCount
        : (currentIndex - 1 + searchMatchCount) % searchMatchCount;
    setActiveSearchMatchIndex(nextIndex);

    if (searchTarget === "preview") {
      return;
    }

    const match = searchMatches[nextIndex];
    if (!match) {
      return;
    }

    if (searchOpen) {
      editorRef.current?.revealRange(match.start, match.end);
      return;
    }

    onFocusTextRange(match.start, match.end);
  };

  const selectAllSearchMatches = () => {
    if (searchTarget !== "source" || searchMatches.length === 0 || searchError || searchMatchesTruncated) {
      return;
    }

    editorRef.current?.setSelectionRanges(searchMatches.map((match) => ({ from: match.start, to: match.end })));
  };

  const replaceCurrentMatch = () => {
    if (!replaceAvailable) {
      return;
    }

    const currentText = editorRef.current?.getValue() ?? text;
    const currentMatches = getEditorSearchResultWithLimit(
      currentText,
      searchQuery.trim(),
      searchOptions,
      EDITOR_SEARCH_MATCH_LIMIT,
    ).matches;
    const currentMatchIndex = activeSearchMatchIndex === -1 ? 0 : activeSearchMatchIndex;
    const edit = replaceCurrentEditorSearchMatch(
      currentText,
      searchQuery,
      replaceQuery,
      Math.min(currentMatchIndex, Math.max(0, currentMatches.length - 1)),
      searchOptions,
      EDITOR_SEARCH_MATCH_LIMIT,
    );
    if (!edit) {
      return;
    }

    const applied = editorRef.current?.applyLocalTextPatches(edit.patches, edit.selection, {
      focus: false,
      isolateHistory: true,
    }) ?? false;
    if (applied) {
      const nextText = editorRef.current?.getValue() ?? edit.text;
      const nextMatches = getEditorSearchResultWithLimit(
        nextText,
        searchQuery,
        searchOptions,
        EDITOR_SEARCH_MATCH_LIMIT,
      ).matches;
      const nextMatchIndex = nextMatches.findIndex((match) => match.start >= edit.selection.to);
      setActiveSearchMatchIndex(nextMatches.length === 0 ? -1 : nextMatchIndex === -1 ? 0 : nextMatchIndex);
      setSearchDocumentRevision((currentRevision) => currentRevision + 1);
    }
  };

  const replaceAllMatches = () => {
    if (!replaceAvailable || searchMatchesTruncated) {
      return;
    }

    const currentText = editorRef.current?.getValue() ?? text;
    const edit = replaceAllEditorSearchMatches(currentText, searchQuery, replaceQuery, searchOptions);
    if (!edit) {
      return;
    }

    const applied = editorRef.current?.applyLocalTextPatches(edit.patches, edit.selection, {
      focus: false,
      isolateHistory: true,
    }) ?? false;
    if (applied) {
      setActiveSearchMatchIndex(-1);
      setSearchDocumentRevision((currentRevision) => currentRevision + 1);
    }
  };

  return {
    searchInputRef,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    replaceQuery,
    setReplaceQuery,
    replaceAvailable,
    searchTarget,
    searchOptions,
    toggleSearchOption,
    searchError,
    searchMatches,
    searchMatchCount,
    searchMatchesTruncated,
    activeSearchMatchIndex,
    openSearchFromCurrentSelection,
    onPreviewSearchMatchCountChange: handlePreviewSearchMatchCountChange,
    goToSearchMatch,
    selectAllSearchMatches,
    replaceCurrentMatch,
    replaceAllMatches,
  };
}
