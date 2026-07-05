import { useEffect, useMemo, useState } from "react";
import {
  createActiveDocumentEditorRuntime,
  createActiveDocumentPreviewRuntime,
  getMarkdownWordCount,
  isLargeMarkdownDocument,
  shouldUseImmediateMarkdownPreview,
  LIVE_PREVIEW_CHAR_THRESHOLD,
  type ActiveDocumentPreviewRuntime,
} from "@tabula-md/tabula";
import type { WorkspaceFile } from "../workspaceStorage";

const EDIT_MODE_DERIVED_STATE_DELAY_MS = 240;
const SMALL_HEAVY_PREVIEW_DERIVED_STATE_DELAY_MS = 120;
const PREVIEW_MODE_DERIVED_STATE_DELAY_MS = 220;
const LARGE_DOCUMENT_DERIVED_STATE_DELAY_MS = 720;
const IMMEDIATE_PREVIEW_MAX_CHARACTERS = 250_000;

const createPreviewState = (activeFile?: WorkspaceFile): ActiveDocumentPreviewRuntime =>
  createActiveDocumentPreviewRuntime(activeFile);

type DeferredDocumentState = {
  fileId: string;
  previewState: ActiveDocumentPreviewRuntime;
  wordCount: number;
};

export const useActiveDocumentRuntime = (activeFile?: WorkspaceFile) => {
  const activeFileId = activeFile?.id ?? "";
  const activeText = activeFile?.text ?? "";
  const activeViewMode = activeFile?.viewMode ?? "edit";
  const largeDocumentMode = isLargeMarkdownDocument(activeText);
  const immediatePreviewEligible = shouldUseImmediateMarkdownPreview(activeText);
  const [deferredState, setDeferredState] = useState<DeferredDocumentState>(() => ({
    fileId: activeFileId,
    previewState: createPreviewState(activeFile),
    wordCount: getMarkdownWordCount(activeText),
  }));
  const shouldRenderPreviewImmediately =
    Boolean(activeFile) &&
    activeViewMode !== "edit" &&
    activeText.length <= IMMEDIATE_PREVIEW_MAX_CHARACTERS &&
    immediatePreviewEligible;
  const immediatePreviewState = useMemo(
    () => (shouldRenderPreviewImmediately ? createPreviewState(activeFile) : null),
    [activeFile, shouldRenderPreviewImmediately],
  );
  const previewState =
    immediatePreviewState ??
    (deferredState.fileId === activeFileId
      ? deferredState.previewState
      : createPreviewState(undefined));
  const wordCount = deferredState.fileId === activeFileId ? deferredState.wordCount : 0;

  useEffect(() => {
    if (!activeFile) {
      setDeferredState({
        fileId: "",
        previewState: createPreviewState(undefined),
        wordCount: 0,
      });
      return;
    }

    const delayMs = largeDocumentMode
      ? LARGE_DOCUMENT_DERIVED_STATE_DELAY_MS
      : activeFile.viewMode === "edit"
        ? EDIT_MODE_DERIVED_STATE_DELAY_MS
        : activeText.length <= LIVE_PREVIEW_CHAR_THRESHOLD
          ? SMALL_HEAVY_PREVIEW_DERIVED_STATE_DELAY_MS
          : PREVIEW_MODE_DERIVED_STATE_DELAY_MS;
    const timer = window.setTimeout(() => {
      setDeferredState({
        fileId: activeFile.id,
        previewState: createPreviewState(activeFile),
        wordCount: getMarkdownWordCount(activeFile.text),
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [activeFile, activeFileId, activeText, activeViewMode, largeDocumentMode]);

  const editorState = useMemo(
    () => createActiveDocumentEditorRuntime(activeFile, { wordCount }),
    [
      activeFile?.bookmarks,
      activeFile?.lineNumbers,
      activeFile?.lineWrapping,
      activeFile?.readingWidth,
      activeFile?.splitRatio,
      activeFile?.text,
      activeFile?.title,
      activeFile?.viewMode,
      wordCount,
    ],
  );

  return useMemo(
    () => ({
      ...editorState,
      ...previewState,
    }),
    [editorState, previewState],
  );
};
