import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MarkdownEditorHandle } from "../components/MarkdownEditor";
import {
  getSearchMatches,
  replaceAllSearchMatches,
  replaceCurrentSearchMatch,
} from "@tabula-md/tabula";
import { useAnimationFrameTask } from "../hooks/useAnimationFrameTask";
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
  const [replaceQuery, setReplaceQuery] = useState("");
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchRevealKeyRef = useRef<string | null>(null);
  const queueAnimationFrameTask = useAnimationFrameTask();
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
      queueAnimationFrameTask(() => {
        editorRef.current?.revealRange(firstMatch.start, firstMatch.end);
      });
      return;
    }

    setActiveSearchMatchIndex((currentIndex) => {
      if (currentIndex === -1) {
        return 0;
      }

      return Math.min(currentIndex, searchMatches.length - 1);
    });
  }, [activeFileId, editorRef, queueAnimationFrameTask, searchMatches, searchOpen, searchQuery]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    queueAnimationFrameTask(() => searchInputRef.current?.focus());
  }, [queueAnimationFrameTask, searchOpen]);

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

  const replaceCurrentMatch = () => {
    const edit = replaceCurrentSearchMatch(
      text,
      searchQuery,
      replaceQuery,
      activeSearchMatchIndex === -1 ? 0 : activeSearchMatchIndex,
    );
    if (!edit) {
      return;
    }

    const applied = editorRef.current?.applyLocalTextPatches(edit.patches, edit.selection) ?? false;
    if (applied) {
      setActiveSearchMatchIndex((currentIndex) => Math.max(0, currentIndex));
    }
  };

  const replaceAllMatches = () => {
    const edit = replaceAllSearchMatches(text, searchQuery, replaceQuery);
    if (!edit) {
      return;
    }

    const applied = editorRef.current?.applyLocalTextPatches(edit.patches, edit.selection) ?? false;
    if (applied) {
      setActiveSearchMatchIndex(-1);
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
    searchMatches,
    activeSearchMatchIndex,
    goToSearchMatch,
    replaceCurrentMatch,
    replaceAllMatches,
  };
}
