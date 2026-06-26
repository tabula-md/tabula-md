import { type RefObject, useState } from "react";
import type {
  MarkdownBookmark,
  MarkdownEditorHandle,
} from "../components/MarkdownEditor";
import type {
  FileBookmark,
  MarkdownFile,
} from "../workspaceStorage";
import type { TextChange, TextPatch } from "../textPatches";

export type FileHistory = {
  past: string[];
  future: string[];
};

export type EditorHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
};

const EMPTY_FILE_HISTORY: FileHistory = {
  past: [],
  future: [],
};

const MAX_FILE_HISTORY_ENTRIES = 80;

type UseWorkspaceActiveFileEditorArgs = {
  activeFile?: MarkdownFile;
  applyLocalText: (text: string, patches?: readonly TextPatch[]) => void;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  setActiveFileBookmarks: (bookmarks: FileBookmark[]) => void;
  setActiveFileText: (text: string) => void;
};

export const getActiveFileHistory = (historyByFileId: Record<string, FileHistory>, activeFileId?: string) =>
  activeFileId ? (historyByFileId[activeFileId] ?? EMPTY_FILE_HISTORY) : EMPTY_FILE_HISTORY;

export const recordFileTextHistory = (history: FileHistory | undefined, previousText: string): FileHistory => ({
  past: [...(history?.past ?? []).slice(-(MAX_FILE_HISTORY_ENTRIES - 1)), previousText],
  future: [],
});

export const normalizeFileBookmarks = (bookmarks: MarkdownBookmark[], nowIso: string): FileBookmark[] =>
  bookmarks
    .map((bookmark) => ({
      id: bookmark.id,
      position: Math.max(0, bookmark.position),
      createdAt: bookmark.createdAt ?? nowIso,
    }))
    .filter(
      (bookmark, index, bookmarkList) =>
        bookmarkList.findIndex((candidate) => candidate.position === bookmark.position) === index,
    );

export function useWorkspaceActiveFileEditor({
  activeFile,
  applyLocalText,
  editorRef,
  setActiveFileBookmarks,
  setActiveFileText,
}: UseWorkspaceActiveFileEditorArgs) {
  const [historyByFileId, setHistoryByFileId] = useState<Record<string, FileHistory>>({});
  const [editorHistoryState, setEditorHistoryState] = useState<EditorHistoryState>({
    canUndo: false,
    canRedo: false,
  });
  const activeHistory = getActiveFileHistory(historyByFileId, activeFile?.id);
  const canUndo = activeHistory.past.length > 0;
  const canRedo = activeHistory.future.length > 0;

  const updateActiveFileText = (nextText: string, options: { recordHistory?: boolean; patches?: readonly TextPatch[] } = {}) => {
    if (!activeFile) {
      return;
    }

    const shouldRecordHistory = options.recordHistory ?? true;
    if (shouldRecordHistory && nextText !== activeFile.text) {
      setHistoryByFileId((currentHistory) => ({
        ...currentHistory,
        [activeFile.id]: recordFileTextHistory(currentHistory[activeFile.id], activeFile.text),
      }));
    }

    setActiveFileText(nextText);

    if (activeFile.roomId) {
      applyLocalText(nextText, options.patches);
    }
  };

  const handleEditorTextChange = (nextText: string, change?: TextChange) => {
    updateActiveFileText(nextText, { patches: change?.patches });
  };

  const updateActiveFileBookmarks = (nextBookmarks: MarkdownBookmark[]) => {
    if (!activeFile) {
      return;
    }

    const normalizedBookmarks = normalizeFileBookmarks(nextBookmarks, new Date().toISOString());
    setActiveFileBookmarks(normalizedBookmarks);
  };

  const undoActiveFile = () => {
    if (editorRef.current?.undo()) {
      return;
    }

    if (!activeFile || !canUndo) {
      return;
    }

    const previousText = activeHistory.past[activeHistory.past.length - 1];
    setHistoryByFileId((currentHistory) => {
      const fileHistory = currentHistory[activeFile.id] ?? EMPTY_FILE_HISTORY;
      return {
        ...currentHistory,
        [activeFile.id]: {
          past: fileHistory.past.slice(0, -1),
          future: [activeFile.text, ...fileHistory.future].slice(0, MAX_FILE_HISTORY_ENTRIES),
        },
      };
    });
    updateActiveFileText(previousText, { recordHistory: false });
  };

  const redoActiveFile = () => {
    if (editorRef.current?.redo()) {
      return;
    }

    if (!activeFile || !canRedo) {
      return;
    }

    const nextText = activeHistory.future[0];
    setHistoryByFileId((currentHistory) => {
      const fileHistory = currentHistory[activeFile.id] ?? EMPTY_FILE_HISTORY;
      return {
        ...currentHistory,
        [activeFile.id]: {
          past: [...fileHistory.past.slice(-(MAX_FILE_HISTORY_ENTRIES - 1)), activeFile.text],
          future: fileHistory.future.slice(1),
        },
      };
    });
    updateActiveFileText(nextText, { recordHistory: false });
  };

  return {
    activeHistory,
    canRedo,
    canUndo,
    clearFileHistory: () => setHistoryByFileId({}),
    editorHistoryState,
    handleEditorHistoryStateChange: setEditorHistoryState,
    handleTextChange: handleEditorTextChange,
    historyByFileId,
    redoActiveFile,
    setHistoryByFileId,
    undoActiveFile,
    updateActiveFileBookmarks,
    updateActiveFileText,
  };
}
