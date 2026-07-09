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

export type ActiveDocumentPreviewTextSnapshot = {
  fileId: string;
  hasFile: boolean;
  text: string;
};

export const createActiveDocumentPreviewTextSnapshot = (
  activeFile: Pick<WorkspaceFile, "id"> | undefined,
  text: string,
): ActiveDocumentPreviewTextSnapshot => ({
  fileId: activeFile?.id ?? "",
  hasFile: Boolean(activeFile),
  text,
});

const EMPTY_PREVIEW_TEXT_SNAPSHOT: ActiveDocumentPreviewTextSnapshot = {
  fileId: "",
  hasFile: false,
  text: "",
};

export const createPreviewStateFromSnapshot = (
  snapshot: ActiveDocumentPreviewTextSnapshot,
): ActiveDocumentPreviewRuntime =>
  createActiveDocumentPreviewRuntime(
    snapshot.hasFile ? { text: snapshot.text } : undefined,
    { text: snapshot.text },
  );

type DeferredDocumentState = {
  previewSnapshot: ActiveDocumentPreviewTextSnapshot;
  previewState: ActiveDocumentPreviewRuntime;
  wordCount: number;
};

export const useActiveDocumentRuntime = (
  activeFile?: WorkspaceFile,
  options: { text?: string } = {},
) => {
  const activeFileId = activeFile?.id ?? "";
  const activeText = options.text ?? activeFile?.text ?? "";
  const activeViewMode = activeFile?.viewMode ?? "edit";
  const activePreviewSnapshot = createActiveDocumentPreviewTextSnapshot(activeFile, activeText);
  const largeDocumentMode = isLargeMarkdownDocument(activeText);
  const immediatePreviewEligible = shouldUseImmediateMarkdownPreview(activeText);
  const [deferredState, setDeferredState] = useState<DeferredDocumentState>(() => ({
    previewSnapshot: activePreviewSnapshot,
    previewState: createPreviewStateFromSnapshot(activePreviewSnapshot),
    wordCount: getMarkdownWordCount(activeText),
  }));
  const shouldRenderPreviewImmediately =
    Boolean(activeFile) &&
    activeViewMode !== "edit" &&
    activeText.length <= IMMEDIATE_PREVIEW_MAX_CHARACTERS &&
    immediatePreviewEligible;
  const immediatePreviewState = useMemo(
    () => (shouldRenderPreviewImmediately ? createPreviewStateFromSnapshot(activePreviewSnapshot) : null),
    [activeFileId, activeText, shouldRenderPreviewImmediately],
  );
  const previewState =
    immediatePreviewState ??
    (deferredState.previewSnapshot.fileId === activeFileId
      ? deferredState.previewState
      : createPreviewStateFromSnapshot(EMPTY_PREVIEW_TEXT_SNAPSHOT));
  const wordCount = deferredState.previewSnapshot.fileId === activeFileId ? deferredState.wordCount : 0;

  useEffect(() => {
    if (!activeFile) {
      setDeferredState({
        previewSnapshot: EMPTY_PREVIEW_TEXT_SNAPSHOT,
        previewState: createPreviewStateFromSnapshot(EMPTY_PREVIEW_TEXT_SNAPSHOT),
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
      const previewSnapshot = createActiveDocumentPreviewTextSnapshot(activeFile, activeText);
      setDeferredState({
        previewSnapshot,
        previewState: createPreviewStateFromSnapshot(previewSnapshot),
        wordCount: getMarkdownWordCount(activeText),
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [activeFile, activeFileId, activeText, activeViewMode, largeDocumentMode]);

  const editorState = useMemo(
    () => createActiveDocumentEditorRuntime(activeFile, { text: activeText, wordCount }),
    [
      activeFile?.bookmarks,
      activeFile?.lineNumbers,
      activeFile?.lineWrapping,
      activeFile?.readingWidth,
      activeFile?.splitRatio,
      activeText,
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
