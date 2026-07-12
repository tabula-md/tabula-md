import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type {
  MarkdownBookmark,
  MarkdownEditorHandle,
} from "../components/MarkdownEditor";
import type {
  FileBookmark,
  WorkspaceFile,
} from "../workspaceStorage";
import {
  LARGE_DOCUMENT_CHAR_THRESHOLD,
  LARGE_DOCUMENT_LINE_THRESHOLD,
  shouldCancelPendingDocumentBufferCommit,
  type TextChange,
  type TextPatch,
  type PendingDocumentBufferCommit,
} from "@tabula-md/tabula";
import type { WorkspaceEditorDocumentRuntimeOwner } from "./editorDocumentRuntimeOwner";

export type FileHistory = {
  past: string[];
  future: string[];
};

export type EditorHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
};

type PendingEditorCommit = PendingDocumentBufferCommit & {
  getText?: () => string | null | undefined;
};

type WorkspaceTextChangeSource = "coarse-update" | "editor-typing";

export type WorkspaceTextChangePolicy = {
  shouldDeferWorkspaceCommit: boolean;
  shouldRecordFallbackHistory: boolean;
  shouldSendCollaborationPatchImmediately: boolean;
};

const EMPTY_FILE_HISTORY: FileHistory = {
  past: [],
  future: [],
};

const MAX_FILE_HISTORY_ENTRIES = 80;
const LOCAL_TYPING_TEXT_COMMIT_DELAY_MS = 160;
const LARGE_LOCAL_TYPING_TEXT_COMMIT_DELAY_MS = 360;

type UseWorkspaceActiveFileEditorArgs = {
  activeFile?: WorkspaceFile;
  applyLocalText: (text: string | null, patches?: readonly TextPatch[], options?: { docLength?: number }) => void;
  collaborationBound?: boolean;
  isRoomSession: boolean;
  editorDocumentRuntime: WorkspaceEditorDocumentRuntimeOwner;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  onPendingTextChange?: () => void;
  onTextPatches?: (fileId: string, patches: readonly TextPatch[], oldDocumentLength: number) => void;
  onVisibleTextChange?: (change?: TextChange) => void;
  setActiveFileBookmarks: (bookmarks: FileBookmark[]) => void;
  setActiveFileText: (text: string) => void;
  setFileText: (fileId: string, text: string) => void;
};

export const getActiveFileHistory = (historyByFileId: Record<string, FileHistory>, activeFileId?: string) =>
  activeFileId ? (historyByFileId[activeFileId] ?? EMPTY_FILE_HISTORY) : EMPTY_FILE_HISTORY;

export const isFileTextFallbackHistoryEnabled = (isRoomSession: boolean) => !isRoomSession;
export const shouldUseEditorDocumentRuntime = (isRoomSession: boolean) => !isRoomSession;

export const recordFileTextHistory = (history: FileHistory | undefined, previousText: string): FileHistory => ({
  past: [...(history?.past ?? []).slice(-(MAX_FILE_HISTORY_ENTRIES - 1)), previousText],
  future: [],
});

export const getWorkspaceTextChangePolicy = ({
  activeFile,
  isRoomSession,
  nextText,
  recordHistory,
  source,
}: {
  activeFile?: Pick<WorkspaceFile, "text">;
  isRoomSession: boolean;
  nextText: string;
  recordHistory?: boolean;
  source: WorkspaceTextChangeSource;
}): WorkspaceTextChangePolicy => {
  const hasActiveFile = Boolean(activeFile);
  const isEditorTyping = source === "editor-typing";
  const shouldDeferWorkspaceCommit = hasActiveFile && isEditorTyping;
  const shouldRecordFallbackHistory =
    hasActiveFile &&
    !isEditorTyping &&
    (recordHistory ?? true) &&
    isFileTextFallbackHistoryEnabled(isRoomSession) &&
    nextText !== activeFile?.text;

  return {
    shouldDeferWorkspaceCommit,
    shouldRecordFallbackHistory,
    shouldSendCollaborationPatchImmediately: hasActiveFile && isRoomSession,
  };
};

