import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MarkdownEditorHandle } from "../components/MarkdownEditor";
import { getSearchMatches } from "../markdown";
import { useWorkspaceUiStore } from "../stores/workspaceUiStore";

type UseEditorSearchControllerOptions = {
  activeFileId?: string;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  text: string;
  onFocusTextRange: (start: number, end: number) => void;
};

export function useEditorSearchController({
  activeFileId,
  editorRef,
  text,
  onFocusTextRange,
}: UseEditorSearchControllerOptions) {
  const searchOpen = useWorkspaceUiStore((state) => state.searchOpen);
  const setSearchOpen = useWorkspaceUiStore((state) => state.setSearchOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchRevealKeyRef = useRef<string | null>(null);
  const searchMatches = useMemo(() => getSearchMatches(text, searchQuery), [searchQuery, text]);

  useEffect(() => {
    const normalizedSearchQuery = searchQuery.trim();
    const revealKey = searchOpen && normalizedSearchQuery ? `${activeFileId ?? ""}:${normalizedSearchQuery}` : null;

    if (!searchOpen || !normalizedSearchQuery || searchMatches.length === 0) {
      setActiveSearchMatchIndex(-1);
      searchRevealKeyRef.current = revealKey;
      return;
    }

    if (searchRevealKeyRef.current !== revealKey) {
      const firstMatch = searchMatches[0];
      setActiveSearchMatchIndex(0);
      searchRevealKeyRef.current = revealKey;
      window.setTimeout(() => {
        editorRef.current?.revealRange(firstMatch.start, firstMatch.end);
      }, 0);
      return;
    }

    setActiveSearchMatchIndex((currentIndex) => {
      if (currentIndex === -1) {
        return 0;
      }

      return Math.min(currentIndex, searchMatches.length - 1);
    });
  }, [activeFileId, editorRef, searchMatches, searchOpen, searchQuery]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [searchOpen]);

  const goToSearchMatch = (direction: 1 | -1) => {
    if (searchMatches.length === 0) {
      return;
    }

    const currentIndex = activeSearchMatchIndex === -1 ? (direction === 1 ? -1 : 0) : activeSearchMatchIndex;
    const nextIndex =
      direction === 1
        ? (currentIndex + 1) % searchMatches.length
        : (currentIndex - 1 + searchMatches.length) % searchMatches.length;
    const match = searchMatches[nextIndex];
    setActiveSearchMatchIndex(nextIndex);

    if (searchOpen) {
      editorRef.current?.revealRange(match.start, match.end);
      return;
    }

    onFocusTextRange(match.start, match.end);
  };

  return {
    searchInputRef,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchMatches,
    activeSearchMatchIndex,
    goToSearchMatch,
  };
}