export const getLocalTypingTextCommitDelay = (change?: Pick<TextChange, "docLength" | "lineCount">) =>
  (change?.docLength ?? 0) >= LARGE_DOCUMENT_CHAR_THRESHOLD ||
  (change?.lineCount ?? 0) >= LARGE_DOCUMENT_LINE_THRESHOLD
    ? LARGE_LOCAL_TYPING_TEXT_COMMIT_DELAY_MS
    : LOCAL_TYPING_TEXT_COMMIT_DELAY_MS;

export const schedulePendingEditorCommitTimer = ({
  clearTimeoutFn,
  currentTimerId,
  delayMs,
  flushPendingEditorCommit,
  setTimeoutFn,
}: {
  clearTimeoutFn: (timerId: number) => void;
  currentTimerId: number | null;
  delayMs: number;
  flushPendingEditorCommit: () => void;
  setTimeoutFn: (handler: () => void, timeout: number) => number;
}) => {
  if (currentTimerId !== null) {
    clearTimeoutFn(currentTimerId);
  }

  return setTimeoutFn(flushPendingEditorCommit, delayMs);
};

const shouldSendFullTextToCollaboration = (change?: Pick<TextChange, "docLength" | "lineCount">) =>
  (change?.docLength ?? 0) < LARGE_DOCUMENT_CHAR_THRESHOLD &&
  (change?.lineCount ?? 0) < LARGE_DOCUMENT_LINE_THRESHOLD;

export const shouldApplyEditorRuntimeVisibleTextPatch = (
  change?: Pick<TextChange, "docLength" | "lineCount" | "patches">,
) =>
  Boolean(change?.patches.length) &&
  (change?.docLength ?? 0) < LARGE_DOCUMENT_CHAR_THRESHOLD &&
  (change?.lineCount ?? 0) < LARGE_DOCUMENT_LINE_THRESHOLD;

export const shouldCancelPendingEditorCommit = (
  pendingCommit: PendingEditorCommit | null,
  activeFile: Pick<WorkspaceFile, "id" | "text"> | undefined,
) => shouldCancelPendingDocumentBufferCommit(pendingCommit, activeFile);

export const shouldUseFileTextFallbackHistory = ({
  canUseFallbackHistory,
  editorHandled,
  fallbackHistoryEnabled,
  hasActiveFile,
}: {
  canUseFallbackHistory: boolean;
  editorHandled: boolean;
  fallbackHistoryEnabled: boolean;
  hasActiveFile: boolean;
}) => !editorHandled && fallbackHistoryEnabled && hasActiveFile && canUseFallbackHistory;

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
  collaborationBound = false,
  isRoomSession,
  editorDocumentRuntime,
  editorRef,
  onPendingTextChange,
  onTextPatches,
  onVisibleTextChange,
  setActiveFileBookmarks,
  setActiveFileText,
  setFileText,
}: UseWorkspaceActiveFileEditorArgs) {
  const [historyByFileId, setHistoryByFileId] = useState<Record<string, FileHistory>>({});
  const [editorHistoryState, setEditorHistoryState] = useState<EditorHistoryState>({
    canUndo: false,
    canRedo: false,
  });
  const editorCommitTimerRef = useRef<number | null>(null);
  const activeHistory = getActiveFileHistory(historyByFileId, activeFile?.id);
  const fallbackHistoryEnabled = isFileTextFallbackHistoryEnabled(isRoomSession);
  const canUndo = fallbackHistoryEnabled && activeHistory.past.length > 0;
  const canRedo = fallbackHistoryEnabled && activeHistory.future.length > 0;

  const cancelPendingEditorCommit = useCallback(() => {
    if (editorCommitTimerRef.current !== null) {
      window.clearTimeout(editorCommitTimerRef.current);
      editorCommitTimerRef.current = null;
    }
  }, []);

  const flushPendingEditorCommit = useCallback(() => {
    cancelPendingEditorCommit();
    const commit = editorDocumentRuntime.flush();
    if (commit && !isRoomSession) {
      setFileText(commit.fileId, commit.text);
    }
  }, [cancelPendingEditorCommit, editorDocumentRuntime, isRoomSession, setFileText]);

  const schedulePendingEditorCommit = useCallback(
    (change?: Pick<TextChange, "docLength" | "lineCount">) => {
      editorCommitTimerRef.current = schedulePendingEditorCommitTimer({
        clearTimeoutFn: (timerId) => window.clearTimeout(timerId),
        currentTimerId: editorCommitTimerRef.current,
        delayMs: getLocalTypingTextCommitDelay(change),
        flushPendingEditorCommit,
        setTimeoutFn: (handler, timeout) => window.setTimeout(handler, timeout),
      });
    },
    [flushPendingEditorCommit],
  );

  const getLatestFileText = useCallback((fileId: string, fallbackText: string) => {
    return editorDocumentRuntime.getLatestFileText(fileId, fallbackText);
  }, [editorDocumentRuntime]);

  useEffect(() => flushPendingEditorCommit, [activeFile?.id, flushPendingEditorCommit]);

  useEffect(() => {
    window.addEventListener("pagehide", flushPendingEditorCommit);
    return () => window.removeEventListener("pagehide", flushPendingEditorCommit);
  }, [flushPendingEditorCommit]);

  useEffect(() => {
    if (!activeFile) {
      editorDocumentRuntime.clear();
      return;
    }

    if (!shouldUseEditorDocumentRuntime(isRoomSession)) {
      editorDocumentRuntime.clear();
      return;
    }

    const runtime = editorDocumentRuntime.getRuntime(activeFile);
    const snapshot = runtime.getSnapshot();
    const pendingCommit: PendingEditorCommit | null = snapshot.pendingCommit
      ? {
          fileId: snapshot.fileId,
          text: snapshot.pendingTextAvailable ? snapshot.text : undefined,
        }
      : null;

    if (shouldCancelPendingEditorCommit(pendingCommit, activeFile)) {
      cancelPendingEditorCommit();
      runtime.syncCommitted({ fileId: activeFile.id, text: activeFile.text });
      return;
    }

    if (!snapshot.pendingCommit && snapshot.committedText !== activeFile.text) {
      runtime.syncCommitted({ fileId: activeFile.id, text: activeFile.text });
    }
  }, [activeFile?.id, activeFile?.text, cancelPendingEditorCommit, editorDocumentRuntime, isRoomSession]);

  const updateActiveFileText = (nextText: string, options: { recordHistory?: boolean; patches?: readonly TextPatch[] } = {}) => {
    if (!activeFile) {
      return;
    }

    const policy = getWorkspaceTextChangePolicy({
      activeFile,
      isRoomSession,
      nextText,
      recordHistory: options.recordHistory,
      source: "coarse-update",
    });

    if (!shouldUseEditorDocumentRuntime(isRoomSession)) {
      applyLocalText(nextText, options.patches);
      onPendingTextChange?.();
      return;
    }

    if (policy.shouldRecordFallbackHistory) {
      flushPendingEditorCommit();
      setHistoryByFileId((currentHistory) => ({
        ...currentHistory,
        [activeFile.id]: recordFileTextHistory(currentHistory[activeFile.id], activeFile.text),
      }));
    }

    cancelPendingEditorCommit();
    editorDocumentRuntime.getRuntime(activeFile).syncCommitted({
      fileId: activeFile.id,
      text: nextText,
    });
    if (!isRoomSession) setActiveFileText(nextText);

    if (policy.shouldSendCollaborationPatchImmediately) {
      applyLocalText(nextText, options.patches);
    }
  };

  const handleEditorTextChange = (nextText: string | null, change?: TextChange) => {
    if (!activeFile) {
      return;
    }

    const patches = change?.patches ?? [];
    if (isRoomSession) {
      if (activeFile.viewMode !== "edit") onVisibleTextChange?.(change);
      onPendingTextChange?.();
      if (!collaborationBound) {
        applyLocalText(
          shouldSendFullTextToCollaboration(change) ? (editorRef.current?.getValue() ?? nextText) : null,
          patches,
          { docLength: change?.docLength },
        );
      }
      return;
    }
    const runtime = editorDocumentRuntime.getRuntime(activeFile);
    if (!isRoomSession && !collaborationBound && patches.length > 0 && typeof change?.docLength === "number") {
      const lengthDelta = patches.reduce(
        (total, patch) => total + patch.insert.length - (patch.to - patch.from),
        0,
      );
      onTextPatches?.(activeFile.id, patches, change.docLength - lengthDelta);
    }
    if (nextText === null) {
      const appliedPatchToVisibleText =
        activeFile.viewMode !== "edit" &&
        shouldApplyEditorRuntimeVisibleTextPatch(change) &&
        runtime.applyPatch(change?.patches ?? []);
      if (!appliedPatchToVisibleText) {
        runtime.setPendingCommit({
          readText: () => editorRef.current?.getValue(),
        });
      }
      if (activeFile.viewMode !== "edit") {
        onVisibleTextChange?.(change);
      }
      if (!collaborationBound) schedulePendingEditorCommit(change);
      onPendingTextChange?.();

      return;
    }

    const policy = getWorkspaceTextChangePolicy({
      activeFile,
      isRoomSession,
      nextText,
      recordHistory: false,
      source: "editor-typing",
    });

    if (!policy.shouldDeferWorkspaceCommit) {
      updateActiveFileText(nextText, {
        patches: change?.patches,
        recordHistory: false,
      });
      return;
    }

    runtime.replaceAll(nextText);
    onPendingTextChange?.();
    if (activeFile.viewMode !== "edit") {
      onVisibleTextChange?.(change);
    }
    if (!collaborationBound) schedulePendingEditorCommit(change);

  };

  const updateActiveFileBookmarks = (nextBookmarks: MarkdownBookmark[]) => {
    if (!activeFile) {
      return;
    }

    const normalizedBookmarks = normalizeFileBookmarks(nextBookmarks, new Date().toISOString());
    setActiveFileBookmarks(normalizedBookmarks);
  };

  const undoActiveFile = () => {
    const editorHandled = editorRef.current?.undo() ?? false;
    if (!shouldUseFileTextFallbackHistory({
      canUseFallbackHistory: canUndo,
      editorHandled,
      fallbackHistoryEnabled,
      hasActiveFile: Boolean(activeFile),
    }) || !activeFile) {
      return;
    }

    const previousText = activeHistory.past[activeHistory.past.length - 1];
    const currentText = getLatestFileText(activeFile.id, activeFile.text);
    setHistoryByFileId((currentHistory) => {
      const fileHistory = currentHistory[activeFile.id] ?? EMPTY_FILE_HISTORY;
      return {
        ...currentHistory,
        [activeFile.id]: {
          past: fileHistory.past.slice(0, -1),
          future: [currentText, ...fileHistory.future].slice(0, MAX_FILE_HISTORY_ENTRIES),
        },
      };
    });
    updateActiveFileText(previousText, { recordHistory: false });
  };

  const redoActiveFile = () => {
    const editorHandled = editorRef.current?.redo() ?? false;
    if (!shouldUseFileTextFallbackHistory({
      canUseFallbackHistory: canRedo,
      editorHandled,
      fallbackHistoryEnabled,
      hasActiveFile: Boolean(activeFile),
    }) || !activeFile) {
      return;
    }

    const nextText = activeHistory.future[0];
    const currentText = getLatestFileText(activeFile.id, activeFile.text);
    setHistoryByFileId((currentHistory) => {
      const fileHistory = currentHistory[activeFile.id] ?? EMPTY_FILE_HISTORY;
      return {
        ...currentHistory,
        [activeFile.id]: {
          past: [...fileHistory.past.slice(-(MAX_FILE_HISTORY_ENTRIES - 1)), currentText],
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
    getLatestFileText,
    redoActiveFile,
    setHistoryByFileId,
    undoActiveFile,
    updateActiveFileBookmarks,
    updateActiveFileText,
    flushPendingEditorCommit,
  };
}
